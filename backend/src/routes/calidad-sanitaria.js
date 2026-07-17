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
    conditions.push(`lab_date >= $${paramIndex++}`);
    params.push(from);
  }
  if (to) {
    conditions.push(`lab_date <= $${paramIndex++}`);
    params.push(to);
  }

  try {
    const { rows } = await query(
      `SELECT to_char(lab_date, 'YYYY-MM-DD') AS lab_date, celulas, bacterias, origen
       FROM calidad_sanitaria
       WHERE ${conditions.join(' AND ')}
       ORDER BY lab_date DESC`,
      params
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('calidad-sanitaria list error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.get('/resumen', async (req, res) => {
  const card_code = resolveCardCode(req);

  try {
    const ultima = await query(
      `SELECT to_char(lab_date, 'YYYY-MM-DD') AS lab_date, celulas, bacterias, origen
       FROM calidad_sanitaria
       WHERE card_code = $1
       ORDER BY lab_date DESC
       LIMIT 1`,
      [card_code]
    );

    res.json({ ultima: ultima.rows[0] || null });
  } catch (err) {
    console.error('calidad-sanitaria resumen error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
