const express = require('express');
const { query } = require('../db');
const { requireJwt, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(requireJwt);
router.use(requireAdmin);

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
       )
       SELECT p.card_code, p.card_name,
              COALESCE(rem.litros, 0) AS litros,
              COALESCE(rem.entregas, 0) AS entregas,
              to_char(rem.ultima_entrega, 'YYYY-MM-DD') AS ultima_entrega,
              COALESCE(rem.importe_remitido, 0) AS importe_remitido,
              cal.grasa, cal.proteina, cal.lactosa, cal.solidos,
              COALESCE(cal.muestras, 0) AS muestras,
              COALESCE(liq.importe_liquidado, 0) AS importe_liquidado
       FROM productores p
       LEFT JOIN rem ON rem.card_code = p.card_code
       LEFT JOIN cal ON cal.card_code = p.card_code
       LEFT JOIN liq ON liq.card_code = p.card_code
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

    const kpis = {
      productores_con_datos: productores.filter((p) => num(p.entregas) > 0).length,
      total_litros: productores.reduce((s, p) => s + num(p.litros), 0),
      total_entregas: productores.reduce((s, p) => s + num(p.entregas), 0),
      total_importe_liquidado: productores.reduce((s, p) => s + num(p.importe_liquidado), 0),
      promedio_grasa: g.grasa,
      promedio_proteina: g.proteina,
      promedio_lactosa: g.lactosa,
      promedio_solidos: g.solidos,
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

module.exports = router;
