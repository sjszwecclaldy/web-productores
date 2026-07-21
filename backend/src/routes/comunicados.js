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
              archivo_nombre, (archivo IS NOT NULL) AS tiene_archivo,
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

// Descarga del adjunto (Word/PDF). Solo si el comunicado es visible para el productor.
router.get('/:id/archivo', async (req, res) => {
  const card_code = resolveCardCode(req);
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'id inválido' });
  }
  try {
    const { rows } = await query(
      `SELECT archivo, archivo_nombre, archivo_tipo
       FROM comunicados
       WHERE id = $1 AND (card_code IS NULL OR card_code = $2)`,
      [id, card_code]
    );
    const c = rows[0];
    if (!c || !c.archivo) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }
    const nombre = (c.archivo_nombre || 'comunicado').replace(/"/g, '');
    res.setHeader('Content-Type', c.archivo_tipo || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    res.send(c.archivo);
  } catch (err) {
    console.error('comunicado archivo error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
