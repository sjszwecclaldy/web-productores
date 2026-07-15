import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearToken } from '../api';
import { avgCalidadByDate, dateDaysAgo, filterLastDays } from '../chartUtils';
import { fmt, fmtDate } from '../utils';
import AppHeader from '../components/AppHeader';
import CalidadLineChart from '../components/CalidadLineChart';
import ChartPanel from '../components/ChartPanel';
import QualityGauge from '../components/QualityGauge';

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

export default function Dashboard() {
  const navigate = useNavigate();
  const [resumen, setResumen] = useState(null);
  const [registros, setRegistros] = useState([]);
  const [chartRegistros, setChartRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  async function loadResumen() {
    const data = await api('/api/calidad-composicion/resumen');
    setResumen(data);
  }

  async function loadChartRegistros() {
    const from = dateDaysAgo(90);
    const data = await api(`/api/calidad-composicion?from=${from}`);
    setChartRegistros(data.data);
  }

  async function loadRegistros() {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    const data = await api(`/api/calidad-composicion${qs ? `?${qs}` : ''}`);
    setRegistros(data.data);
  }

  useEffect(() => {
    async function init() {
      try {
        await Promise.all([loadResumen(), loadRegistros(), loadChartRegistros()]);
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
    try {
      await loadRegistros();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading && !resumen) {
    return <div className="loading">Cargando…</div>;
  }

  const calidadChart = filterLastDays(avgCalidadByDate(chartRegistros), 90);
  const ultimo = resumen?.ultimo;

  return (
    <div className="layout">
      <AppHeader />

      <main className="main">
        <h2 className="page-title">Calidad de leche</h2>
        {error && <div className="error-msg">{error}</div>}

        <div className="cards-grid">
          <ResumenCard title="Último análisis" data={resumen?.ultimo} />
          <ResumenCard
            title="Promedio último mes"
            data={
              resumen?.promedio_ultimo_mes
                ? {
                    ...resumen.promedio_ultimo_mes,
                    collection_date: null,
                  }
                : null
            }
          />
        </div>

        <div className="charts-grid">
          <ChartPanel title="Evolucion grasa y proteina (90 dias)">
            <CalidadLineChart data={calidadChart} />
          </ChartPanel>
          <ChartPanel title="Ultima muestra — medidores">
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
                  <th>Grasa</th>
                  <th>Proteína</th>
                  <th>Lactosa</th>
                  <th>ST</th>
                  <th>FPD</th>
                  <th>Caseína</th>
                  <th>Urea</th>
                  <th>Obs.</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((r, i) => (
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
