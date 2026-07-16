const jwt = require('jsonwebtoken');

function requireJwt(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  try {
    const token = header.slice(7);
    req.user = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso restringido a administradores' });
  }
  next();
}

// Devuelve el card_code objetivo de la consulta.
// Solo un admin puede redirigir la consulta a otro productor vía ?card_code=...
// Para cualquier otro usuario se usa SIEMPRE su propio card_code del JWT.
function resolveCardCode(req) {
  if (req.user && req.user.role === 'admin' && req.query.card_code) {
    return String(req.query.card_code).trim();
  }
  return req.user.card_code;
}

module.exports = { requireJwt, requireAdmin, resolveCardCode };
