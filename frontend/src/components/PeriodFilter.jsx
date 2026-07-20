import { useState } from 'react';
import { DATA_FROM_DATE } from '../utils';

// Filtro global de periodo: se ubica arriba de los KPI y graficas de cada pantalla.
// Trae accesos rapidos (ultimos 30/90/365 dias) y un rango manual Desde/Hasta.
// Al aplicar, la pantalla recarga sus datos para [from, to] y todos los KPI, graficas
// y tablas se actualizan a ese periodo.
const PRESETS = [
  { dias: 30, label: 'Últimos 30 días' },
  { dias: 90, label: 'Últimos 90 días' },
  { dias: 365, label: 'Últimos 365 días' },
];

function daysAgo(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  const iso = d.toISOString().slice(0, 10);
  return iso < DATA_FROM_DATE ? DATA_FROM_DATE : iso;
}

export default function PeriodFilter({ from, to, onFrom, onTo, onApply }) {
  const [activePreset, setActivePreset] = useState(null);

  function handleSubmit(e) {
    e.preventDefault();
    setActivePreset(null);
    onApply(from, to);
  }

  function handlePreset(dias) {
    const f = daysAgo(dias);
    setActivePreset(dias);
    onFrom(f);
    onTo('');
    onApply(f, '');
  }

  function handleManual(setter) {
    return (e) => {
      setActivePreset(null);
      setter(e.target.value);
    };
  }

  return (
    <form className="filters filters--global" onSubmit={handleSubmit}>
      <div className="period-toggle">
        {PRESETS.map((p) => (
          <button
            key={p.dias}
            type="button"
            className={`period-toggle__btn${activePreset === p.dias ? ' active' : ''}`}
            onClick={() => handlePreset(p.dias)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="form-group">
        <label htmlFor="pf-from">Desde</label>
        <input id="pf-from" type="date" min={DATA_FROM_DATE} value={from} onChange={handleManual(onFrom)} />
      </div>
      <div className="form-group">
        <label htmlFor="pf-to">Hasta</label>
        <input id="pf-to" type="date" value={to} onChange={handleManual(onTo)} />
      </div>
      <button type="submit" className="btn btn-primary" style={{ width: 'auto' }}>
        Aplicar período
      </button>
    </form>
  );
}
