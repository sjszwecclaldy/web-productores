const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { query } = require('../db');
const { generateResetToken } = require('../utils/tokens');
const { sendPasswordResetEmail } = require('../utils/email');

const router = express.Router();
const SALT_ROUNDS = 10;
const JWT_EXPIRY = '7d';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: 'Demasiados intentos. Intente nuevamente más tarde.' });
  },
});

function validatePassword(password) {
  return typeof password === 'string' && password.length >= 8;
}

router.post('/activate', authLimiter, async (req, res) => {
  const { card_code, activation_code, email, password } = req.body;

  if (!card_code || !activation_code || !email || !password) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }
  if (!validatePassword(password)) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedCode = String(card_code).trim();
  const normalizedActivation = String(activation_code).trim().toUpperCase();

  try {
    const { rows } = await query(
      `SELECT id, estado, activation_code, activation_code_expira
       FROM productores WHERE card_code = $1`,
      [normalizedCode]
    );

    if (rows.length === 0 || rows[0].activation_code !== normalizedActivation) {
      return res.status(400).json({ error: 'Código de productor o de activación inválido' });
    }

    const productor = rows[0];

    if (productor.estado === 'activo') {
      return res.status(400).json({ error: 'Esta cuenta ya fue activada' });
    }
    if (productor.estado === 'deshabilitado') {
      return res.status(403).json({ error: 'Cuenta deshabilitada. Contacte a la empresa.' });
    }
    if (productor.activation_code_expira && new Date(productor.activation_code_expira) < new Date()) {
      return res.status(400).json({ error: 'Código de activación expirado. Solicite uno nuevo.' });
    }

    const emailCheck = await query(
      'SELECT id FROM productores WHERE email = $1 AND card_code != $2',
      [normalizedEmail, normalizedCode]
    );
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: 'El email ya está registrado' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    await query(
      `UPDATE productores
       SET email = $1, password_hash = $2, estado = 'activo',
           activation_code = NULL, activation_code_expira = NULL
       WHERE card_code = $3`,
      [normalizedEmail, passwordHash, normalizedCode]
    );

    const token = jwt.sign(
      { sub: productor.id, card_code: normalizedCode, email: normalizedEmail },
      process.env.JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    res.json({ token, card_code: normalizedCode });
  } catch (err) {
    console.error('activate error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  try {
    const { rows } = await query(
      `SELECT id, card_code, card_name, password_hash, estado
       FROM productores WHERE email = $1`,
      [normalizedEmail]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const productor = rows[0];

    if (productor.estado !== 'activo') {
      return res.status(403).json({
        error: productor.estado === 'pendiente_activacion'
          ? 'Cuenta pendiente de activación'
          : 'Cuenta deshabilitada',
      });
    }

    const valid = await bcrypt.compare(password, productor.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    await query('UPDATE productores SET last_login_at = NOW() WHERE id = $1', [productor.id]);

    const token = jwt.sign(
      { sub: productor.id, card_code: productor.card_code, email: normalizedEmail },
      process.env.JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    res.json({
      token,
      card_code: productor.card_code,
      card_name: productor.card_name,
    });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email requerido' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const genericResponse = { message: 'Si el email existe, recibirá instrucciones de recuperación.' };

  try {
    const { rows } = await query(
      "SELECT id FROM productores WHERE email = $1 AND estado = 'activo'",
      [normalizedEmail]
    );

    if (rows.length === 0) {
      return res.json(genericResponse);
    }

    const token = generateResetToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await query(
      'INSERT INTO password_reset_tokens (email, token, expires_at) VALUES ($1, $2, $3)',
      [normalizedEmail, token, expiresAt]
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
    await sendPasswordResetEmail(normalizedEmail, resetUrl);

    res.json(genericResponse);
  } catch (err) {
    console.error('forgot-password error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.post('/reset-password', async (req, res) => {
  const { token, new_password } = req.body;

  if (!token || !new_password) {
    return res.status(400).json({ error: 'Token y nueva contraseña requeridos' });
  }
  if (!validatePassword(new_password)) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  }

  try {
    const { rows } = await query(
      `SELECT id, email, expires_at, used_at
       FROM password_reset_tokens WHERE token = $1`,
      [token]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Token inválido' });
    }

    const resetRow = rows[0];
    if (resetRow.used_at) {
      return res.status(400).json({ error: 'Token ya utilizado' });
    }
    if (new Date(resetRow.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Token expirado' });
    }

    const passwordHash = await bcrypt.hash(new_password, SALT_ROUNDS);

    await query('UPDATE productores SET password_hash = $1 WHERE email = $2', [
      passwordHash,
      resetRow.email,
    ]);
    await query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [resetRow.id]);

    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    console.error('reset-password error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
