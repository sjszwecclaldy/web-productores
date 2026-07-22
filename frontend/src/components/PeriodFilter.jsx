import { apiFromDate, DATA_FROM_DATE } from '../utils';

// Filtro global de periodo. A la izquierda el rango manual Desde/Hasta; a la derecha los
// accesos rapidos (ultimos 30/90/365 dias y Todos). La etiqueta activa la controla la
// pantalla via `activePreset` (asi queda resaltada tambien al cargar la pagina).
const PRESETS = [
  { key: 30, label: 'Últimos 30 días' },
  { key: 90, label: 'Últimos 90 días' },
  { key: 365, label: 'Últimos 365 días' },
  { key: 'todos', label: 'Todos' },
];

// Fecha "desde" para cada preset (Todos = todo el historico disponible).
export function presetFrom(key) {
  return key === 'todos' ? DATA_FROM_DATE : apiFromDate(key);
}

export default function PeriodFilter({ from, to, onFrom, onTo, activePreset, onApply, abovePresets }) {
  function handleSubmit(e) {
    e.preventDefault();
    onApply(from, to, null);
  }

  function handlePreset(key) {
    onApply(presetFrom(key), '', key);
  }

  return (
    <div className="filters filters--global">
      <form className="period-range" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="pf-from">Desde</label>
          <input id="pf-from" type="date" min={DATA_FROM_DATE} value={from} onChange={(e) => onFrom(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="pf-to">Hasta</label>
          <input id="pf-to" type="date" value={to} onChange={(e) => onTo(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-primary" style={{ width: 'auto' }}>
          Aplicar período
        </button>
      </form>

      <div className="period-presets-col">
        {abovePresets}
        <div className="period-toggle period-presets">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`period-toggle__btn${activePreset === p.key ? ' active' : ''}`}
              onClick={() => handlePreset(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
