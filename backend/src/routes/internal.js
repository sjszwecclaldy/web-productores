const express = require('express');
const bcrypt = require('bcryptjs');
const { pool, query } = require('../db');
const { requireApiKey } = require('../middleware/apiKey');
const { generateActivationCode, activationExpiryDate } = require('../utils/tokens');
const { evaluarControles } = require('../controles');

const router = express.Router();

router.use(requireApiKey);

async function ensureProductor(client, cardCode, cardName) {
  if (cardCode === 'ADMIN') return; // 'ADMIN' reservado para la cuenta administrativa
  const existing = await client.query(
    'SELECT id, card_name FROM productores WHERE card_code = $1',
    [cardCode]
  );

  if (existing.rows.length > 0) {
    if (cardName && existing.rows[0].card_name !== cardName) {
      await client.query('UPDATE productores SET card_name = $1 WHERE card_code = $2', [
        cardName,
        cardCode,
      ]);
    }
    return;
  }

  const code = generateActivationCode();
  const expiry = activationExpiryDate();

  await client.query(
    `INSERT INTO productores (card_code, card_name, activation_code, activation_code_expira)
     VALUES ($1, $2, $3, $4)`,
    [cardCode, cardName || cardCode, code, expiry]
  );
}

router.get('/sync-status', async (req, res) => {
  const domain = (req.query.domain || 'calidad_composicion').toString();
  try {
    let lastDate = null;
    if (domain === 'remisiones') {
      const { rows } = await query(`SELECT MAX(doc_date)::text AS last_date FROM remisiones`);
      lastDate = rows[0]?.last_date || null;
    } else if (domain === 'liquidaciones') {
      const { rows } = await query(`SELECT MAX(doc_date)::text AS last_date FROM liquidaciones`);
      lastDate = rows[0]?.last_date || null;
    } else if (domain === 'reliquidaciones') {
      const { rows } = await query(`SELECT MAX(doc_date)::text AS last_date FROM reliquidaciones`);
      lastDate = rows[0]?.last_date || null;
    } else if (domain === 'calidad_sanitaria') {
      const { rows } = await query(`SELECT MAX(lab_date)::text AS last_date FROM calidad_sanitaria`);
      lastDate = rows[0]?.last_date || null;
    } else {
      const { rows } = await query(`SELECT MAX(collection_date)::text AS last_date FROM calidad_composicion`);
      lastDate = rows[0]?.last_date || null;
    }

    const lastSync = await query(
      `SELECT finished_at, status, records_upserted
       FROM sync_log WHERE status = 'ok' AND domain = $1
       ORDER BY finished_at DESC LIMIT 1`,
      [domain]
    );

    res.json({
      domain,
      last_date: lastDate,
      last_collection_date: lastDate,
      last_sync: lastSync.rows[0] || null,
    });
  } catch (err) {
    console.error('sync-status error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.get('/pending-activations', async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT card_code, card_name, activation_code, activation_code_expira
       FROM productores
       WHERE estado = 'pendiente_activacion'
       ORDER BY card_code`
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('pending-activations error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.post('/sync-log', async (req, res) => {
  const { records_fetched, records_upserted, status, error_message, started_at, domain } = req.body;

  if (!status || !['ok', 'error'].includes(status)) {
    return res.status(400).json({ error: 'status inválido' });
  }

  const allowedDomains = ['calidad_composicion', 'remisiones', 'liquidaciones', 'reliquidaciones', 'calidad_sanitaria'];
  const dom = domain && allowedDomains.includes(domain) ? domain : 'calidad_composicion';

  try {
    const { rows } = await query(
      `INSERT INTO sync_log (started_at, finished_at, records_fetched, records_upserted, status, error_message, domain)
       VALUES ($1, NOW(), $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        started_at ? new Date(started_at) : new Date(),
        records_fetched ?? 0,
        records_upserted ?? 0,
        status,
        error_message ?? null,
        dom,
      ]
    );
    res.json({ id: rows[0].id });
  } catch (err) {
    console.error('sync-log error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.post('/ingest/calidad-composicion', async (req, res) => {
  const records = req.body;

  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'Se espera un array de registros' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let inserted = 0;
    let updated = 0;
    const seenProducers = new Map();

    for (const rec of records) {
      const cardCode = String(rec.card_code || rec.CardCode || '').trim();
      if (!cardCode) continue;

      const cardName = rec.card_name || rec.CardName || cardCode;
      if (!seenProducers.has(cardCode)) {
        await ensureProductor(client, cardCode, cardName);
        seenProducers.set(cardCode, cardName);
      }

      const collectionDate = rec.collection_date || rec.U_CollectionDate;
      const jobName = rec.job_name ?? rec.U_JobName ?? '';
      const sub = rec.sub ?? rec.U_Sub;

      if (!collectionDate || sub === undefined || sub === null) continue;

      const result = await client.query(
        `INSERT INTO calidad_composicion (
           card_code, collection_date, job_name, job_type, product, sub,
           fat, protein, lactose, ts, fpd, casein, urea, remarks, synced_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
         ON CONFLICT (card_code, collection_date, job_name, sub)
         DO UPDATE SET
           job_type = EXCLUDED.job_type,
           product = EXCLUDED.product,
           fat = EXCLUDED.fat,
           protein = EXCLUDED.protein,
           lactose = EXCLUDED.lactose,
           ts = EXCLUDED.ts,
           fpd = EXCLUDED.fpd,
           casein = EXCLUDED.casein,
           urea = EXCLUDED.urea,
           remarks = EXCLUDED.remarks,
           synced_at = NOW()
         RETURNING (xmax = 0) AS is_insert`,
        [
          cardCode,
          collectionDate,
          jobName,
          rec.job_type ?? rec.U_JobType ?? null,
          rec.product ?? rec.U_Product ?? null,
          sub,
          rec.fat ?? rec.U_Fat ?? null,
          rec.protein ?? rec.U_Protein ?? null,
          rec.lactose ?? rec.U_Lactose ?? null,
          rec.ts ?? rec.U_TS ?? null,
          rec.fpd ?? rec.U_FPD ?? null,
          rec.casein ?? rec.U_Casein ?? null,
          rec.urea ?? rec.U_Urea ?? null,
          rec.remarks ?? rec.U_Remarks ?? null,
        ]
      );

      if (result.rows[0]?.is_insert) {
        inserted++;
      } else {
        updated++;
      }
    }

    await client.query('COMMIT');

    try {
      await evaluarControles('calidad_composicion', Array.from(seenProducers.keys()));
    } catch (e) {
      console.error('controles composicion:', e.message);
    }

    res.json({ inserted, updated });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('ingest error:', err);
    res.status(500).json({ error: 'Error en ingest', detail: err.message });
  } finally {
    client.release();
  }
});

router.post('/ingest/remisiones', async (req, res) => {
  const records = req.body;

  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'Se espera un array de registros' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let inserted = 0;
    let updated = 0;
    const seenProducers = new Map();

    for (const rec of records) {
      const cardCode = String(rec.card_code || rec.CardCode || '').trim();
      if (!cardCode) continue;

      const cardName = rec.card_name || rec.CardName || cardCode;
      if (!seenProducers.has(cardCode)) {
        await ensureProductor(client, cardCode, cardName);
        seenProducers.set(cardCode, cardName);
      }

      const docEntry = rec.doc_entry ?? rec.DocEntry;
      const lineNum = rec.line_num ?? rec.LineNum;
      const docDate = rec.doc_date ?? rec.DocDate;

      if (docEntry === undefined || docEntry === null ||
          lineNum === undefined || lineNum === null || !docDate) continue;

      const result = await client.query(
        `INSERT INTO remisiones (
           card_code, card_name, doc_entry, line_num, doc_num, doc_date, doc_due_date,
           item_code, descripcion, quantity, price, line_total,
           temperatura, antibiotico, canceled, synced_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW())
         ON CONFLICT (doc_entry, line_num)
         DO UPDATE SET
           card_code = EXCLUDED.card_code,
           card_name = EXCLUDED.card_name,
           doc_num = EXCLUDED.doc_num,
           doc_date = EXCLUDED.doc_date,
           doc_due_date = EXCLUDED.doc_due_date,
           item_code = EXCLUDED.item_code,
           descripcion = EXCLUDED.descripcion,
           quantity = EXCLUDED.quantity,
           price = EXCLUDED.price,
           line_total = EXCLUDED.line_total,
           temperatura = EXCLUDED.temperatura,
           antibiotico = EXCLUDED.antibiotico,
           canceled = EXCLUDED.canceled,
           synced_at = NOW()
         RETURNING (xmax = 0) AS is_insert`,
        [
          cardCode,
          cardName,
          parseInt(docEntry, 10),
          parseInt(lineNum, 10),
          rec.doc_num ?? rec.DocNum ?? null,
          docDate,
          rec.doc_due_date ?? rec.DocDueDate ?? null,
          rec.item_code ?? rec.ItemCode ?? null,
          rec.descripcion ?? rec.Dscription ?? null,
          rec.quantity ?? rec.Quantity ?? null,
          rec.price ?? rec.Price ?? null,
          rec.line_total ?? rec.LineTotal ?? null,
          rec.temperatura ?? rec.U_TEMP ?? null,
          rec.antibiotico ?? rec.U_ANTIB ?? null,
          rec.canceled ?? rec.CANCELED ?? null,
        ]
      );

      if (result.rows[0]?.is_insert) {
        inserted++;
      } else {
        updated++;
      }
    }

    await client.query('COMMIT');

    try {
      await evaluarControles('remisiones', Array.from(seenProducers.keys()));
    } catch (e) {
      console.error('controles remisiones:', e.message);
    }

    res.json({ inserted, updated });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('ingest remisiones error:', err);
    res.status(500).json({ error: 'Error en ingest', detail: err.message });
  } finally {
    client.release();
  }
});

