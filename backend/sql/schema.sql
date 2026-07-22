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

-- Columnas provenientes de la vista REMCOMPLETO (reemplaza REMISION)
ALTER TABLE remisiones ADD COLUMN IF NOT EXISTS temperatura NUMERIC;
ALTER TABLE remisiones ADD COLUMN IF NOT EXISTS antibiotico TEXT;
ALTER TABLE remisiones ADD COLUMN IF NOT EXISTS canceled TEXT;

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

-- Desglose de importe neto (vista RELIQUIDACION): retencion = Total_WTAmnt, neto = LineTotal_Neto.
ALTER TABLE reliquidaciones ADD COLUMN IF NOT EXISTS retencion NUMERIC;
ALTER TABLE reliquidaciones ADD COLUMN IF NOT EXISTS neto NUMERIC;

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

-- Vencimiento de refrendación (vista SAP VENCIMIENTO). Un registro por productor.
CREATE TABLE IF NOT EXISTS vencimientos (
  id SERIAL PRIMARY KEY,
  card_code TEXT NOT NULL,
  card_name TEXT,
  email TEXT,
  phone TEXT,
  venc_refre DATE,
  dicose BIGINT,
  valid_for TEXT,
  group_code INTEGER,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (card_code)
);

CREATE INDEX IF NOT EXISTS idx_vencimientos_venc ON vencimientos (venc_refre);

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

