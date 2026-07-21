import { exportToExcel } from '../exportExcel';

// Boton reutilizable para exportar una tabla a Excel.
export default function ExportButton({ filename, columns, rows, label = 'Exportar a Excel' }) {
  const disabled = !rows || rows.length === 0;
  return (
    <button
      type="button"
      className="btn btn-primary"
      style={{ width: 'auto' }}
      disabled={disabled}
      onClick={() => exportToExcel(filename, columns, rows)}
    >
      {label}
    </button>
  );
}
