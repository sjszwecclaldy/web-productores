import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearToken } from '../api';
import {
  avgCalidadByDate,
  calcDayOverDayDelta,
  calcDeltaForDate,
  groupSumByDate,
  rowsOnDate,
  toggleSelectedDate,
} from '../chartUtils';
import { buildQueryFrom, DATA_FROM_DATE, filterFromMinDate, fmt, fmtDate } from '../utils';
import AppHeader from '../components/AppHeader';
import CalidadLineChart from '../components/CalidadLineChart';
import ChartPanel from '../components/ChartPanel';
import KpiCard from '../components/KpiCard';
import LitrosLineChart from '../components/LitrosLineChart';
import LoadingScreen from '../components/LoadingScreen';
import PeriodFilter from '../components/PeriodFilter';
import QualityGauge from '../components/QualityGauge';
import SelectedDateBanner from '../components/SelectedDateBanner';

function defaultFrom() {
  const yearStart = `${new Date().getFullYear()}-01-01`;
  return yearStart < DATA_FROM_DATE ? DATA_FROM_DATE : yearStart;
}

export default function Resumen() {
  const navigate = useNavigate();
  const [remisiones, setRemisiones] = useState([]);
  const [calidad, setCalidad] = useState([]);
  const [calidadSan, setCalidadSan] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState('');

  async function loadAll() {
    const params = new URLSearchParams();
    params.set('from', buildQueryFrom(from));
    if (to) params.set('to', to);
    const qs = params.toString();
    const [remData, calData, sanData] = await Promise.all([
      api(`/api/remisiones?${qs}`),
      api(`/api/calidad-composicion?${qs}`),
      api(`/api/calidad-sanitaria?${qs}`),
    ]);
    setRemisiones(filterFromMinDate(remData.data, 'doc_date'));
    setCalidad(filterFromMinDate(calData.data, 'collection_date'));
    setCalidadSan(filterFromMinDate(sanData.data, 'lab_date'));
  }

  useEffect(() => {
    async function init() {
      try {
        await loadAll();
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
      await loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const litrosByDay = useMemo(
    () => groupSumByDate(remisiones, 'doc_date', 'quantity'),
    [remisiones]
  );

  const calidadChart = useMemo(() => avgCalidadByDate(calidad), [calidad]);

  const litrosDelta = useMemo(() => {
    if (selectedDate) return calcDeltaForDate(litrosByDay, selectedDate);
    return calcDayOverDayDelta(litrosByDay);
  }, [litrosByDay, selectedDate]);

  const promedioDiario = useMemo(() => {
    if (!litrosByDay.length) return null;
    const total = litrosByDay.reduce((sum, d) => sum + (Number(d.total) || 0), 0);
    return total / litrosByDay.length;
  }, [litrosByDay]);

  const promedioSanitaria = useMemo(() => {
    const avg = (arr) => (arr.length ? arr.reduce((sum, v) => sum + v, 0) / arr.length : null);
    const cel = calidadSan.filter((r) => r.celulas != null).map((r) => Number(r.celulas));
    const bac = calidadSan.filter((r) => r.bacterias != null).map((r) => Number(r.bacterias));
    return { celulas: avg(cel), bacterias: avg(bac) };
  }, [calidadSan]);

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

        <PeriodFilter from={from} to={to} onFrom={setFrom} onTo={setTo} onSubmit={handleFilter} />

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
            label="Promedio diario del período"
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
          <KpiCard
            icon="🔬"
            label="Prom. células somáticas"
            value={promedioSanitaria.celulas != null ? fmt(promedioSanitaria.celulas) : '—'}
          />
          <KpiCard
            icon="🦠"
            label="Prom. recuento bacteriano"
            value={promedioSanitaria.bacterias != null ? fmt(promedioSanitaria.bacterias) : '—'}
          />
        </div>

        <div className="charts-grid">
          <ChartPanel title="Litros entregados por día">
            <LitrosLineChart
              data={litrosByDay}
              selectedDate={selectedDate}
              onDateSelect={handleDateSelect}
            />
          </ChartPanel>

          <ChartPanel title="Evolucion composicion (grasa y proteina)">
            <CalidadLineChart
              data={calidadChart}
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
