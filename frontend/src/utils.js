const DATA_FROM_DATE = '2024-01-01';

function fmt(val) {
  if (val === null || val === undefined) return '—';
  const n = Number(val);
  if (!Number.isFinite(n)) return val;
  return n.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(d) {
  if (!d) return '';
  const dateOnly = String(d).slice(0, 10);
  const parsed = new Date(dateOnly + 'T12:00:00');
  if (isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('es-AR');
}

function filterFromMinDate(rows, dateKey) {
  return rows.filter((row) => {
    const d = row[dateKey];
    return d && String(d).slice(0, 10) >= DATA_FROM_DATE;
  });
}

function apiFromDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const from = d.toISOString().slice(0, 10);
  return from < DATA_FROM_DATE ? DATA_FROM_DATE : from;
}

function buildQueryFrom(userFrom) {
  const from = userFrom && userFrom >= DATA_FROM_DATE ? userFrom : DATA_FROM_DATE;
  return from;
}

export { DATA_FROM_DATE, fmt, fmtDate, filterFromMinDate, apiFromDate, buildQueryFrom };
