function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key || key !== process.env.INGEST_API_KEY) {
    return res.status(401).json({ error: 'API key inválida' });
  }
  next();
}

module.exports = { requireApiKey };
