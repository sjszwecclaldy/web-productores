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

ALTER TABLE productores ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'productor'
  CHECK (role IN ('productor', 'admin'));

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

CREATE TABLE IF NOT EXISTS remisiones (
  id SERIAL PRIMARY KEY,
  card_code TEXT NOT NULL,
  card_name TEXT,
  doc_entry INTEGER NOT NULL,
  line_num INTEGER NOT NULL,
  doc_num INTEGER,
  doc_date DATE NOT NULL,
  doc_due_date DATE,
  item_code TEXT,
  descripcion TEXT,
  quantity NUMERIC,
  price NUMERIC,
  line_total NUMERIC,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (doc_entry, line_num)
);

CREATE INDEX IF NOT EXISTS idx_remisiones_card_date
  ON remisiones (card_code, doc_date DESC);

CREATE TABLE IF NOT EXISTS liquidaciones (
  id SERIAL PRIMARY KEY,
  card_code TEXT NOT NULL,
  group_code TEXT,
  doc_date DATE NOT NULL,
  num_at_card TEXT NOT NULL DEFAULT '',
  item_code TEXT NOT NULL DEFAULT '',
  cantidad NUMERIC,
  total NUMERIC,
  imeba NUMERIC,
  inia NUMERIC,
  aftosa_usd NUMERIC,
  enferm_usd NUMERIC,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (card_code, doc_date, item_code, num_at_card)
);

CREATE INDEX IF NOT EXISTS idx_liquidaciones_card_date
  ON liquidaciones (card_code, doc_date DESC);

CREATE TABLE IF NOT EXISTS reliquidaciones (
  id SERIAL PRIMARY KEY,
  card_code TEXT NOT NULL,
  doc_num INTEGER NOT NULL,
  num_at_card TEXT,
  doc_date DATE NOT NULL,
  descripcion TEXT,
  line_total NUMERIC,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (card_code, doc_num)
);

CREATE INDEX IF NOT EXISTS idx_reliquidaciones_card_date
  ON reliquidaciones (card_code, doc_date DESC);

CREATE TABLE IF NOT EXISTS calidad_sanitaria (
  id SERIAL PRIMARY KEY,
  card_code TEXT NOT NULL,
  lab_date DATE NOT NULL,
  celulas NUMERIC,
  bacterias NUMERIC,
  origen TEXT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (card_code, lab_date)
);

CREATE INDEX IF NOT EXISTS idx_calidad_sanitaria_card_date
  ON calidad_sanitaria (card_code, lab_date DESC);

CREATE TABLE IF NOT EXISTS sync_log (
  id SERIAL PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  records_fetched INT NOT NULL DEFAULT 0,
  records_upserted INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('ok', 'error')),
  error_message TEXT
);

ALTER TABLE sync_log ADD COLUMN IF NOT EXISTS domain TEXT NOT NULL DEFAULT 'calidad_composicion';

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens (token);

CREATE TABLE IF NOT EXISTS visitas_tecnicas (
  id SERIAL PRIMARY KEY,
  card_code TEXT NOT NULL,
  fecha DATE NOT NULL,
  tema TEXT NOT NULL,
  tecnico TEXT,
  comentarios TEXT,
  accion TEXT,
  proxima_visita DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visitas_card_fecha ON visitas_tecnicas (card_code, fecha DESC);

CREATE TABLE IF NOT EXISTS comunicados (
  id SERIAL PRIMARY KEY,
  card_code TEXT,
  titulo TEXT NOT NULL,
  cuerpo TEXT NOT NULL,
  importante BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comunicados_card ON comunicados (card_code);
CREATE INDEX IF NOT EXISTS idx_comunicados_created ON comunicados (created_at DESC);

ALTER TABLE comunicados ADD COLUMN IF NOT EXISTS archivo BYTEA;
ALTER TABLE comunicados ADD COLUMN IF NOT EXISTS archivo_nombre TEXT;
ALTER TABLE comunicados ADD COLUMN IF NOT EXISTS archivo_tipo TEXT;
ALTER TABLE comunicados ALTER COLUMN cuerpo DROP NOT NULL;