router.post('/ingest/liquidaciones', async (req, res) => {
  const records = req.body;

  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'Se espera un array de registros' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let inserted = 0;
    let updated = 0;
    const seenProducers = new Set();

    for (const rec of records) {
      const cardCode = String(rec.card_code || rec.CardCode || '').trim();
      if (!cardCode) continue;

      if (!seenProducers.has(cardCode)) {
        await ensureProductor(client, cardCode, null);
        seenProducers.add(cardCode);
      }

      const docDate = rec.doc_date ?? rec.DocDate;
      if (!docDate) continue;

      const itemCode = String(rec.item_code ?? rec.ItemCode ?? '').trim();
      const numAtCard = String(rec.num_at_card ?? rec.NumAtCard ?? '').trim();

      const result = await client.query(
        `INSERT INTO liquidaciones (
           card_code, group_code, doc_date, num_at_card, item_code,
           cantidad, total, imeba, inia, aftosa_usd, enferm_usd, synced_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
         ON CONFLICT (card_code, doc_date, item_code, num_at_card)
         DO UPDATE SET
           group_code = EXCLUDED.group_code,
           cantidad = EXCLUDED.cantidad,
           total = EXCLUDED.total,
           imeba = EXCLUDED.imeba,
           inia = EXCLUDED.inia,
           aftosa_usd = EXCLUDED.aftosa_usd,
           enferm_usd = EXCLUDED.enferm_usd,
           synced_at = NOW()
         RETURNING (xmax = 0) AS is_insert`,
        [
          cardCode,
          rec.group_code ?? rec.GroupCode ?? null,
          docDate,
          numAtCard,
          itemCode,
          rec.cantidad ?? rec.CANTIDAD ?? null,
          rec.total ?? rec.TOTAL ?? null,
          rec.imeba ?? rec.IMEBA ?? null,
          rec.inia ?? rec.INIA ?? null,
          rec.aftosa_usd ?? rec.Aftosa_USD ?? null,
          rec.enferm_usd ?? rec.Enferm_USD ?? null,
        ]
      );

      if (result.rows[0]?.is_insert) {
        inserted++;
      } else {
        updated++;
      }
    }

    await client.query('COMMIT');
    res.json({ inserted, updated });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('ingest liquidaciones error:', err);
    res.status(500).json({ error: 'Error en ingest', detail: err.message });
  } finally {
    client.release();
  }
});

