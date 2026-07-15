const express = require('express');
const { pool, query } = require('../db');
const { requireApiKey } = require('../middleware/apiKey');
const { generateActivationCode, activationExpiryDate } = require('../utils/tokens');

const router = express.Router();

router.use(requireApiKey);

async function ensureProductor(client, cardCode, cardName) {
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

  const allowedDomains = ['calidad_composicion', 'remisiones', 'liquidaciones', 'reliquidaciones'];
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
           item_code, descripcion, quantity, price, line_total, synced_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
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
    console.error('ingest remisiones error:', err);
    res.status(500).json({ error: 'Error en ingest', detail: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
