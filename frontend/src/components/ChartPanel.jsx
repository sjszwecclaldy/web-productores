import { useEffect, useState } from 'react';

export default function ChartPanel({ title, children, actions, expandable = true }) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') setExpanded(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  return (
    <div className="chart-panel">
      <div className="chart-panel__header">
        <h3 className="chart-panel__title">{title}</h3>
        {(actions || expandable) && (
          <div className="chart-panel__actions">
            {actions}
            {expandable && (
              <button
                type="button"
                className="chart-panel__expand"
                aria-label="Expandir gráfico"
                title="Expandir"
                onClick={() => setExpanded(true)}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
      <div className="chart-panel__body">{children}</div>

      {expanded && (
        <div className="chart-modal" role="dialog" aria-modal="true" onClick={() => setExpanded(false)}>
          <div className="chart-modal__card" onClick={(e) => e.stopPropagation()}>
            <div className="chart-modal__header">
              <h3 className="chart-modal__title">{title}</h3>
              <button
                type="button"
                className="chart-modal__close"
                aria-label="Cerrar"
                onClick={() => setExpanded(false)}
              >
                ×
              </button>
            </div>
            <div className="chart-modal__body">{children}</div>
          </div>
        </div>
      )}
    </div>
  );
}