router.post('/ingest/reliquidaciones', async (req, res) => {
  const records = req.body;

  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'Se espera un array de registros' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let inserted = 0;
    let updated = 0;
    const seenProducers = new Set();

    for (const rec of records) {
      const cardCode = String(rec.card_code || rec.CardCode || '').trim();
      if (!cardCode) continue;

      const cardName = rec.card_name || rec.CardName || null;
      if (!seenProducers.has(cardCode)) {
        await ensureProductor(client, cardCode, cardName);
        seenProducers.add(cardCode);
      }

      const docNum = rec.doc_num ?? rec.DocNum;
      const docDate = rec.doc_date ?? rec.DocDate;
      if (docNum === undefined || docNum === null || docNum === '' || !docDate) continue;

      const result = await client.query(
        `INSERT INTO reliquidaciones (
           card_code, doc_num, num_at_card, doc_date, descripcion, line_total, synced_at
         ) VALUES ($1,$2,$3,$4,$5,$6,NOW())
         ON CONFLICT (card_code, doc_num)
         DO UPDATE SET
           num_at_card = EXCLUDED.num_at_card,
           doc_date = EXCLUDED.doc_date,
           descripcion = EXCLUDED.descripcion,
           line_total = EXCLUDED.line_total,
           synced_at = NOW()
         RETURNING (xmax = 0) AS is_insert`,
        [
          cardCode,
          parseInt(docNum, 10),
          rec.num_at_card ?? rec.NumAtCard ?? null,
          docDate,
          rec.descripcion ?? rec.Dscription ?? null,
          rec.line_total ?? rec.LineTotal ?? null,
        ]
      );

      if (result.rows[0]?.is_insert) {
        inserted++;
      } else {
        updated++;
      }
    }

    await client.query('COMMIT');
    res.json({ inserted, updated });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('ingest reliquidaciones error:', err);
    res.status(500).json({ error: 'Error en ingest', detail: err.message });
  } finally {
    client.release();
  }
});

