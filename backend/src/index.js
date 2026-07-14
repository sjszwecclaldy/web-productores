require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { pool } = require('./db');
const authRoutes = require('./routes/auth');
const calidadRoutes = require('./routes/calidad');
const internalRoutes = require('./routes/internal');

const app = express();
const PORT = process.env.PORT || 3000;

const requiredEnv = ['DATABASE_URL', 'JWT_SECRET', 'INGEST_API_KEY', 'FRONTEND_URL'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Variable de entorno requerida: ${key}`);
    process.exit(1);
  }
}

const allowedOrigins = process.env.FRONTEND_URL.split(',').map((s) => s.trim()).filter(Boolean);

app.use(cors({
  origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
}));
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRoutes);
app.use('/api/calidad-composicion', calidadRoutes);
app.use('/internal', internalRoutes);

async function runMigrations() {
  const schemaPath = path.join(__dirname, '..', 'sql', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(sql);
  console.log('Esquema de base de datos verificado.');
}

app.listen(PORT, async () => {
  try {
    await runMigrations();
    console.log(`Backend escuchando en puerto ${PORT}`);
  } catch (err) {
    console.error('Error al iniciar:', err);
    process.exit(1);
  }
});
