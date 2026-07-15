export default function ChartPanel({ title, children, actions }) {
  return (
    <div className="chart-panel">
      <div className="chart-panel__header">
        <h3 className="chart-panel__title">{title}</h3>
        {actions && <div className="chart-panel__actions">{actions}</div>}
      </div>
      <div className="chart-panel__body">{children}</div>
    </div>
  );
}
