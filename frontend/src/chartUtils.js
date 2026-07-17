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
  return `${months[idx]} ${y}`;
}

export function groupSumByDate(rows, dateKey, valueKey) {
  const map = new Map();
  for (const row of rows) {
    const date = row[dateKey] ? String(row[dateKey]).slice(0, 10) : null;
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

export function rowsOnDate(rows, dateKey, date) {
  if (!date) return [];
  const d = String(date).slice(0, 10);
  return rows.filter((row) => String(row[dateKey] || '').slice(0, 10) === d);
}

export function avgCalidadSnapshot(rows) {
  if (!rows.length) return null;
  const keys = ['fat', 'protein', 'lactose', 'ts', 'fpd', 'casein', 'urea'];
  const result = {
    collection_date: rows[0].collection_date,
    sub: rows.length === 1 ? rows[0].sub : null,
  };
  for (const key of keys) {
    const vals = rows.map((r) => Number(r[key])).filter((n) => Number.isFinite(n));
    result[key] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }
  return result;
}

export function calcDeltaForDate(grouped, date, valueKey = 'total') {
  const idx = grouped.findIndex((row) => row.date === date);
  if (idx < 1) return null;
  const curr = Number(grouped[idx][valueKey]) || 0;
  const prev = Number(grouped[idx - 1][valueKey]) || 0;
  if (prev === 0) return null;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

export function rowsOnMonth(rows, dateKey, month) {
  if (!month) return [];
  const m = String(month).slice(0, 7);
  return rows.filter((row) => String(row[dateKey] || '').slice(0, 7) === m);
}

export function toggleSelectedDate(current, next) {
  return current === next ? null : next;
}

export const toggleSelectedMonth = toggleSelectedDate;

export function avgCalidadByDate(rows) {
  const map = new Map();
  for (const row of rows) {
    const date = row.collection_date ? String(row.collection_date).slice(0, 10) : null;
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

export function getCurrentMonthRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const start = `${y}-${m}-01`;
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
  const end = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
  return { start, end, label: formatMonthLabel(`${y}-${m}`) };
}

export function filterCurrentMonth(rows, dateKey) {
  const { start, end } = getCurrentMonthRange();
  return rows.filter((row) => {
    const d = String(row[dateKey] || '').slice(0, 10);
    return d >= start && d <= end;
  });
}

export function avgCalidadMonth(rows) {
  const monthRows = filterCurrentMonth(rows, 'collection_date');
  if (monthRows.length === 0) return null;
  const keys = ['fat', 'protein', 'lactose', 'ts', 'fpd', 'casein', 'urea'];
  const result = { muestras: monthRows.length };
  for (const key of keys) {
    const vals = monthRows
      .map((r) => Number(r[key]))
      .filter((n) => Number.isFinite(n));
    result[key] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }
  return result;
}

export function sumRemisionesMonth(rows) {
  const monthRows = filterCurrentMonth(rows, 'doc_date');
  return {
    total_litros: monthRows.reduce((s, r) => s + (Number(r.quantity) || 0), 0),
    total_importe: monthRows.reduce((s, r) => s + (Number(r.line_total) || 0), 0),
    entregas: monthRows.length,
  };
}

export function sumLiquidacionesMonth(rows) {
  const monthRows = filterCurrentMonth(rows, 'doc_date');
  return {
    total_litros: monthRows.reduce((s, r) => s + (Number(r.cantidad) || 0), 0),
    total_importe: monthRows.reduce((s, r) => s + (Number(r.total) || 0), 0),
    liquidaciones: monthRows.length,
  };
}

export function sumReliquidacionesMonth(rows) {
  const monthRows = filterCurrentMonth(rows, 'doc_date');
  return {
    total_importe: monthRows.reduce((s, r) => s + (Number(r.line_total) || 0), 0),
    reliquidaciones: monthRows.length,
  };
}

export function avgDailyCurrentMonth(grouped, valueKey = 'total') {
  const { start, end } = getCurrentMonthRange();
  const monthRows = grouped.filter((row) => {
    const d = String(row.date || '').slice(0, 10);
    return d >= start && d <= end;
  });
  return avgDaily(monthRows, valueKey);
}

export function litrosByYearMonth(rows, dateKey, valueKey) {
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const yearsSet = new Set();
  const map = new Map();
  for (const row of rows) {
    const ds = String(row[dateKey] || '').slice(0, 10);
    if (ds.length < 7) continue;
    const year = ds.slice(0, 4);
    const monthIdx = parseInt(ds.slice(5, 7), 10) - 1;
    if (monthIdx < 0 || monthIdx > 11) continue;
    yearsSet.add(year);
    if (!map.has(monthIdx)) map.set(monthIdx, { monthIdx, label: months[monthIdx] });
    const bucket = map.get(monthIdx);
    bucket[year] = (bucket[year] || 0) + (Number(row[valueKey]) || 0);
  }
  const data = [];
  for (let i = 0; i < 12; i++) {
    data.push(map.get(i) || { monthIdx: i, label: months[i] });
  }
  const years = [...yearsSet].sort();
  return { years, data };
}
