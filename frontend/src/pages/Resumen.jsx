import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearToken } from '../api';
import {
  avgCalidadByDate,
  avgDailyCurrentMonth,
  calcDayOverDayDelta,
  filterLastDays,
  getCurrentMonthRange,
  groupSumByDate,
} from '../chartUtils';
import { apiFromDate, filterFromMinDate, fmt, fmtDate } from '../utils';
import AppHeader from '../components/AppHeader';
import CalidadLineChart from '../components/CalidadLineChart';
import ChartPanel from '../components/ChartPanel';
import KpiCard from '../components/KpiCard';
import LitrosBarChart from '../components/LitrosBarChart';
import LoadingScreen from '../components/LoadingScreen';
import QualityGauge from '../components/QualityGauge';

const PERIOD_OPTIONS = [
  { days: 14, label: '14 dias' },
  { days: 30, label: '30 dias' },
  { days: 90, label: '90 dias' },
];

export default function Resumen() {
  const navigate = useNavigate();
  const [remisiones, setRemisiones] = useState([]);
  const [calidad, setCalidad] = useState([]);
  const [chartDays, setChartDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const monthLabel = getCurrentMonthRange().label;

  useEffect(() => {
    async function init() {
      try {
        const from = apiFromDate(90);
        const [remData, calData] = await Promise.all([
          api(`/api/remisiones?from=${from}`),
          api(`/api/calidad-composicion?from=${from}`),
        ]);
        setRemisiones(filterFromMinDate(remData.data, 'doc_date'));
        setCalidad(filterFromMinDate(calData.data, 'collection_date'));
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

  const litrosByDay = useMemo(
    () => groupSumByDate(remisiones, 'doc_date', 'quantity'),
    [remisiones]
  );

  const chartLitros = useMemo(
    () => filterLastDays(litrosByDay, chartDays),
    [litrosByDay, chartDays]
  );

  const calidadChart = useMemo(() => avgCalidadByDate(calidad), [calidad]);

  const litrosDelta = useMemo(() => calcDayOverDayDelta(litrosByDay), [litrosByDay]);
  const promedioDiario = useMemo(() => avgDailyCurrentMonth(litrosByDay), [litrosByDay]);

  const ultimoRem = remisiones[0] || null;
  const ultimoCal = calidad[0] || null;
  const ultimasEntregas = remisiones.slice(0, 10);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="layout">
      <AppHeader />

      <main className="main">
        <h2 className="page-title">Resumen</h2>
        {error && <div className="error-msg">{error}</div>}

        <div className="kpi-grid">
          <KpiCard
            icon="🥛"
            label="Ultima entrega"
            value={ultimoRem ? `${fmt(ultimoRem.quantity)} L` : '—'}
            delta={litrosDelta}
            deltaLabel="% vs dia anterior"
          />
          <KpiCard
            icon="📊"
            label={`Promedio diario (${monthLabel})`}
            value={promedioDiario != null ? `${fmt(promedioDiario)} L` : '—'}
          />
          <KpiCard
            icon="🧪"
            label="Grasa ultima muestra"
            value={ultimoCal?.fat != null ? `${fmt(ultimoCal.fat)} %` : '—'}
          />
          <KpiCard
            icon="🧬"
            label="Proteina ultima muestra"
            value={ultimoCal?.protein != null ? `${fmt(ultimoCal.protein)} %` : '—'}
          />
        </div>

        <div className="charts-grid">
          <ChartPanel
            title="Litros entregados por dia"
            actions={
              <div className="period-toggle">
                {PERIOD_OPTIONS.map(({ days, label }) => (
                  <button
                    key={days}
                    type="button"
                    className={`period-toggle__btn${chartDays === days ? ' active' : ''}`}
                    onClick={() => setChartDays(days)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            }
          >
            <LitrosBarChart data={chartLitros} />
          </ChartPanel>

          <ChartPanel title="Evolucion calidad (grasa y proteina)">
            <CalidadLineChart data={filterLastDays(calidadChart, 90)} />
          </ChartPanel>
        </div>

        <div className="gauges-grid">
          <ChartPanel title="Ultima muestra — medidores">
            <div className="gauges-row">
              <QualityGauge label="Grasa" value={ultimoCal?.fat} max={6} />
              <QualityGauge label="Proteina" value={ultimoCal?.protein} max={5} />
              <QualityGauge label="Lactosa" value={ultimoCal?.lactose} max={6} />
              <QualityGauge label="Solidos totales" value={ultimoCal?.ts} max={14} />
            </div>
          </ChartPanel>
        </div>

        <ChartPanel title="Ultimas entregas">
          <div className="table-wrap table-wrap--flat">
            {ultimasEntregas.length === 0 ? (
              <div className="empty-state">Sin entregas recientes.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Remito</th>
                    <th>Litros</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ultimasEntregas.map((r, i) => (
                    <tr key={`${r.doc_num}-${i}`}>
                      <td>{fmtDate(r.doc_date)}</td>
                      <td>{r.doc_num}</td>
                      <td className="num">{fmt(r.quantity)}</td>
                      <td className="num">{fmt(r.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </ChartPanel>
      </main>
    </div>
  );
}
