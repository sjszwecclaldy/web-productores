import { formatMonthLabel } from '../chartUtils';
import { fmtDate } from '../utils';

function SelectedPeriodBanner({ label, onClear }) {
  if (!label) return null;

  return (
    <div className="selected-date-banner">
      <span>
        Mostrando datos de <strong>{label}</strong>
      </span>
      <button type="button" className="selected-date-banner__clear" onClick={onClear}>
        Ver todos
      </button>
    </div>
  );
}

export default function SelectedDateBanner({ date, onClear }) {
  if (!date) return null;
  return <SelectedPeriodBanner label={fmtDate(date)} onClear={onClear} />;
}

export function SelectedMonthBanner({ month, onClear }) {
  if (!month) return null;
  return <SelectedPeriodBanner label={formatMonthLabel(month)} onClear={onClear} />;
}
