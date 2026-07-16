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

  try {
    const { rows } = await query(
      `SELECT to_char(doc_date, 'YYYY-MM-DD') AS doc_date, doc_num, num_at_card, descripcion, line_total
       FROM reliquidaciones
       WHERE ${conditions.join(' AND ')}
       ORDER BY doc_date DESC, doc_num DESC`,
      params
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('reliquidaciones list error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.get('/resumen', async (req, res) => {
  const card_code = resolveCardCode(req);

  try {
    const ultima = await query(
      `SELECT to_char(doc_date, 'YYYY-MM-DD') AS doc_date, doc_num, num_at_card, descripcion, line_total
       FROM reliquidaciones
       WHERE card_code = $1
       ORDER BY doc_date DESC, doc_num DESC
       LIMIT 1`,
      [card_code]
    );

    const totales = await query(
      `SELECT COALESCE(SUM(line_total), 0) AS total_importe,
              COUNT(*) AS reliquidaciones
       FROM reliquidaciones
       WHERE card_code = $1
         AND doc_date >= (CURRENT_DATE - INTERVAL '12 months')`,
      [card_code]
    );

    res.json({
      ultima: ultima.rows[0] || null,
      totales_ultimo_ano: totales.rows[0],
    });
  } catch (err) {
    console.error('reliquidaciones resumen error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
