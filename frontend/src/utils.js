function fmt(val) {
  if (val === null || val === undefined) return '—';
  const n = Number(val);
  return Number.isFinite(n) ? n.toFixed(2) : val;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('es-AR');
}

export { fmt, fmtDate };
