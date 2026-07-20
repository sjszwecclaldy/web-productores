import { DATA_FROM_DATE } from '../utils';

// Filtro global de periodo: se ubica arriba de los KPI y graficas de cada pantalla.
// Al aplicar, la pantalla recarga sus datos para [from, to] y todos los KPI, graficas
// y tablas se actualizan a ese periodo.
export default function PeriodFilter({ from, to, onFrom, onTo, onSubmit }) {
  return (
    <form className="filters filters--global" onSubmit={onSubmit}>
      <div className="form-group">
        <label htmlFor="pf-from">Desde</label>
        <input
          id="pf-from"
          type="date"
          min={DATA_FROM_DATE}
          value={from}
          onChange={(e) => onFrom(e.target.value)}
        />
      </div>
      <div className="form-group">
        <label htmlFor="pf-to">Hasta</label>
        <input id="pf-to" type="date" value={to} onChange={(e) => onTo(e.target.value)} />
      </div>
      <button type="submit" className="btn btn-primary" style={{ width: 'auto' }}>
        Aplicar período
      </button>
    </form>
  );
}