CREATE TABLE IF NOT EXISTS control_reglas (
  id SERIAL PRIMARY KEY,
  indicador TEXT NOT NULL,
  ventana_dias INT NOT NULL DEFAULT 4,
  umbral_pct NUMERIC NOT NULL DEFAULT 15,
  direccion TEXT NOT NULL DEFAULT 'arriba',
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tipo de regla: 'desvio' (vs promedio) o 'intervalo' (rango de aceptacion).
ALTER TABLE control_reglas ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'desvio';
ALTER TABLE control_reglas ADD COLUMN IF NOT EXISTS limite_min NUMERIC;
ALTER TABLE control_reglas ADD COLUMN IF NOT EXISTS limite_max NUMERIC;

CREATE TABLE IF NOT EXISTS notificaciones (
  id SERIAL PRIMARY KEY,
  card_code TEXT NOT NULL,
  card_name TEXT,
  indicador TEXT NOT NULL,
  fecha DATE NOT NULL,
  valor NUMERIC,
  promedio NUMERIC,
  desvio_pct NUMERIC,
  direccion TEXT,
  regla_id INT,
  mensaje TEXT,
  leida BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (card_code, indicador, fecha)
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_created ON notificaciones (created_at DESC);

-- Grupos personalizados para la Comparativa (editables desde la web).
CREATE TABLE IF NOT EXISTS grupos (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS grupo_productores (
  grupo_id INT NOT NULL REFERENCES grupos(id) ON DELETE CASCADE,
  card_code TEXT NOT NULL,
  PRIMARY KEY (grupo_id, card_code)
);

-- Siembra idempotente de grupos (solo inserta si el nombre no existe).

INSERT INTO grupos (nombre)
SELECT 'Socios – Colonias' WHERE NOT EXISTS (SELECT 1 FROM grupos WHERE nombre = 'Socios – Colonias');
INSERT INTO grupo_productores (grupo_id, card_code)
SELECT g.id, v.card_code
FROM grupos g CROSS JOIN (VALUES ('P2044'),('P2102'),('P2143'),('P2145'),('P2185'),('P2302'),('P2316'),('P2319'),('P2328'),('P2341'),('P2362'),('P2380'),('P2388'),('P2392'),('P2395'),('P2398'),('P2403')) AS v(card_code)
WHERE g.nombre = 'Socios – Colonias'
ON CONFLICT (grupo_id, card_code) DO NOTHING;

INSERT INTO grupos (nombre)
SELECT 'No Socios – Paysandú' WHERE NOT EXISTS (SELECT 1 FROM grupos WHERE nombre = 'No Socios – Paysandú');
INSERT INTO grupo_productores (grupo_id, card_code)
SELECT g.id, v.card_code
FROM grupos g CROSS JOIN (VALUES ('P2413'),('P2415'),('P2417'),('P2419'),('P2420'),('P2422'),('P2423'),('P2425'),('P2426'),('P2427'),('P2430'),('P2431'),('P2432'),('P2433'),('P2434'),('P2436'),('P2437'),('P2439'),('P2440'),('P2441'),('P2443'),('P2444'),('P2445'),('P2446'),('P2447'),('P2449'),('P2451'),('P2453'),('P2454'),('P2455'),('P2456'),('P2457')) AS v(card_code)
WHERE g.nombre = 'No Socios – Paysandú'
ON CONFLICT (grupo_id, card_code) DO NOTHING;

INSERT INTO grupos (nombre)
SELECT 'No Socios – Cuenca Tradicional' WHERE NOT EXISTS (SELECT 1 FROM grupos WHERE nombre = 'No Socios – Cuenca Tradicional');
INSERT INTO grupo_productores (grupo_id, card_code)
SELECT g.id, v.card_code
FROM grupos g CROSS JOIN (VALUES ('P2530'),('P2534'),('P2538'),('P2545'),('P2546'),('P2548'),('P2555'),('P2558'),('P2560'),('P2566'),('P2569'),('P2732'),('P2747'),('P2808'),('P2883'),('P2935'),('P2973'),('P2979'),('P2984'),('P2987'),('P2992'),('P2993'),('P2996')) AS v(card_code)
WHERE g.nombre = 'No Socios – Cuenca Tradicional'
ON CONFLICT (grupo_id, card_code) DO NOTHING;

INSERT INTO grupos (nombre)
SELECT 'No Socios – Sin subgrupo' WHERE NOT EXISTS (SELECT 1 FROM grupos WHERE nombre = 'No Socios – Sin subgrupo');
INSERT INTO grupo_productores (grupo_id, card_code)
SELECT g.id, v.card_code
FROM grupos g CROSS JOIN (VALUES ('P2600')) AS v(card_code)
WHERE g.nombre = 'No Socios – Sin subgrupo'
ON CONFLICT (grupo_id, card_code) DO NOTHING;

INSERT INTO grupos (nombre)
SELECT 'Socios – Cuenca Tradicional' WHERE NOT EXISTS (SELECT 1 FROM grupos WHERE nombre = 'Socios – Cuenca Tradicional');
INSERT INTO grupo_productores (grupo_id, card_code)
SELECT g.id, v.card_code
FROM grupos g CROSS JOIN (VALUES ('P2622')) AS v(card_code)
WHERE g.nombre = 'Socios – Cuenca Tradicional'
ON CONFLICT (grupo_id, card_code) DO NOTHING;

INSERT INTO grupos (nombre)
SELECT 'Todos los Socios' WHERE NOT EXISTS (SELECT 1 FROM grupos WHERE nombre = 'Todos los Socios');
INSERT INTO grupo_productores (grupo_id, card_code)
SELECT g.id, v.card_code
FROM grupos g CROSS JOIN (VALUES ('P2044'),('P2102'),('P2143'),('P2145'),('P2185'),('P2302'),('P2316'),('P2319'),('P2328'),('P2341'),('P2362'),('P2380'),('P2388'),('P2392'),('P2395'),('P2398'),('P2403'),('P2622')) AS v(card_code)
WHERE g.nombre = 'Todos los Socios'
ON CONFLICT (grupo_id, card_code) DO NOTHING;

INSERT INTO grupos (nombre)
SELECT 'Todos los No Socios' WHERE NOT EXISTS (SELECT 1 FROM grupos WHERE nombre = 'Todos los No Socios');
INSERT INTO grupo_productores (grupo_id, card_code)
SELECT g.id, v.card_code
FROM grupos g CROSS JOIN (VALUES ('P2413'),('P2415'),('P2417'),('P2419'),('P2420'),('P2422'),('P2423'),('P2425'),('P2426'),('P2427'),('P2430'),('P2431'),('P2432'),('P2433'),('P2434'),('P2436'),('P2437'),('P2439'),('P2440'),('P2441'),('P2443'),('P2444'),('P2445'),('P2446'),('P2447'),('P2449'),('P2451'),('P2453'),('P2454'),('P2455'),('P2456'),('P2457'),('P2530'),('P2534'),('P2538'),('P2545'),('P2546'),('P2548'),('P2555'),('P2558'),('P2560'),('P2566'),('P2569'),('P2600'),('P2732'),('P2747'),('P2808'),('P2883'),('P2935'),('P2973'),('P2979'),('P2984'),('P2987'),('P2992'),('P2993'),('P2996')) AS v(card_code)
WHERE g.nombre = 'Todos los No Socios'
ON CONFLICT (grupo_id, card_code) DO NOTHING;
