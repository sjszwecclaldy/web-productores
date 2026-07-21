const { pool } = require('./db');

// Cuantos dias hacia atras se consideran "recientes" para evaluar (evita inundar con historico viejo).
const RECENT_DAYS = 10;

function recentCutoff() {
  const d = new Date();
  d.setDate(d.getDate() - RECENT_DAYS);
  return d.toISOString().slice(0, 10);
}

// Definicion de cada indicador: de que tabla sale y como se agrega el valor de un dia.
const INDICADORES = {
  litros: { table: 'remisiones', dateCol: 'doc_date', expr: 'SUM(quantity)', label: 'Litros', unidad: 'L' },
  grasa: { table: 'calidad_composicion', dateCol: 'collection_date', expr: 'AVG(fat)', label: 'Grasa', unidad: '%' },
  proteina: { table: 'calidad_composicion', dateCol: 'collection_date', expr: 'AVG(protein)', label: 'Proteína', unidad: '%' },
  celulas: { table: 'calidad_sanitaria', dateCol: 'lab_date', expr: 'AVG(celulas)', label: 'Células somáticas (miles)', unidad: '' },
  bacterias: { table: 'calidad_sanitaria', dateCol: 'lab_date', expr: 'AVG(bacterias)', label: 'Recuento bacteriano (miles)', unidad: '' },
};

// Que indicadores evaluar segun el dominio que acaba de ingestar el agente.
const DOMAIN_INDICADORES = {
  remisiones: ['litros'],
  calidad_composicion: ['grasa', 'proteina'],
  calidad_sanitaria: ['celulas', 'bacterias'],
};

const round2 = (n) => Math.round(Number(n) * 100) / 100;

// Evalua las reglas activas contra los datos recientes de los productores que acaban de ingestar.
// cardCodes: array de card_code tocados en el lote.
async function evaluarControles(domain, cardCodes) {
  const indicadores = DOMAIN_INDICADORES[domain];
  if (!indicadores || !cardCodes || cardCodes.length === 0) return;

  const { rows: reglas } = await pool.query(
    `SELECT id, indicador, ventana_dias, umbral_pct, direccion
     FROM control_reglas
     WHERE activa = TRUE AND indicador = ANY($1)`,
    [indicadores]
  );
  if (reglas.length === 0) return;

  // Fechas recientes con dato para esos productores (evita el historico viejo).
  const base = INDICADORES[indicadores[0]];
  const cutoff = recentCutoff();
  const { rows: pares } = await pool.query(
    `SELECT DISTINCT card_code, to_char(${base.dateCol}, 'YYYY-MM-DD') AS fecha
     FROM ${base.table}
     WHERE card_code = ANY($1) AND ${base.dateCol} >= $2`,
    [cardCodes, cutoff]
  );
  if (pares.length === 0) return;

  for (const par of pares) {
    const cardCode = par.card_code;
    const fecha = par.fecha;

    for (const regla of reglas) {
      const ind = INDICADORES[regla.indicador];
      if (!ind) continue;
      const ventana = parseInt(regla.ventana_dias, 10) || 4;
      const umbral = Number(regla.umbral_pct) || 0;

      let actual = null;
      let promedio = null;
      try {
        const { rows } = await pool.query(
          `WITH daily AS (
             SELECT ${ind.dateCol} AS d, ${ind.expr} AS v
             FROM ${ind.table}
             WHERE card_code = $1 AND ${ind.dateCol} <= $2
             GROUP BY ${ind.dateCol}
           )
           SELECT
             (SELECT v FROM daily WHERE d = $2) AS actual,
             (SELECT AVG(v) FROM (SELECT v FROM daily WHERE d < $2 ORDER BY d DESC LIMIT $3) t) AS promedio`,
          [cardCode, fecha, ventana]
        );
        actual = rows[0]?.actual != null ? Number(rows[0].actual) : null;
        promedio = rows[0]?.promedio != null ? Number(rows[0].promedio) : null;
      } catch (err) {
        console.error('controles eval error:', err.message);
        continue;
      }

      if (actual == null || promedio == null || promedio === 0) continue;

      const desvio = ((actual - promedio) / promedio) * 100;
      let salta = false;
      if (regla.direccion === 'arriba') salta = desvio >= umbral;
      else if (regla.direccion === 'abajo') salta = desvio <= -umbral;
      else salta = Math.abs(desvio) >= umbral; // ambos

      if (!salta) continue;

      const signo = desvio >= 0 ? '+' : '';
      const mensaje =
        `${ind.label} de ${fecha}: ${round2(actual)}${ind.unidad ? ' ' + ind.unidad : ''} ` +
        `vs promedio ${round2(promedio)} de las últimas ${ventana} mediciones (${signo}${round2(desvio)}%).`;

      try {
        await pool.query(
          `INSERT INTO notificaciones
             (card_code, card_name, indicador, fecha, valor, promedio, desvio_pct, direccion, regla_id, mensaje)
           SELECT $1, (SELECT card_name FROM productores WHERE card_code = $1),
                  $2, $3, $4, $5, $6, $7, $8, $9
           ON CONFLICT (card_code, indicador, fecha)
           DO UPDATE SET valor = EXCLUDED.valor, promedio = EXCLUDED.promedio,
             desvio_pct = EXCLUDED.desvio_pct, direccion = EXCLUDED.direccion,
             regla_id = EXCLUDED.regla_id, mensaje = EXCLUDED.mensaje,
             leida = FALSE, created_at = NOW()`,
          [cardCode, regla.indicador, fecha, round2(actual), round2(promedio), round2(desvio), regla.direccion, regla.id, mensaje]
        );
      } catch (err) {
        console.error('controles insert error:', err.message);
      }
    }
  }
}

module.exports = { recentCutoff, evaluarControles, INDICADORES };
