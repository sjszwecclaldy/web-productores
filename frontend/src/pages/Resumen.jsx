import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearToken } from '../api';
import {
  avgCalidadByDate,
  avgDailyCurrentMonth,
  calcDayOverDayDelta,
  calcDeltaForDate,
  filterLastDays,
  getCurrentMonthRange,
  groupSumByDate,
  rowsOnDate,
  toggleSelectedDate,
} from '../chartUtils';
import { apiFromDate, DATA_FROM_DATE, filterFromMinDate, fmt, fmtDate } from '../utils';
import AppHeader from '../components/AppHeader';
import CalidadLineChart from '../components/CalidadLineChart';
import ChartPanel from '../components/ChartPanel';
import KpiCard from '../components/KpiCard';
import LitrosLineChart from '../components/LitrosLineChart';
import LoadingScreen from '../components/LoadingScreen';
import QualityGauge from '../components/QualityGauge';
import SelectedDateBanner from '../components/SelectedDateBanner';

export default function Resumen() {
  const navigate = useNavigate();
  const [remisiones, setRemisiones] = useState([]);
  const [calidad, setCalidad] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const monthLabel = getCurrentMonthRange().label;

  useEffect(() => {
    async function init() {
      try {
        const yearStart = `${new Date().getFullYear()}-01-01`;
        const remFrom = yearStart < DATA_FROM_DATE ? DATA_FROM_DATE : yearStart;
        const [remData, calData] = await Promise.all([
          api(`/api/remisiones?from=${remFrom}`),
          api(`/api/calidad-composicion?from=${apiFromDate(90)}`),
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

  const calidadChart = useMemo(() => avgCalidadByDate(calidad), [calidad]);
  const calidadChartVisible = useMemo(
    () => filterLastDays(calidadChart, 90),
    [calidadChart]
  );

  const litrosDelta = useMemo(() => {
    if (selectedDate) return calcDeltaForDate(litrosByDay, selectedDate);
    return calcDayOverDayDelta(litrosByDay);
  }, [litrosByDay, selectedDate]);

  const promedioDiario = useMemo(() => avgDailyCurrentMonth(litrosByDay), [litrosByDay]);

  const selectedRemisiones = useMemo(
    () => rowsOnDate(remisiones, 'doc_date', selectedDate),
    [remisiones, selectedDate]
  );

  const selectedCalidadPoint = useMemo(
    () => calidadChart.find((row) => String(row.date).slice(0, 10) === selectedDate) || null,
    [calidadChart, selectedDate]
  );

  const gaugeCal = useMemo(() => {
    if (selectedDate) {
      return selectedCalidadPoint;
    }
    return calidad[0] || null;
  }, [selectedDate, selectedCalidadPoint, calidad]);

  const ultimoRem = selectedDate
    ? selectedRemisiones[0] || null
    : remisiones[0] || null;

  const litrosSeleccionados = selectedDate
    ? selectedRemisiones.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0)
    : null;

  const ultimoCal = gaugeCal;

  const ultimasEntregas = selectedDate
    ? selectedRemisiones
    : remisiones.slice(0, 10);

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
        <h2 className="page-title">Resumen</h2>
        {error && <div className="error-msg">{error}</div>}

        <SelectedDateBanner date={selectedDate} onClear={() => setSelectedDate(null)} />

        <div className="kpi-grid">
          <KpiCard
            icon="🥛"
            label={selectedDate ? `Entrega (${fmtDate(selectedDate)})` : 'Ultima entrega'}
            value={
              selectedDate
                ? litrosSeleccionados > 0
                  ? `${fmt(litrosSeleccionados)} L`
                  : '—'
                : ultimoRem
                  ? `${fmt(ultimoRem.quantity)} L`
                  : '—'
            }
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
            label={selectedDate ? `Grasa (${fmtDate(selectedDate)})` : 'Grasa ultima muestra'}
            value={ultimoCal?.fat != null ? `${fmt(ultimoCal.fat)} %` : '—'}
          />
          <KpiCard
            icon="🧬"
            label={selectedDate ? `Proteina (${fmtDate(selectedDate)})` : 'Proteina ultima muestra'}
            value={ultimoCal?.protein != null ? `${fmt(ultimoCal.protein)} %` : '—'}
          />
        </div>

        <div className="charts-grid">
          <ChartPanel title="Litros entregados por día (año corriente)">
            <LitrosLineChart
              data={litrosByDay}
              selectedDate={selectedDate}
              onDateSelect={handleDateSelect}
            />
          </ChartPanel>

          <ChartPanel title="Evolucion composicion (grasa y proteina)">
            <CalidadLineChart
              data={calidadChartVisible}
              selectedDate={selectedDate}
              onDateSelect={handleDateSelect}
            />
          </ChartPanel>
        </div>

        <div className="gauges-grid">
          <ChartPanel
            title={
              selectedDate
                ? `Muestra del ${fmtDate(selectedDate)} — medidores`
                : 'Ultima muestra — medidores'
            }
          >
            <div className="gauges-row">
              <QualityGauge label="Grasa" value={gaugeCal?.fat} max={6} />
              <QualityGauge label="Proteina" value={gaugeCal?.protein} max={5} />
              <QualityGauge label="Lactosa" value={gaugeCal?.lactose} max={6} />
              <QualityGauge label="Solidos totales" value={gaugeCal?.ts} max={14} />
            </div>
            {selectedDate && !gaugeCal && (
              <p className="chart-empty">Sin muestras de composicion para este dia.</p>
            )}
          </ChartPanel>
        </div>

        <ChartPanel title={selectedDate ? `Entregas del ${fmtDate(selectedDate)}` : 'Ultimas entregas'}>
          <div className="table-wrap table-wrap--flat">
            {ultimasEntregas.length === 0 ? (
              <div className="empty-state">
                {selectedDate ? 'Sin entregas para el dia seleccionado.' : 'Sin entregas recientes.'}
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Remito</th>
                    <th className="num">Litros</th>
                  </tr>
                </thead>
                <tbody>
                  {ultimasEntregas.map((r, i) => (
                    <tr key={`${r.doc_num}-${i}`}>
                      <td>{fmtDate(r.doc_date)}</td>
                      <td>{r.doc_num}</td>
                      <td className="num">{fmt(r.quantity)}</td>
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
