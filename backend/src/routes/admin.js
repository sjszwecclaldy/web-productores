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

module.exports = router;
