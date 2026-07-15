export const CHART_COLORS = {
  primary: '#1a5c35',
  accent: '#2d8c52',
  gold: '#b8973a',
  muted: '#ccddd4',
};

export function dateDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function formatChartDate(isoDate) {
  if (!isoDate) return '';
  const parsed = new Date(String(isoDate).slice(0, 10) + 'T12:00:00');
  if (isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}

export function formatMonthLabel(ym) {
  const [y, m] = String(ym).split('-');
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const idx = parseInt(m, 10) - 1;
  if (idx < 0 || idx > 11) return ym;
  return `${months[idx]} ${y.slice(2)}`;
}

export function groupSumByDate(rows, dateKey, valueKey) {
  const map = new Map();
  for (const row of rows) {
    const date = row[dateKey];
    if (!date) continue;
    const val = Number(row[valueKey]) || 0;
    map.set(date, (map.get(date) || 0) + val);
  }
  return [...map.entries()]
    .map(([date, total]) => ({
      date,
      label: formatChartDate(date),
      total: Math.round(total * 100) / 100,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function groupSumByMonth(rows, dateKey, valueKey) {
  const map = new Map();
  for (const row of rows) {
    const date = row[dateKey];
    if (!date) continue;
    const month = String(date).slice(0, 7);
    const val = Number(row[valueKey]) || 0;
    map.set(month, (map.get(month) || 0) + val);
  }
  return [...map.entries()]
    .map(([month, total]) => ({
      month,
      label: formatMonthLabel(month),
      total: Math.round(total * 100) / 100,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export function groupDualByMonth(rows, dateKey, fieldA, fieldB, keyA, keyB) {
  const map = new Map();
  for (const row of rows) {
    const date = row[dateKey];
    if (!date) continue;
    const month = String(date).slice(0, 7);
    if (!map.has(month)) {
      map.set(month, { month, [keyA]: 0, [keyB]: 0 });
    }
    const bucket = map.get(month);
    bucket[keyA] += Number(row[fieldA]) || 0;
    bucket[keyB] += Number(row[fieldB]) || 0;
  }
  return [...map.entries()]
    .map(([, bucket]) => ({
      month: bucket.month,
      label: formatMonthLabel(bucket.month),
      [keyA]: Math.round(bucket[keyA] * 100) / 100,
      [keyB]: Math.round(bucket[keyB] * 100) / 100,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export function avgCalidadByDate(rows) {
  const map = new Map();
  for (const row of rows) {
    const date = row.collection_date;
    if (!date) continue;
    if (!map.has(date)) {
      map.set(date, { fat: [], protein: [], lactose: [], ts: [] });
    }
    const bucket = map.get(date);
    for (const key of ['fat', 'protein', 'lactose', 'ts']) {
      if (row[key] != null && row[key] !== '') {
        bucket[key].push(Number(row[key]));
      }
    }
  }
  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

  return [...map.entries()]
    .map(([date, buckets]) => ({
      date,
      label: formatChartDate(date),
      fat: avg(buckets.fat),
      protein: avg(buckets.protein),
      lactose: avg(buckets.lactose),
      ts: avg(buckets.ts),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function filterLastDays(grouped, days, dateKey = 'date') {
  if (!days || grouped.length === 0) return grouped;
  const cutoff = dateDaysAgo(days);
  return grouped.filter((row) => row[dateKey] >= cutoff);
}

export function calcDayOverDayDelta(grouped, valueKey = 'total') {
  if (grouped.length < 2) return null;
  const last = Number(grouped[grouped.length - 1][valueKey]) || 0;
  const prev = Number(grouped[grouped.length - 2][valueKey]) || 0;
  if (prev === 0) return null;
  return Math.round(((last - prev) / prev) * 1000) / 10;
}

export function avgDaily(grouped, valueKey = 'total') {
  if (grouped.length === 0) return null;
  const sum = grouped.reduce((acc, row) => acc + (Number(row[valueKey]) || 0), 0);
  return Math.round((sum / grouped.length) * 100) / 100;
}
