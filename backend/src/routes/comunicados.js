const express = require('express');
const { query } = require('../db');
const { requireJwt, resolveCardCode } = require('../middleware/auth');

const router = express.Router();

router.use(requireJwt);

// Comunicados visibles para el productor: los de difusion (card_code NULL) mas los dirigidos a el.
router.get('/', async (req, res) => {
  const card_code = resolveCardCode(req);
  try {
    const { rows } = await query(
      `SELECT id, titulo, cuerpo, importante,
              (card_code IS NOT NULL) AS dirigido,
              to_char(created_at, 'YYYY-MM-DD') AS fecha
       FROM comunicados
       WHERE card_code IS NULL OR card_code = $1
       ORDER BY importante DESC, created_at DESC`,
      [card_code]
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('comunicados list error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
