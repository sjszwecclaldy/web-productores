import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearToken } from '../api';
import {
  avgCalidadByDate,
  avgCalidadMonth,
  avgCalidadSnapshot,
  filterLastDays,
  getCurrentMonthRange,
  rowsOnDate,
  toggleSelectedDate,
} from '../chartUtils';
import { apiFromDate, buildQueryFrom, DATA_FROM_DATE, filterFromMinDate, fmt, fmtDate } from '../utils';
import AppHeader from '../components/AppHeader';
import CalidadLineChart from '../components/CalidadLineChart';
import ChartPanel from '../components/ChartPanel';
import LoadingScreen from '../components/LoadingScreen';
import QualityGauge from '../components/QualityGauge';
import SelectedDateBanner from '../components/SelectedDateBanner';

const METRICS = [
  { key: 'fat', label: 'Grasa %' },
  { key: 'protein', label: 'Proteína %' },
  { key: 'lactose', label: 'Lactosa %' },
  { key: 'ts', label: 'Sólidos totales %' },
  { key: 'fpd', label: 'Punto congelación' },
  { key: 'casein', label: 'Caseína %' },
  { key: 'urea', label: 'Urea' },
];

function ResumenCard({ title, data }) {
  if (!data) {
    return (
      <div className="stat-card">
        <h3>{title}</h3>
        <p className="empty-state" style={{ padding: '1rem 0' }}>Sin datos</p>
      </div>
    );
  }

  return (
    <div className="stat-card">
      <h3>{title}</h3>
      {data.collection_date && (
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: 'var(--muted)' }}>
          Fecha: {fmtDate(data.collection_date)}
          {data.sub != null && ` · Muestra ${data.sub}`}
        </p>
      )}
      {METRICS.map(({ key, label }) => (
        <div className="stat-row" key={key}>
          <span>{label}</span>
          <span className="value">{fmt(data[key])}</span>
        </div>
      ))}
    </div>
  );
}

export default function Composicion() {
  const navigate = useNavigate();
  const [registros, setRegistros] = useState([]);
  const [chartRegistros, setChartRegistros] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [from, setFrom] = useState(DATA_FROM_DATE);
  const [to, setTo] = useState('');
  const monthLabel = getCurrentMonthRange().label;

  async function loadChartRegistros() {
    const data = await api(`/api/calidad-composicion?from=${apiFromDate(90)}`);
    setChartRegistros(filterFromMinDate(data.data, 'collection_date'));
  }

  async function loadRegistros() {
    const params = new URLSearchParams();
    params.set('from', buildQueryFrom(from));
    if (to) params.set('to', to);
    const data = await api(`/api/calidad-composicion?${params.toString()}`);
    setRegistros(filterFromMinDate(data.data, 'collection_date'));
  }

  useEffect(() => {
    async function init() {
      try {
        await Promise.all([loadRegistros(), loadChartRegistros()]);
      } catch (err) {
        if (err.message.includes('Token')) {
          clearToken();
          navigate('/login');
        } else {
          setError(err.message);
        }
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [navigate]);

  async function handleFilter(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSelectedDate(null);
    try {
      await loadRegistros();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const calidadChart = useMemo(
    () => filterLastDays(avgCalidadByDate(chartRegistros), 90),
    [chartRegistros]
  );

  const selectedRows = useMemo(
    () => rowsOnDate(chartRegistros, 'collection_date', selectedDate),
    [chartRegistros, selectedDate]
  );

  const ultimo = selectedDate
    ? avgCalidadSnapshot(selectedRows)
    : chartRegistros[0] || null;

  const promedioMes = avgCalidadMonth(chartRegistros);

  function handleDateSelect(date) {
    setSelectedDate((current) => toggleSelectedDate(current, date));
  }

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="layout">
      <AppHeader />

      <main className="main">
        <h2 className="page-title">Composición</h2>
        {error && <div className="error-msg">{error}</div>}

        <SelectedDateBanner date={selectedDate} onClear={() => setSelectedDate(null)} />

        <div className="cards-grid">
          <ResumenCard
            title={`Promedio mes corriente (${monthLabel})`}
            data={
              promedioMes
                ? { ...promedioMes, collection_date: null }
                : null
            }
          />
        </div>

        <div className="charts-grid">
          <ChartPanel title="Evolucion grasa y proteina (90 dias)">
            <CalidadLineChart
              data={calidadChart}
              selectedDate={selectedDate}
              onDateSelect={handleDateSelect}
            />
          </ChartPanel>
          <ChartPanel
            title={
              selectedDate
                ? `Muestra del ${fmtDate(selectedDate)} — medidores`
                : 'Ultima muestra — medidores'
            }
          >
            <div className="gauges-row">
              <QualityGauge label="Grasa" value={ultimo?.fat} max={6} />
              <QualityGauge label="Proteina" value={ultimo?.protein} max={5} />
              <QualityGauge label="Lactosa" value={ultimo?.lactose} max={6} />
              <QualityGauge label="Solidos totales" value={ultimo?.ts} max={14} />
            </div>
          </ChartPanel>
        </div>

        <form className="filters" onSubmit={handleFilter}>
          <div className="form-group">
            <label htmlFor="from">Desde</label>
            <input
              id="from"
              type="date"
              min={DATA_FROM_DATE}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="to">Hasta</label>
            <input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: 'auto' }}>
            Filtrar
          </button>
        </form>

        <div className="table-wrap">
          {registros.length === 0 ? (
            <div className="empty-state">No hay registros para el período seleccionado.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Sub</th>
                  <th className="num">Grasa</th>
                  <th className="num">Proteína</th>
                  <th className="num">Lactosa</th>
                  <th className="num">ST</th>
                  <th className="num">FPD</th>
                  <th className="num">Caseína</th>
                  <th className="num">Urea</th>
                  <th>Obs.</th>
                </tr>
              </thead>
              <tbody>
                {(selectedDate ? selectedRows : registros).map((r, i) => (
                  <tr key={`${r.collection_date}-${r.sub}-${i}`}>
                    <td>{fmtDate(r.collection_date)}</td>
                    <td>{r.sub}</td>
                    <td className="num">{fmt(r.fat)}</td>
                    <td className="num">{fmt(r.protein)}</td>
                    <td className="num">{fmt(r.lactose)}</td>
                    <td className="num">{fmt(r.ts)}</td>
                    <td className="num">{fmt(r.fpd)}</td>
                    <td className="num">{fmt(r.casein)}</td>
                    <td className="num">{fmt(r.urea)}</td>
                    <td>{r.remarks || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
