import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearToken } from '../api';
import { avgByYearMonth, CHART_COLORS, formatChartDate } from '../chartUtils';
import { apiFromDate, buildQueryFrom, DATA_FROM_DATE, filterFromMinDate, fmt, fmtDate, isCurrentMonth } from '../utils';
import AppHeader from '../components/AppHeader';
import CalidadLineChart from '../components/CalidadLineChart';
import ChartPanel from '../components/ChartPanel';
import ExportButton from '../components/ExportButton';
import KpiCard from '../components/KpiCard';
import LoadingScreen from '../components/LoadingScreen';
import PeriodFilter from '../components/PeriodFilter';
import QualityGauge from '../components/QualityGauge';
import YearCompareLineChart from '../components/YearCompareLineChart';

const EXPORT_COLS = [
  { header: 'Fecha', value: (r) => fmtDate(r.lab_date) },
  { header: 'Células somáticas', value: (r) => r.celulas },
  { header: 'Recuento bacteriano', value: (r) => r.bacterias },
];

export default function Calidad() {
  const navigate = useNavigate();
  const [registros, setRegistros] = useState([]);
  const [allRegistros, setAllRegistros] = useState([]);
  const [activePreset, setActivePreset] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [from, setFrom] = useState(() => apiFromDate(30));
  const [to, setTo] = useState('');

  async function loadRegistros(f = from, t = to) {
    const params = new URLSearchParams();
    params.set('from', buildQueryFrom(f));
    if (t) params.set('to', t);
    const data = await api(`/api/calidad-sanitaria?${params.toString()}`);
    setRegistros(filterFromMinDate(data.data, 'lab_date'));
  }

  async function loadYearData() {
    const data = await api(`/api/calidad-sanitaria?from=${DATA_FROM_DATE}`);
    setAllRegistros(filterFromMinDate(data.data, 'lab_date'));
  }

  useEffect(() => {
    async function init() {
      try {
        await Promise.all([loadRegistros(), loadYearData()]);
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

  async function applyPeriod(f, t, preset) {
    setFrom(f);
    setTo(t);
    setActivePreset(preset);
    setLoading(true);
    setError('');
    try {
      await loadRegistros(f, t);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const serie = useMemo(
    () =>
      [...registros]
        .map((r) => ({
          date: r.lab_date,
          label: formatChartDate(r.lab_date),
          celulas: r.celulas != null ? Number(r.celulas) : null,
          bacterias: r.bacterias != null ? Number(r.bacterias) : null,
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [registros]
  );

  const ultima = registros[0] || null;

  const promedios = useMemo(() => {
    const avg = (arr) => (arr.length ? arr.reduce((sum, v) => sum + v, 0) / arr.length : null);
    const cel = registros.filter((r) => r.celulas != null).map((r) => Number(r.celulas));
    const bac = registros.filter((r) => r.bacterias != null).map((r) => Number(r.bacterias));
    return { celulas: avg(cel), bacterias: avg(bac) };
  }, [registros]);

  const yearCelulas = useMemo(() => avgByYearMonth(allRegistros, 'lab_date', 'celulas'), [allRegistros]);
  const yearBacterias = useMemo(() => avgByYearMonth(allRegistros, 'lab_date', 'bacterias'), [allRegistros]);

  const mesCorriente = useMemo(
    () => registros.filter((r) => isCurrentMonth(r.lab_date)),
    [registros]
  );

  const historico = useMemo(
    () => registros.filter((r) => !isCurrentMonth(r.lab_date)),
    [registros]
  );

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="layout">
      <AppHeader />

      <main className="main">
        <h2 className="page-title">Calidad</h2>
        {error && <div className="error-msg">{error}</div>}

        <PeriodFilter from={from} to={to} onFrom={setFrom} onTo={setTo} activePreset={activePreset} onApply={applyPeriod} />

        <div className="kpi-grid">
          <KpiCard
            icon="🔬"
            label="Prom. células somáticas"
            value={promedios.celulas != null ? fmt(promedios.celulas) : '—'}
          />
          <KpiCard
            icon="🦠"
            label="Prom. recuento bacteriano"
            value={promedios.bacterias != null ? fmt(promedios.bacterias) : '—'}
          />
        </div>

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

        <div className="charts-grid">
          <ChartPanel title="Células somáticas — comparación de años">
            <YearCompareLineChart data={yearCelulas.data} years={yearCelulas.years} />
          </ChartPanel>
          <ChartPanel title="Recuento bacteriano — comparación de años">
            <YearCompareLineChart data={yearBacterias.data} years={yearBacterias.years} />
          </ChartPanel>
        </div>

        {mesCorriente.length > 0 && (
          <>
            <h3 className="section-title">Mes corriente — pendiente de validación</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th className="num">Células somáticas</th>
                    <th className="num">Recuento bacteriano</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {mesCorriente.map((r, i) => (
                    <tr key={`mc-${r.lab_date}-${i}`}>
                      <td>{fmtDate(r.lab_date)}</td>
                      <td className="num">{fmt(r.celulas)}</td>
                      <td className="num">{fmt(r.bacterias)}</td>
                      <td><span className="badge badge--pendiente">Pendiente de validación</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="table-toolbar">
          <h3 className="section-title" style={{ margin: 0 }}>Histórico</h3>
          <ExportButton filename="calidad.xlsx" columns={EXPORT_COLS} rows={registros} />
        </div>
        <div className="table-wrap">
          {historico.length === 0 ? (
            <div className="empty-state">No hay registros para el período seleccionado.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th className="num">Células somáticas</th>
                  <th className="num">Recuento bacteriano</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((r, i) => (
                  <tr key={`${r.lab_date}-${i}`}>
                    <td>{fmtDate(r.lab_date)}</td>
                    <td className="num">{fmt(r.celulas)}</td>
                    <td className="num">{fmt(r.bacterias)}</td>
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
