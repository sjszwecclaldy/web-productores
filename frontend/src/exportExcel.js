import * as XLSX from 'xlsx';

// Exporta filas a un archivo .xlsx.
// columns: [{ header: 'Fecha', value: (row) => ... }]
export function exportToExcel(filename, columns, rows) {
  const headers = columns.map((c) => c.header);
  const data = (rows || []).map((row) => {
    const o = {};
    for (const c of columns) {
      o[c.header] = typeof c.value === 'function' ? c.value(row) : row[c.value];
    }
    return o;
  });
  const ws = XLSX.utils.json_to_sheet(data, { header: headers });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Datos');
  XLSX.writeFile(wb, filename);
}