router.post('/ingest/calidad-sanitaria', async (req, res) => {
  const records = req.body;

  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'Se espera un array de registros' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let inserted = 0;
    let updated = 0;
    const seenProducers = new Set();

    for (const rec of records) {
      const cardCode = String(rec.card_code || rec.CardCode || '').trim();
      if (!cardCode) continue;

      const cardName = rec.card_name || rec.CardName || null;
      if (!seenProducers.has(cardCode)) {
        await ensureProductor(client, cardCode, cardName);
        seenProducers.add(cardCode);
      }

      const labDate = rec.lab_date ?? rec.U_LabDate;
      if (!labDate) continue;

      const result = await client.query(
        `INSERT INTO calidad_sanitaria (
           card_code, lab_date, celulas, bacterias, origen, synced_at
         ) VALUES ($1,$2,$3,$4,$5,NOW())
         ON CONFLICT (card_code, lab_date)
         DO UPDATE SET
           celulas = EXCLUDED.celulas,
           bacterias = EXCLUDED.bacterias,
           origen = EXCLUDED.origen,
           synced_at = NOW()
         RETURNING (xmax = 0) AS is_insert`,
        [
          cardCode,
          labDate,
          rec.celulas ?? rec.Celulas ?? null,
          rec.bacterias ?? rec.Bacterias ?? null,
          rec.origen ?? rec.Origen ?? null,
        ]
      );

      if (result.rows[0]?.is_insert) {
        inserted++;
      } else {
        updated++;
      }
    }

    await client.query('COMMIT');

    try {
      await evaluarControles('calidad_sanitaria', Array.from(seenProducers));
    } catch (e) {
      console.error('controles calidad-sanitaria:', e.message);
    }

    res.json({ inserted, updated });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('ingest calidad-sanitaria error:', err);
    res.status(500).json({ error: 'Error en ingest', detail: err.message });
  } finally {
    client.release();
  }
});

