CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS productores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_code TEXT UNIQUE NOT NULL,
  card_name TEXT NOT NULL,
  email TEXT UNIQUE,
  password_hash TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente_activacion'
    CHECK (estado IN ('pendiente_activacion', 'activo', 'deshabilitado')),
  activation_code TEXT,
  activation_code_expira TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS calidad_composicion (
  id SERIAL PRIMARY KEY,
  card_code TEXT NOT NULL,
  collection_date DATE NOT NULL,
  job_name TEXT NOT NULL DEFAULT '',
  job_type TEXT,
  product TEXT,
  sub INT NOT NULL,
  fat NUMERIC,
  protein NUMERIC,
  lactose NUMERIC,
  ts NUMERIC,
  fpd NUMERIC,
  casein NUMERIC,
  urea NUMERIC,
  remarks TEXT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (card_code, collection_date, job_name, sub)
);

CREATE INDEX IF NOT EXISTS idx_calidad_card_date
  ON calidad_composicion (card_code, collection_date DESC);

CREATE TABLE IF NOT EXISTS sync_log (
  id SERIAL PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  records_fetched INT NOT NULL DEFAULT 0,
  records_upserted INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('ok', 'error')),
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens (token);
