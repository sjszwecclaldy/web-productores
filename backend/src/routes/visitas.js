const express = require('express');
const { query } = require('../db');
const { requireJwt, resolveCardCode } = require('../middleware/auth');

const router = express.Router();

router.use(requireJwt);

// Lectura para el productor (o admin con ?card_code=...). Filtros opcionales: from, to, tema.
router.get('/', async (req, res) => {
  const card_code = resolveCardCode(req);
  const { from, to, tema } = req.query;

  const conditions = ['card_code = $1'];
  const params = [card_code];
  let i = 2;

  if (from) {
    conditions.push(`fecha >= $${i++}`);
    params.push(from);
  }
  if (to) {
    conditions.push(`fecha <= $${i++}`);
    params.push(to);
  }
  if (tema) {
    conditions.push(`tema = $${i++}`);
    params.push(tema);
  }

  try {
    const { rows } = await query(
      `SELECT id,
              to_char(fecha, 'YYYY-MM-DD') AS fecha,
              tema, tecnico, comentarios, accion,
              to_char(proxima_visita, 'YYYY-MM-DD') AS proxima_visita
       FROM visitas_tecnicas
       WHERE ${conditions.join(' AND ')}
       ORDER BY fecha DESC, id DESC`,
      params
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('visitas list error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
