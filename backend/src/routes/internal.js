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

router.get('/sync-status', async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT MAX(collection_date)::text AS last_collection_date
       FROM calidad_composicion`
    );

    const lastSync = await query(
      `SELECT finished_at, status, records_upserted
       FROM sync_log WHERE status = 'ok'
       ORDER BY finished_at DESC LIMIT 1`
    );

    res.json({
      last_collection_date: rows[0]?.last_collection_date || null,
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
  const { records_fetched, records_upserted, status, error_message, started_at } = req.body;

  if (!status || !['ok', 'error'].includes(status)) {
    return res.status(400).json({ error: 'status inválido' });
  }

  try {
    const { rows } = await query(
      `INSERT INTO sync_log (started_at, finished_at, records_fetched, records_upserted, status, error_message)
       VALUES ($1, NOW(), $2, $3, $4, $5)
       RETURNING id`,
      [
        started_at ? new Date(started_at) : new Date(),
        records_fetched ?? 0,
        records_upserted ?? 0,
        status,
        error_message ?? null,
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

module.exports = router;
