const express = require('express');
const { query } = require('../db');
const { requireJwt, resolveCardCode } = require('../middleware/auth');

const router = express.Router();

router.use(requireJwt);

router.get('/', async (req, res) => {
  const card_code = resolveCardCode(req);

  try {
    const { rows } = await query(
      `SELECT to_char(venc_refre, 'YYYY-MM-DD') AS venc_refre,
              card_name, email, phone, dicose, valid_for, group_code
       FROM vencimientos
       WHERE card_code = $1`,
      [card_code]
    );
    res.json({ data: rows[0] || null });
  } catch (err) {
    console.error('vencimientos get error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
