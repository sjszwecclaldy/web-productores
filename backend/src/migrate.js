require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

async function migrate() {
  const schemaPath = path.join(__dirname, '..', 'sql', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(sql);
  console.log('Migración completada.');
  await pool.end();
}

migrate().catch((err) => {
  console.error('Error en migración:', err);
  process.exit(1);
});
