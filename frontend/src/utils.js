function fmt(val) {
  if (val === null || val === undefined) return '—';
  const n = Number(val);
  return Number.isFinite(n) ? n.toFixed(2) : val;
}

function fmtDate(d) {
  if (!d) return '';
  const dateOnly = String(d).slice(0, 10);
  const parsed = new Date(dateOnly + 'T12:00:00');
  if (isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('es-AR');
}

export { fmt, fmtDate };
