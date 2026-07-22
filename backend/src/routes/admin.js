const express = require('express');
const multer = require('multer');
const { query } = require('../db');
const { requireJwt, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Subida en memoria para adjuntos de comunicados (Word/PDF), guardados como BYTEA. Tope 10 MB.
const uploadComunicado = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

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
  const grupoId = Number.isInteger(parseInt(req.query.grupo_id, 10)) ? parseInt(req.query.grupo_id, 10) : null;

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
           AND canceled IS DISTINCT FROM 'Y'
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
         AND ($3::int IS NULL OR p.card_code IN (SELECT card_code FROM grupo_productores WHERE grupo_id = $3))
       ORDER BY litros DESC`,
      [desde, hasta, grupoId]
    );

    const productores = productoresQ.rows;
    const num = (v) => Number(v) || 0;
    // Promedios de calidad calculados sobre el grupo filtrado (promedio de promedios por productor).
    const avgOf = (key) => {
      const vals = productores.map((p) => p[key]).filter((v) => v != null).map(Number);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };

    const kpis = {
      productores_con_datos: productores.filter((p) => num(p.entregas) > 0).length,
      total_litros: productores.reduce((s, p) => s + num(p.litros), 0),
      total_entregas: productores.reduce((s, p) => s + num(p.entregas), 0),
      total_importe_liquidado: productores.reduce((s, p) => s + num(p.importe_liquidado), 0),
      promedio_grasa: avgOf('grasa'),
      promedio_proteina: avgOf('proteina'),
      promedio_lactosa: avgOf('lactosa'),
      promedio_solidos: avgOf('solidos'),
      promedio_celulas: avgOf('celulas'),
      promedio_bacterias: avgOf('bacterias'),
    };

    res.json({
      periodo: { desde, hasta },
      kpis,
      productores,
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
              c.archivo_nombre, (c.archivo IS NOT NULL) AS tiene_archivo,
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

function toBool(v) {
  return v === true || v === 'true' || v === '1';
}

router.post('/comunicados', uploadComunicado.single('archivo'), async (req, res) => {
  const { card_code, titulo, cuerpo, importante } = req.body;

  if (!titulo || !String(titulo).trim()) {
    return res.status(400).json({ error: 'Falta el título' });
  }

  const target = card_code ? String(card_code).trim() : null;
  const cuerpoVal = cuerpo && String(cuerpo).trim() ? String(cuerpo).trim() : null;
  const file = req.file;

  if (!cuerpoVal && !file) {
    return res.status(400).json({ error: 'Agregá un mensaje o un archivo adjunto' });
  }

  try {
    const { rows } = await query(
      `INSERT INTO comunicados
         (card_code, titulo, cuerpo, importante, archivo, archivo_nombre, archivo_tipo)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        target,
        String(titulo).trim(),
        cuerpoVal,
        toBool(importante),
        file ? file.buffer : null,
        file ? file.originalname : null,
        file ? file.mimetype : null,
      ]
    );
    res.json({ ok: true, id: rows[0].id });
  } catch (err) {
    console.error('admin comunicados create error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.put('/comunicados/:id', uploadComunicado.single('archivo'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'id inválido' });
  }
  const { card_code, titulo, cuerpo, importante } = req.body;
  if (!titulo || !String(titulo).trim()) {
    return res.status(400).json({ error: 'Falta el título' });
  }
  const target = card_code ? String(card_code).trim() : null;
  const cuerpoVal = cuerpo && String(cuerpo).trim() ? String(cuerpo).trim() : null;
  const file = req.file;

  try {
    let result;
    if (file) {
      result = await query(
        `UPDATE comunicados
         SET card_code = $2, titulo = $3, cuerpo = $4, importante = $5,
             archivo = $6, archivo_nombre = $7, archivo_tipo = $8, updated_at = NOW()
         WHERE id = $1`,
        [id, target, String(titulo).trim(), cuerpoVal, toBool(importante), file.buffer, file.originalname, file.mimetype]
      );
    } else {
      result = await query(
        `UPDATE comunicados
         SET card_code = $2, titulo = $3, cuerpo = $4, importante = $5, updated_at = NOW()
         WHERE id = $1`,
        [id, target, String(titulo).trim(), cuerpoVal, toBool(importante)]
      );
    }
    if (result.rowCount === 0) {
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

// --- Reglas de control ex-post (filtros) ---

const INDICADORES_VALIDOS = ['litros', 'grasa', 'proteina', 'celulas', 'bacterias'];
const DIRECCIONES_VALIDAS = ['arriba', 'abajo', 'ambos'];
const TIPOS_VALIDOS = ['desvio', 'intervalo'];

// Valida y normaliza el cuerpo de una regla (desvio o intervalo).
function parseReglaBody(body) {
  const { indicador, ventana_dias, umbral_pct, direccion, activa } = body || {};
  if (!INDICADORES_VALIDOS.includes(indicador)) {
    return { error: 'Indicador inválido' };
  }
  const tipo = TIPOS_VALIDOS.includes(body?.tipo) ? body.tipo : 'desvio';

  if (tipo === 'intervalo') {
    const min = body.limite_min === '' || body.limite_min == null ? null : Number(body.limite_min);
    const max = body.limite_max === '' || body.limite_max == null ? null : Number(body.limite_max);
    if ((min != null && !Number.isFinite(min)) || (max != null && !Number.isFinite(max))) {
      return { error: 'Límites inválidos' };
    }
    if (min == null && max == null) {
      return { error: 'Definí al menos un límite (mínimo o máximo)' };
    }
    if (min != null && max != null && min > max) {
      return { error: 'El mínimo no puede ser mayor que el máximo' };
    }
    // ventana/umbral/direccion quedan con valores por defecto para intervalo.
    return { value: { indicador, ventana: 4, umbral: 0, dir: 'ambos', activa: activa !== false, tipo, min, max } };
  }

  // tipo 'desvio'
  const dir = DIRECCIONES_VALIDAS.includes(direccion) ? direccion : 'arriba';
  const ventana = parseInt(ventana_dias, 10);
  const umbral = Number(umbral_pct);
  if (!Number.isInteger(ventana) || ventana < 1 || !Number.isFinite(umbral) || umbral <= 0) {
    return { error: 'Ventana o umbral inválidos' };
  }
  return { value: { indicador, ventana, umbral, dir, activa: activa !== false, tipo, min: null, max: null } };
}

router.get('/control-reglas', async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, indicador, ventana_dias, umbral_pct, direccion, activa,
              tipo, limite_min, limite_max
       FROM control_reglas ORDER BY indicador ASC, id ASC`
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('control-reglas list error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.post('/control-reglas', async (req, res) => {
  const parsed = parseReglaBody(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const p = parsed.value;
  try {
    const { rows } = await query(
      `INSERT INTO control_reglas (indicador, ventana_dias, umbral_pct, direccion, activa, tipo, limite_min, limite_max)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [p.indicador, p.ventana, p.umbral, p.dir, p.activa, p.tipo, p.min, p.max]
    );
    res.json({ ok: true, id: rows[0].id });
  } catch (err) {
    console.error('control-reglas create error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.put('/control-reglas/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'id inválido' });
  const parsed = parseReglaBody(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const p = parsed.value;
  try {
    const { rowCount } = await query(
      `UPDATE control_reglas
       SET indicador = $2, ventana_dias = $3, umbral_pct = $4, direccion = $5, activa = $6,
           tipo = $7, limite_min = $8, limite_max = $9, updated_at = NOW()
       WHERE id = $1`,
      [id, p.indicador, p.ventana, p.umbral, p.dir, p.activa, p.tipo, p.min, p.max]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Regla no encontrada' });
    res.json({ ok: true });
  } catch (err) {
    console.error('control-reglas update error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.delete('/control-reglas/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'id inválido' });
  try {
    const { rowCount } = await query('DELETE FROM control_reglas WHERE id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Regla no encontrada' });
    res.json({ ok: true });
  } catch (err) {
    console.error('control-reglas delete error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// --- Notificaciones (avisos de datos atípicos) ---

router.get('/notificaciones', async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, card_code, card_name, indicador, to_char(fecha, 'YYYY-MM-DD') AS fecha,
              valor, promedio, desvio_pct, direccion, mensaje, leida,
              to_char(created_at, 'YYYY-MM-DD HH24:MI') AS creado
       FROM notificaciones
       ORDER BY fecha DESC, created_at DESC
       LIMIT 200`
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('notificaciones list error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.post('/notificaciones/:id/leer', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'id inválido' });
  try {
    await query('UPDATE notificaciones SET leida = TRUE WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('notificaciones leer error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.delete('/notificaciones/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'id inválido' });
  try {
    await query('DELETE FROM notificaciones WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('notificaciones delete error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.post('/notificaciones/eliminar', async (req, res) => {
  const ids = Array.isArray(req.body?.ids)
    ? req.body.ids.map((x) => parseInt(x, 10)).filter(Number.isInteger)
    : [];
  if (ids.length === 0) return res.status(400).json({ error: 'Sin ids' });
  try {
    await query('DELETE FROM notificaciones WHERE id = ANY($1)', [ids]);
    res.json({ ok: true });
  } catch (err) {
    console.error('notificaciones bulk delete error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.post('/notificaciones/leer', async (req, res) => {
  const ids = Array.isArray(req.body?.ids)
    ? req.body.ids.map((x) => parseInt(x, 10)).filter(Number.isInteger)
    : [];
  if (ids.length === 0) return res.status(400).json({ error: 'Sin ids' });
  try {
    await query('UPDATE notificaciones SET leida = TRUE WHERE id = ANY($1)', [ids]);
    res.json({ ok: true });
  } catch (err) {
    console.error('notificaciones bulk read error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// --- Grupos personalizados (Comparativa) ---

router.get('/grupos', async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT g.id, g.nombre,
              COALESCE(array_agg(gp.card_code ORDER BY gp.card_code) FILTER (WHERE gp.card_code IS NOT NULL), '{}') AS card_codes
       FROM grupos g
       LEFT JOIN grupo_productores gp ON gp.grupo_id = g.id
       GROUP BY g.id
       ORDER BY g.nombre ASC`
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('grupos list error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.post('/grupos', async (req, res) => {
  const nombre = String(req.body?.nombre || '').trim();
  if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });
  try {
    const { rows } = await query('INSERT INTO grupos (nombre) VALUES ($1) RETURNING id', [nombre]);
    res.json({ ok: true, id: rows[0].id });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un grupo con ese nombre' });
    console.error('grupos create error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.put('/grupos/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'id inválido' });
  const nombre = String(req.body?.nombre || '').trim();
  if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });
  const cardCodes = Array.isArray(req.body?.card_codes)
    ? req.body.card_codes.map((c) => String(c).trim()).filter(Boolean)
    : [];
  try {
    const upd = await query('UPDATE grupos SET nombre = $2 WHERE id = $1', [id, nombre]);
    if (upd.rowCount === 0) return res.status(404).json({ error: 'Grupo no encontrado' });
    await query('DELETE FROM grupo_productores WHERE grupo_id = $1', [id]);
    if (cardCodes.length > 0) {
      await query(
        `INSERT INTO grupo_productores (grupo_id, card_code)
         SELECT $1, cc FROM unnest($2::text[]) AS cc
         ON CONFLICT DO NOTHING`,
        [id, cardCodes]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un grupo con ese nombre' });
    console.error('grupos update error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.delete('/grupos/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'id inválido' });
  try {
    const { rowCount } = await query('DELETE FROM grupos WHERE id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Grupo no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error('grupos delete error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// Series mensuales para las gráficas de la Comparativa, filtradas por grupo (o todos).
router.get('/comparativa-series', async (req, res) => {
  const desde = req.query.desde || defaultDesde();
  const hasta = req.query.hasta || null;
  const grupoId = Number.isInteger(parseInt(req.query.grupo_id, 10)) ? parseInt(req.query.grupo_id, 10) : null;
  const p = [desde, hasta, grupoId];

  // Filtro de grupo sobre la tabla `t` (alias). Cada dato viene desglosado por productor.
  const grupoClause =
    '($3::int IS NULL OR t.card_code IN (SELECT card_code FROM grupo_productores WHERE grupo_id = $3))';

  // Devuelve filas [{ mes, card_code, card_name, valor }] por productor.
  const serie = async (sql) =>
    (await query(sql, p)).rows.map((r) => ({
      mes: r.mes,
      card_code: r.card_code,
      card_name: r.card_name || r.card_code,
      valor: r.valor != null ? Number(r.valor) : null,
    }));

  try {
    const litros = await serie(
      `SELECT to_char(t.doc_date, 'YYYY-MM') AS mes, t.card_code, pr.card_name, SUM(t.quantity) AS valor
       FROM remisiones t JOIN productores pr ON pr.card_code = t.card_code
       WHERE t.doc_date >= $1 AND ($2::date IS NULL OR t.doc_date <= $2) AND ${grupoClause}
         AND t.canceled IS DISTINCT FROM 'Y'
       GROUP BY 1, t.card_code, pr.card_name ORDER BY 1, pr.card_name`
    );
    const celulas = await serie(
      `SELECT to_char(t.lab_date, 'YYYY-MM') AS mes, t.card_code, pr.card_name, AVG(t.celulas) AS valor
       FROM calidad_sanitaria t JOIN productores pr ON pr.card_code = t.card_code
       WHERE t.lab_date >= $1 AND ($2::date IS NULL OR t.lab_date <= $2) AND ${grupoClause}
       GROUP BY 1, t.card_code, pr.card_name ORDER BY 1, pr.card_name`
    );
    const bacterias = await serie(
      `SELECT to_char(t.lab_date, 'YYYY-MM') AS mes, t.card_code, pr.card_name, AVG(t.bacterias) AS valor
       FROM calidad_sanitaria t JOIN productores pr ON pr.card_code = t.card_code
       WHERE t.lab_date >= $1 AND ($2::date IS NULL OR t.lab_date <= $2) AND ${grupoClause}
       GROUP BY 1, t.card_code, pr.card_name ORDER BY 1, pr.card_name`
    );
    const liquidacion_bruta = await serie(
      `SELECT to_char(t.doc_date, 'YYYY-MM') AS mes, t.card_code, pr.card_name, SUM(t.total) AS valor
       FROM liquidaciones t JOIN productores pr ON pr.card_code = t.card_code
       WHERE t.doc_date >= $1 AND ($2::date IS NULL OR t.doc_date <= $2) AND ${grupoClause}
       GROUP BY 1, t.card_code, pr.card_name ORDER BY 1, pr.card_name`
    );
    res.json({ periodo: { desde, hasta }, series: { litros, celulas, bacterias, liquidacion_bruta } });
  } catch (err) {
    console.error('comparativa-series error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
