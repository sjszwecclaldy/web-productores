const express = require('express');
const { query } = require('../db');
const { requireJwt, resolveCardCode } = require('../middleware/auth');

const router = express.Router();

router.use(requireJwt);

router.get('/', async (req, res) => {
  const card_code = resolveCardCode(req);
  const { from, to } = req.query;

  const conditions = ['card_code = $1'];
  const params = [card_code];
  let paramIndex = 2;

  if (from) {
    conditions.push(`doc_date >= $${paramIndex++}`);
    params.push(from);
  }
  if (to) {
    conditions.push(`doc_date <= $${paramIndex++}`);
    params.push(to);
  }

  // Nunca mostrar remitos cancelados (CANCELED = 'Y' en SAP).
  conditions.push("canceled IS DISTINCT FROM 'Y'");

  try {
    const { rows } = await query(
      `SELECT to_char(doc_date, 'YYYY-MM-DD') AS doc_date, doc_num, item_code, descripcion,
              quantity, price, line_total, temperatura, antibiotico
       FROM remisiones
       WHERE ${conditions.join(' AND ')}
       ORDER BY doc_date DESC, doc_entry DESC, line_num ASC`,
      params
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('remisiones list error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.get('/resumen', async (req, res) => {
  const card_code = resolveCardCode(req);

  try {
    const ultimo = await query(
      `SELECT to_char(doc_date, 'YYYY-MM-DD') AS doc_date, doc_num, item_code, descripcion,
              quantity, price, line_total, temperatura, antibiotico
       FROM remisiones
       WHERE card_code = $1 AND canceled IS DISTINCT FROM 'Y'
       ORDER BY doc_date DESC, doc_entry DESC, line_num ASC
       LIMIT 1`,
      [card_code]
    );

    const totales = await query(
      `SELECT COALESCE(SUM(quantity), 0) AS total_litros,
              COALESCE(SUM(line_total), 0) AS total_importe,
              COUNT(*) AS entregas
       FROM remisiones
       WHERE card_code = $1
         AND canceled IS DISTINCT FROM 'Y'
         AND doc_date >= (CURRENT_DATE - INTERVAL '30 days')`,
      [card_code]
    );

    res.json({
      ultimo: ultimo.rows[0] || null,
      totales_ultimo_mes: totales.rows[0],
    });
  } catch (err) {
    console.error('remisiones resumen error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
