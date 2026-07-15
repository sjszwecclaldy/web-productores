import { fmtDate } from '../utils';

export default function SelectedDateBanner({ date, onClear }) {
  if (!date) return null;

  return (
    <div className="selected-date-banner">
      <span>
        Mostrando datos del <strong>{fmtDate(date)}</strong>
      </span>
      <button type="button" className="selected-date-banner__clear" onClick={onClear}>
        Ver todos
      </button>
    </div>
  );
}
