export default function KpiCard({ icon, label, value, delta, deltaLabel }) {
  const deltaClass =
    delta == null
      ? ''
      : delta >= 0
        ? 'kpi-card__delta kpi-card__delta--up'
        : 'kpi-card__delta kpi-card__delta--down';

  return (
    <div className="kpi-card">
      {icon && <div className="kpi-card__icon">{icon}</div>}
      <div className="kpi-card__body">
        <span className="kpi-card__label">{label}</span>
        <span className="kpi-card__value">{value}</span>
        {delta != null && (
          <span className={deltaClass}>
            {delta >= 0 ? '+' : ''}
            {delta}
            {deltaLabel ? ` ${deltaLabel}` : ''}
          </span>
        )}
      </div>
    </div>
  );
}
