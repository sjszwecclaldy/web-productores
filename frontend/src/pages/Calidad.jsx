import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearToken } from '../api';
import { CHART_COLORS, filterLastDays, formatChartDate } from '../chartUtils';
import { apiFromDate, buildQueryFrom, DATA_FROM_DATE, filterFromMinDate, fmt, fmtDate } from '../utils';
import AppHeader from '../components/AppHeader';
import CalidadLineChart from '../components/CalidadLineChart';
import ChartPanel from '../components/ChartPanel';
import LoadingScreen from '../components/LoadingScreen';
import QualityGauge from '../components/QualityGauge';

export default function Calidad() {
  const navigate = useNavigate();
  const [registros, setRegistros] = useState([]);
  const [chartRegistros, setChartRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [from, setFrom] = useState(DATA_FROM_DATE);
  const [to, setTo] = useState('');

  async function loadChart() {
    const data = await api(`/api/calidad-sanitaria?from=${apiFromDate(180)}`);
    setChartRegistros(filterFromMinDate(data.data, 'lab_date'));
  }

  async function loadRegistros() {
    const params = new URLSearchParams();
    params.set('from', buildQueryFrom(from));
    if (to) params.set('to', to);
    const data = await api(`/api/calidad-sanitaria?${params.toString()}`);
    setRegistros(filterFromMinDate(data.data, 'lab_date'));
  }

  useEffect(() => {
    async function init() {
      try {
        await Promise.all([loadRegistros(), loadChart()]);
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

  const serie = useMemo(
    () =>
      filterLastDays(
        [...chartRegistros]
          .map((r) => ({
            date: r.lab_date,
            label: formatChartDate(r.lab_date),
            celulas: r.celulas != null ? Number(r.celulas) : null,
            bacterias: r.bacterias != null ? Number(r.bacterias) : null,
          }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        180
      ),
    [chartRegistros]
  );

  const ultima = chartRegistros[0] || null;

  if (loading && chartRegistros.length === 0) {
    return <LoadingScreen />;
  }

  return (
    <div className="layout">
      <AppHeader />

      <main className="main">
        <h2 className="page-title">Calidad</h2>
        {error && <div className="error-msg">{error}</div>}

        <ChartPanel
          title={ultima ? `Última muestra (${fmtDate(ultima.lab_date)}) — medidores` : 'Última muestra — medidores'}
        >
          <div className="gauges-row">
            <QualityGauge label="Células somáticas" value={ultima?.celulas} max={1000} unit="" />
            <QualityGauge label="Recuento bacteriano" value={ultima?.bacterias} max={200} unit="" />
          </div>
          {!ultima && <p className="chart-empty">Sin muestras de calidad.</p>}
        </ChartPanel>

        <div className="charts-grid">
          <ChartPanel title="Evolución células somáticas">
            <CalidadLineChart
              data={serie}
              series={[{ key: 'celulas', label: 'Cél. somáticas', color: CHART_COLORS.primary }]}
            />
          </ChartPanel>
          <ChartPanel title="Evolución recuento bacteriano">
            <CalidadLineChart
              data={serie}
              series={[{ key: 'bacterias', label: 'Recuento bact.', color: CHART_COLORS.accent }]}
            />
          </ChartPanel>
        </div>

        <form className="filters" onSubmit={handleFilter}>
          <div className="form-group">
            <label htmlFor="from">Desde</label>
            <input id="from" type="date" min={DATA_FROM_DATE} value={from} onChange={(e) => setFrom(e.target.value)} />
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
                  <th className="num">Células somáticas</th>
                  <th className="num">Recuento bacteriano</th>
                  <th>Origen</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((r, i) => (
                  <tr key={`${r.lab_date}-${i}`}>
                    <td>{fmtDate(r.lab_date)}</td>
                    <td className="num">{fmt(r.celulas)}</td>
                    <td className="num">{fmt(r.bacterias)}</td>
                    <td>{r.origen || ''}</td>
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