router.post('/crear-admin', async (req, res) => {
  const { email, password, card_name } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Faltan email o password' });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  try {
    const emailEnUso = await query(
      "SELECT card_code FROM productores WHERE email = $1 AND card_code <> 'ADMIN'",
      [normalizedEmail]
    );
    if (emailEnUso.rows.length > 0) {
      return res.status(409).json({
        error: `El email ya está en uso por el productor ${emailEnUso.rows[0].card_code}. Liberá esa cuenta antes de usarlo para el admin.`,
      });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const { rows } = await query(
      `INSERT INTO productores (card_code, card_name, email, password_hash, estado, role)
       VALUES ('ADMIN', $1, $2, $3, 'activo', 'admin')
       ON CONFLICT (card_code) DO UPDATE SET
         card_name = EXCLUDED.card_name,
         email = EXCLUDED.email,
         password_hash = EXCLUDED.password_hash,
         estado = 'activo',
         role = 'admin'
       RETURNING card_code, card_name, email, role`,
      [card_name || 'Administrador', normalizedEmail, passwordHash]
    );
    res.json({ ok: true, admin: rows[0] });
  } catch (err) {
    console.error('crear-admin error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.post('/liberar-cuenta', async (req, res) => {
  const { email, card_code } = req.body;

  if (!email && !card_code) {
    return res.status(400).json({ error: 'Se requiere email o card_code' });
  }

  try {
    const finder = email
      ? await query('SELECT id, card_code, role FROM productores WHERE email = $1', [String(email).trim().toLowerCase()])
      : await query('SELECT id, card_code, role FROM productores WHERE card_code = $1', [String(card_code).trim()]);

    if (finder.rows.length === 0) {
      return res.status(404).json({ error: 'No se encontró productor con ese email o card_code' });
    }

    const prod = finder.rows[0];
    if (prod.role === 'admin') {
      return res.status(400).json({ error: 'No se puede liberar una cuenta de administrador' });
    }

    const code = generateActivationCode();
    const expiry = activationExpiryDate();

    await query(
      `UPDATE productores
       SET email = NULL, password_hash = NULL, estado = 'pendiente_activacion',
           activation_code = $2, activation_code_expira = $3
       WHERE id = $1`,
      [prod.id, code, expiry]
    );

    res.json({
      ok: true,
      card_code: prod.card_code,
      estado: 'pendiente_activacion',
      nuevo_activation_code: code,
    });
  } catch (err) {
    console.error('liberar-cuenta error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ---------------------------------------------------------------------------
// Verificacion y recarga controlada de dominios
// ---------------------------------------------------------------------------

// Dominio -> tabla + columna de fecha para conteo/rango.
const DOMAIN_TABLES = {
  remisiones: { table: 'remisiones', dateCol: 'doc_date' },
  calidad_composicion: { table: 'calidad_composicion', dateCol: 'collection_date' },
  liquidaciones: { table: 'liquidaciones', dateCol: 'doc_date' },
  reliquidaciones: { table: 'reliquidaciones', dateCol: 'doc_date' },
  calidad_sanitaria: { table: 'calidad_sanitaria', dateCol: 'lab_date' },
};

// GET /internal/counts -> cuantos registros hay por dominio y su rango de fechas.
// Sirve para corroborar contra los conteos que se ven en SAP.
router.get('/counts', async (_req, res) => {
  const counts = {};
  for (const [domain, cfg] of Object.entries(DOMAIN_TABLES)) {
    try {
      const { rows } = await query(
        `SELECT COUNT(*)::int AS total,
                to_char(MIN(${cfg.dateCol}), 'YYYY-MM-DD') AS min_date,
                to_char(MAX(${cfg.dateCol}), 'YYYY-MM-DD') AS max_date
         FROM ${cfg.table}`
      );
      counts[domain] = rows[0];
    } catch (err) {
      // Tabla inexistente todavia (ej. calidad_sanitaria antes de aplicar su prompt).
      counts[domain] = { total: null, min_date: null, max_date: null, error: err.message };
    }
  }
  res.json({ counts });
});

// POST /internal/reset-domain  { "domain": "remisiones" }
// Vacia la tabla del dominio (TRUNCATE) para forzar una recarga historica completa
// en la siguiente corrida del agente (sync-status devolvera null -> baja desde 2000-01-01).
// Nunca toca la tabla productores.
router.post('/reset-domain', async (req, res) => {
  const domain = String(req.body?.domain || '').trim();
  const cfg = DOMAIN_TABLES[domain];

  if (!cfg) {
    return res.status(400).json({
      error: 'Dominio invalido',
      allowed: Object.keys(DOMAIN_TABLES),
    });
  }

  try {
    const before = await query(`SELECT COUNT(*)::int AS n FROM ${cfg.table}`);
    await query(`TRUNCATE TABLE ${cfg.table}`);
    res.json({ ok: true, domain, table: cfg.table, deleted: before.rows[0].n });
  } catch (err) {
    console.error('reset-domain error:', err);
    res.status(500).json({ error: 'Error interno', detail: err.message });
  }
});

module.exports = router;
