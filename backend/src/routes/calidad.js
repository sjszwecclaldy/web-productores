const express = require('express');
const { query } = require('../db');
const { requireJwt } = require('../middleware/auth');

const router = express.Router();

router.use(requireJwt);

router.get('/', async (req, res) => {
  const { card_code } = req.user;
  const { from, to } = req.query;

  const conditions = ['card_code = $1'];
  const params = [card_code];
  let paramIndex = 2;

  if (from) {
    conditions.push(`collection_date >= $${paramIndex++}`);
    params.push(from);
  }
  if (to) {
    conditions.push(`collection_date <= $${paramIndex++}`);
    params.push(to);
  }

  try {
    const { rows } = await query(
      `SELECT collection_date, job_name, job_type, product, sub,
              fat, protein, lactose, ts, fpd, casein, urea, remarks
       FROM calidad_composicion
       WHERE ${conditions.join(' AND ')}
       ORDER BY collection_date DESC, sub ASC`,
      params
    );

    res.json({ data: rows });
  } catch (err) {
    console.error('calidad list error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.get('/resumen', async (req, res) => {
  const { card_code } = req.user;

  try {
    const ultimo = await query(
      `SELECT collection_date, job_name, sub,
              fat, protein, lactose, ts, fpd, casein, urea, remarks
       FROM calidad_composicion
       WHERE card_code = $1
       ORDER BY collection_date DESC, sub ASC
       LIMIT 1`,
      [card_code]
    );

    const promedios = await query(
      `SELECT
         AVG(fat) AS fat,
         AVG(protein) AS protein,
         AVG(lactose) AS lactose,
         AVG(ts) AS ts,
         AVG(fpd) AS fpd,
         AVG(casein) AS casein,
         AVG(urea) AS urea,
         COUNT(*) AS muestras
       FROM calidad_composicion
       WHERE card_code = $1
         AND collection_date >= (CURRENT_DATE - INTERVAL '30 days')`,
      [card_code]
    );

    res.json({
      ultimo: ultimo.rows[0] || null,
      promedio_ultimo_mes: promedios.rows[0]?.muestras > 0 ? promedios.rows[0] : null,
    });
  } catch (err) {
    console.error('calidad resumen error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
