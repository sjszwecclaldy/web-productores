const express = require('express');
const { query } = require('../db');
const { requireJwt, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(requireJwt);
router.use(requireAdmin);

// Temas permitidos para las visitas del departamento tecnico.
const TEMAS_VISITA = ['Calidad de Leche', 'Antibiótico', 'Visita de rutina', 'Otros'];

router.get('/productores', async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT card_code, card_name, estado
       FROM productores
       WHERE role = 'productor'
       ORDER BY card_name ASC`
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('admin productores list error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

function defaultDesde() {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString().slice(0, 10);
}

router.get('/dashboard', async (req, res) => {
  const desde = req.query.desde || defaultDesde();
  const hasta = req.query.hasta || null;

  try {
    const productoresQ = await query(
      `WITH rem AS (
         SELECT card_code,
                SUM(quantity) AS litros,
                COUNT(*) AS entregas,
                MAX(doc_date) AS ultima_entrega,
                SUM(line_total) AS importe_remitido
         FROM remisiones
         WHERE doc_date >= $1 AND ($2::date IS NULL OR doc_date <= $2)
         GROUP BY card_code
       ),
       cal AS (
         SELECT card_code,
                AVG(fat) AS grasa,
                AVG(protein) AS proteina,
                AVG(lactose) AS lactosa,
                AVG(ts) AS solidos,
                COUNT(*) AS muestras
         FROM calidad_composicion
         WHERE collection_date >= $1 AND ($2::date IS NULL OR collection_date <= $2)
         GROUP BY card_code
       ),
       liq AS (
         SELECT card_code, SUM(total) AS importe_liquidado
         FROM liquidaciones
         WHERE doc_date >= $1 AND ($2::date IS NULL OR doc_date <= $2)
         GROUP BY card_code
       ),
       san AS (
         SELECT card_code,
                AVG(celulas) AS celulas,
                AVG(bacterias) AS bacterias,
                COUNT(*) AS muestras_san
         FROM calidad_sanitaria
         WHERE lab_date >= $1 AND ($2::date IS NULL OR lab_date <= $2)
         GROUP BY card_code
       )
       SELECT p.card_code, p.card_name,
              COALESCE(rem.litros, 0) AS litros,
              COALESCE(rem.entregas, 0) AS entregas,
              to_char(rem.ultima_entrega, 'YYYY-MM-DD') AS ultima_entrega,
              COALESCE(rem.importe_remitido, 0) AS importe_remitido,
              cal.grasa, cal.proteina, cal.lactosa, cal.solidos,
              COALESCE(cal.muestras, 0) AS muestras,
              san.celulas, san.bacterias,
              COALESCE(san.muestras_san, 0) AS muestras_san,
              COALESCE(liq.importe_liquidado, 0) AS importe_liquidado
       FROM productores p
       LEFT JOIN rem ON rem.card_code = p.card_code
       LEFT JOIN cal ON cal.card_code = p.card_code
       LEFT JOIN liq ON liq.card_code = p.card_code
       LEFT JOIN san ON san.card_code = p.card_code
       WHERE p.role = 'productor'
       ORDER BY litros DESC`,
      [desde, hasta]
    );

    const calidadGlobalQ = await query(
      `SELECT AVG(fat) AS grasa, AVG(protein) AS proteina,
              AVG(lactose) AS lactosa, AVG(ts) AS solidos
       FROM calidad_composicion
       WHERE collection_date >= $1 AND ($2::date IS NULL OR collection_date <= $2)`,
      [desde, hasta]
    );

    const sanitariaGlobalQ = await query(
      `SELECT AVG(celulas) AS celulas, AVG(bacterias) AS bacterias
       FROM calidad_sanitaria
       WHERE lab_date >= $1 AND ($2::date IS NULL OR lab_date <= $2)`,
      [desde, hasta]
    );

    const recientesQ = await query(
      `SELECT to_char(r.doc_date, 'YYYY-MM-DD') AS doc_date, r.doc_num,
              r.card_code, p.card_name, r.quantity AS litros
       FROM remisiones r
       JOIN productores p ON p.card_code = r.card_code
       ORDER BY r.doc_date DESC, r.doc_entry DESC
       LIMIT 10`
    );

    const productores = productoresQ.rows;
    const num = (v) => Number(v) || 0;
    const g = calidadGlobalQ.rows[0] || {};
    const s = sanitariaGlobalQ.rows[0] || {};

    const kpis = {
      productores_con_datos: productores.filter((p) => num(p.entregas) > 0).length,
      total_litros: productores.reduce((s, p) => s + num(p.litros), 0),
      total_entregas: productores.reduce((s, p) => s + num(p.entregas), 0),
      total_importe_liquidado: productores.reduce((s, p) => s + num(p.importe_liquidado), 0),
      promedio_grasa: g.grasa,
      promedio_proteina: g.proteina,
      promedio_lactosa: g.lactosa,
      promedio_solidos: g.solidos,
      promedio_celulas: s.celulas,
      promedio_bacterias: s.bacterias,
    };

    res.json({
      periodo: { desde, hasta },
      kpis,
      productores,
      recientes: recientesQ.rows,
    });
  } catch (err) {
    console.error('admin dashboard error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// --- Visitas del departamento tecnico (carga manual por el admin) ---

router.get('/visitas', async (req, res) => {
  const cardCode = String(req.query.card_code || '').trim();
  if (!cardCode) {
    return res.status(400).json({ error: 'Falta card_code' });
  }
  try {
    const { rows } = await query(
      `SELECT id,
              to_char(fecha, 'YYYY-MM-DD') AS fecha,
              tema, tecnico, comentarios, accion,
              to_char(proxima_visita, 'YYYY-MM-DD') AS proxima_visita
       FROM visitas_tecnicas
       WHERE card_code = $1
       ORDER BY fecha DESC, id DESC`,
      [cardCode]
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('admin visitas list error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.post('/visitas', async (req, res) => {
  const { card_code, fecha, tema, tecnico, comentarios, accion, proxima_visita } = req.body;

  if (!card_code || !fecha || !tema) {
    return res.status(400).json({ error: 'Faltan card_code, fecha o tema' });
  }
  if (!TEMAS_VISITA.includes(tema)) {
    return res.status(400).json({ error: 'Tema inválido' });
  }

  try {
    const { rows } = await query(
      `INSERT INTO visitas_tecnicas
         (card_code, fecha, tema, tecnico, comentarios, accion, proxima_visita)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        String(card_code).trim(),
        fecha,
        tema,
        tecnico || null,
        comentarios || null,
        accion || null,
        proxima_visita || null,
      ]
    );
    res.json({ ok: true, id: rows[0].id });
  } catch (err) {
    console.error('admin visitas create error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.put('/visitas/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'id inválido' });
  }
  const { fecha, tema, tecnico, comentarios, accion, proxima_visita } = req.body;
  if (!fecha || !tema) {
    return res.status(400).json({ error: 'Faltan fecha o tema' });
  }
  if (!TEMAS_VISITA.includes(tema)) {
    return res.status(400).json({ error: 'Tema inválido' });
  }

  try {
    const { rowCount } = await query(
      `UPDATE visitas_tecnicas
       SET fecha = $2, tema = $3, tecnico = $4, comentarios = $5,
           accion = $6, proxima_visita = $7, updated_at = NOW()
       WHERE id = $1`,
      [
        id,
        fecha,
        tema,
        tecnico || null,
        comentarios || null,
        accion || null,
        proxima_visita || null,
      ]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Visita no encontrada' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('admin visitas update error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.delete('/visitas/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'id inválido' });
  }
  try {
    const { rowCount } = await query('DELETE FROM visitas_tecnicas WHERE id = $1', [id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Visita no encontrada' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('admin visitas delete error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// --- Comunicados a productores (carga manual por el admin) ---

router.get('/comunicados', async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT c.id, c.card_code, p.card_name, c.titulo, c.cuerpo, c.importante,
              to_char(c.created_at, 'YYYY-MM-DD') AS fecha
       FROM comunicados c
       LEFT JOIN productores p ON p.card_code = c.card_code
       ORDER BY c.created_at DESC`
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('admin comunicados list error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.post('/comunicados', async (req, res) => {
  const { card_code, titulo, cuerpo, importante } = req.body;

  if (!titulo || !cuerpo) {
    return res.status(400).json({ error: 'Faltan titulo o cuerpo' });
  }

  const target = card_code ? String(card_code).trim() : null;

  try {
    const { rows } = await query(
      `INSERT INTO comunicados (card_code, titulo, cuerpo, importante)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [target, String(titulo).trim(), String(cuerpo).trim(), Boolean(importante)]
    );
    res.json({ ok: true, id: rows[0].id });
  } catch (err) {
    console.error('admin comunicados create error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.put('/comunicados/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'id inválido' });
  }
  const { card_code, titulo, cuerpo, importante } = req.body;
  if (!titulo || !cuerpo) {
    return res.status(400).json({ error: 'Faltan titulo o cuerpo' });
  }
  const target = card_code ? String(card_code).trim() : null;

  try {
    const { rowCount } = await query(
      `UPDATE comunicados
       SET card_code = $2, titulo = $3, cuerpo = $4, importante = $5, updated_at = NOW()
       WHERE id = $1`,
      [id, target, String(titulo).trim(), String(cuerpo).trim(), Boolean(importante)]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Comunicado no encontrado' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('admin comunicados update error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.delete('/comunicados/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'id inválido' });
  }
  try {
    const { rowCount } = await query('DELETE FROM comunicados WHERE id = $1', [id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Comunicado no encontrado' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('admin comunicados delete error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
