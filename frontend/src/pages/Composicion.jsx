import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, clearToken } from '../api';
import {
  avgByYearMonth,
  avgCalidadByDate,
  avgCalidadSnapshot,
  rowsOnDate,
  toggleSelectedDate,
} from '../chartUtils';
import { apiFromDate, buildQueryFrom, DATA_FROM_DATE, filterFromMinDate, fmt, fmtDate, isCurrentMonth } from '../utils';
import AppHeader from '../components/AppHeader';
import CalidadLineChart from '../components/CalidadLineChart';
import ChartPanel from '../components/ChartPanel';
import ExportButton from '../components/ExportButton';
import LoadingScreen from '../components/LoadingScreen';
import PeriodFilter from '../components/PeriodFilter';
import QualityGauge from '../components/QualityGauge';
import SelectedDateBanner from '../components/SelectedDateBanner';
import YearCompareLineChart from '../components/YearCompareLineChart';

const METRICS = [
  { key: 'fat', label: 'Grasa %' },
  { key: 'protein', label: 'Proteína %' },
  { key: 'lactose', label: 'Lactosa %' },
  { key: 'ts', label: 'Sólidos totales %' },
  { key: 'fpd', label: 'Punto congelación' },
  { key: 'casein', label: 'Caseína %' },
  { key: 'urea', label: 'Urea' },
];

const EXPORT_COLS = [
  { header: 'Fecha', value: (r) => fmtDate(r.collection_date) },
  { header: 'Grasa', value: (r) => r.fat },
  { header: 'Proteína', value: (r) => r.protein },
  { header: 'Lactosa', value: (r) => r.lactose },
  { header: 'Sólidos totales', value: (r) => r.ts },
  { header: 'Punto congelación', value: (r) => r.fpd },
  { header: 'Caseína', value: (r) => r.casein },
  { header: 'Urea', value: (r) => r.urea },
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

function CompoRow({ r }) {
  return (
    <>
      <td>{fmtDate(r.collection_date)}</td>
      <td className="num">{fmt(r.fat)}</td>
      <td className="num">{fmt(r.protein)}</td>
      <td className="num">{fmt(r.lactose)}</td>
      <td className="num">{fmt(r.ts)}</td>
      <td className="num">{fmt(r.fpd)}</td>
      <td className="num">{fmt(r.casein)}</td>
      <td className="num">{fmt(r.urea)}</td>
    </>
  );
}

export default function Composicion() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlight = searchParams.get('fecha');
  const [registros, setRegistros] = useState([]);
  const [allRegistros, setAllRegistros] = useState([]);
  const [activePreset, setActivePreset] = useState(30);
  const [selectedDate, setSelectedDate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [from, setFrom] = useState(() => {
    const def = apiFromDate(30);
    return highlight && highlight < def ? highlight : def;
  });
  const [to, setTo] = useState('');

  async function loadRegistros(f = from, t = to) {
    const params = new URLSearchParams();
    params.set('from', buildQueryFrom(f));
    if (t) params.set('to', t);
    const data = await api(`/api/calidad-composicion?${params.toString()}`);
    setRegistros(filterFromMinDate(data.data, 'collection_date'));
  }

  async function loadYearData() {
    const data = await api(`/api/calidad-composicion?from=${DATA_FROM_DATE}`);
    setAllRegistros(filterFromMinDate(data.data, 'collection_date'));
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
    setSelectedDate(null);
    try {
      await loadRegistros(f, t);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const calidadChart = useMemo(() => avgCalidadByDate(registros), [registros]);

  const selectedRows = useMemo(
    () => rowsOnDate(registros, 'collection_date', selectedDate),
    [registros, selectedDate]
  );

  const ultimo = selectedDate ? avgCalidadSnapshot(selectedRows) : registros[0] || null;

  const promedioPeriodo = useMemo(() => avgCalidadSnapshot(registros), [registros]);

  const yearGrasa = useMemo(() => avgByYearMonth(allRegistros, 'collection_date', 'fat'), [allRegistros]);
  const yearProteina = useMemo(() => avgByYearMonth(allRegistros, 'collection_date', 'protein'), [allRegistros]);

  const mesCorriente = useMemo(
    () => registros.filter((r) => isCurrentMonth(r.collection_date)),
    [registros]
  );

  const historico = useMemo(() => {
    const base = selectedDate ? selectedRows : registros;
    return base.filter((r) => !isCurrentMonth(r.collection_date));
  }, [selectedDate, selectedRows, registros]);

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

        <PeriodFilter from={from} to={to} onFrom={setFrom} onTo={setTo} activePreset={activePreset} onApply={applyPeriod} />

        <SelectedDateBanner date={selectedDate} onClear={() => setSelectedDate(null)} />

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

        <div className="cards-grid">
          <ResumenCard
            title="Promedio del período"
            data={promedioPeriodo ? { ...promedioPeriodo, collection_date: null } : null}
          />
        </div>

        <div className="charts-grid">
          <ChartPanel title="Evolución grasa y proteína">
            <CalidadLineChart
              data={calidadChart}
              selectedDate={selectedDate}
              onDateSelect={handleDateSelect}
            />
          </ChartPanel>
        </div>

        <div className="charts-grid">
          <ChartPanel title="Grasa — comparación de años">
            <YearCompareLineChart data={yearGrasa.data} years={yearGrasa.years} unit="%" />
          </ChartPanel>
          <ChartPanel title="Proteína — comparación de años">
            <YearCompareLineChart data={yearProteina.data} years={yearProteina.years} unit="%" />
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
                    <th className="num">Grasa</th>
                    <th className="num">Proteína</th>
                    <th className="num">Lactosa</th>
                    <th className="num">ST</th>
                    <th className="num">FPD</th>
                    <th className="num">Caseína</th>
                    <th className="num">Urea</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {mesCorriente.map((r, i) => (
                    <tr
                      key={`mc-${r.collection_date}-${i}`}
                      className={highlight && String(r.collection_date).slice(0, 10) === highlight ? 'row-highlight' : undefined}
                    >
                      <CompoRow r={r} />
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
          <ExportButton filename="composicion.xlsx" columns={EXPORT_COLS} rows={registros} />
        </div>
        <div className="table-wrap">
          {historico.length === 0 ? (
            <div className="empty-state">No hay registros para el período seleccionado.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th className="num">Grasa</th>
                  <th className="num">Proteína</th>
                  <th className="num">Lactosa</th>
                  <th className="num">ST</th>
                  <th className="num">FPD</th>
                  <th className="num">Caseína</th>
                  <th className="num">Urea</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((r, i) => (
                  <tr
                    key={`${r.collection_date}-${i}`}
                    className={highlight && String(r.collection_date).slice(0, 10) === highlight ? 'row-highlight' : undefined}
                  >
                    <CompoRow r={r} />
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
