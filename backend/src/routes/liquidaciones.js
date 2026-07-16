const express = require('express');
const { query } = require('../db');
const { requireJwt, resolveCardCode } = require('../middleware/auth');

const router = express.Router();

router.use(requireJwt);

const REAL = '(COALESCE(cantidad, 0) <> 0 OR COALESCE(total, 0) <> 0)';

router.get('/', async (req, res) => {
  const card_code = resolveCardCode(req);
  const { from, to } = req.query;

  const conditions = ['card_code = $1', REAL];
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
      `SELECT to_char(doc_date, 'YYYY-MM-DD') AS doc_date, num_at_card, item_code,
              cantidad, total, imeba, inia, aftosa_usd, enferm_usd
       FROM liquidaciones
       WHERE ${conditions.join(' AND ')}
       ORDER BY doc_date DESC, num_at_card DESC`,
      params
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('liquidaciones list error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.get('/resumen', async (req, res) => {
  const card_code = resolveCardCode(req);

  try {
    const ultima = await query(
      `SELECT to_char(doc_date, 'YYYY-MM-DD') AS doc_date, num_at_card, item_code,
              cantidad, total, imeba, inia, aftosa_usd, enferm_usd
       FROM liquidaciones
       WHERE card_code = $1 AND ${REAL}
       ORDER BY doc_date DESC, num_at_card DESC
       LIMIT 1`,
      [card_code]
    );

    const totales = await query(
      `SELECT COALESCE(SUM(cantidad), 0) AS total_litros,
              COALESCE(SUM(total), 0) AS total_importe,
              COUNT(*) AS liquidaciones
       FROM liquidaciones
       WHERE card_code = $1 AND ${REAL}
         AND doc_date >= (CURRENT_DATE - INTERVAL '12 months')`,
      [card_code]
    );

    res.json({
      ultima: ultima.rows[0] || null,
      totales_ultimo_ano: totales.rows[0],
    });
  } catch (err) {
    console.error('liquidaciones resumen error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
