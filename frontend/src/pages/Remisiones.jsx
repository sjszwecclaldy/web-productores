import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearToken } from '../api';
import {
  filterLastDays,
  groupSumByDate,
  groupSumByMonth,
  litrosByYearMonth,
  rowsOnDate,
  toggleSelectedDate,
} from '../chartUtils';
import { buildQueryFrom, DATA_FROM_DATE, filterFromMinDate, fmt, fmtDate } from '../utils';
import AppHeader from '../components/AppHeader';
import ChartPanel from '../components/ChartPanel';
import LitrosBarChart from '../components/LitrosBarChart';
import LitrosLineChart from '../components/LitrosLineChart';
import YearCompareLineChart from '../components/YearCompareLineChart';
import LoadingScreen from '../components/LoadingScreen';
import PeriodFilter from '../components/PeriodFilter';
import SelectedDateBanner from '../components/SelectedDateBanner';

export default function Remisiones() {
  const navigate = useNavigate();
  const [registros, setRegistros] = useState([]);
  const [chartDays, setChartDays] = useState(30);
  const [selectedDate, setSelectedDate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [from, setFrom] = useState(DATA_FROM_DATE);
  const [to, setTo] = useState('');

  async function loadRegistros() {
    const params = new URLSearchParams();
    params.set('from', buildQueryFrom(from));
    if (to) params.set('to', to);
    const data = await api(`/api/remisiones?${params.toString()}`);
    setRegistros(filterFromMinDate(data.data, 'doc_date'));
  }

  useEffect(() => {
    async function init() {
      try {
        await loadRegistros();
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

  const chartLitros = useMemo(
    () => filterLastDays(groupSumByDate(registros, 'doc_date', 'quantity'), chartDays),
    [registros, chartDays]
  );

  const yearCompare = useMemo(
    () => litrosByYearMonth(registros, 'doc_date', 'quantity'),
    [registros]
  );

  const litrosPorMes = useMemo(
    () => groupSumByMonth(registros, 'doc_date', 'quantity').slice(-12),
    [registros]
  );

  const selectedRemisiones = useMemo(
    () => rowsOnDate(registros, 'doc_date', selectedDate),
    [registros, selectedDate]
  );

  const ultimo = selectedDate ? selectedRemisiones[0] || null : registros[0] || null;

  const totales = useMemo(() => {
    const src = selectedDate ? selectedRemisiones : registros;
    return {
      total_litros: src.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0),
      entregas: src.length,
    };
  }, [selectedDate, selectedRemisiones, registros]);

  const tablaRegistros = selectedDate ? selectedRemisiones : registros;

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
        <h2 className="page-title">Remisiones</h2>
        {error && <div className="error-msg">{error}</div>}

        <PeriodFilter from={from} to={to} onFrom={setFrom} onTo={setTo} onSubmit={handleFilter} />

        <SelectedDateBanner date={selectedDate} onClear={() => setSelectedDate(null)} />

        <div className="cards-grid">
          <div className="stat-card">
            <h3>{selectedDate ? `Remito del ${fmtDate(selectedDate)}` : 'Último remito'}</h3>
            {ultimo ? (
              <>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: 'var(--muted)' }}>
                  Fecha: {fmtDate(ultimo.doc_date)}
                  {ultimo.doc_num != null && ` · Remito ${ultimo.doc_num}`}
                </p>
                <div className="stat-row"><span>Litros</span><span className="value">{fmt(ultimo.quantity)}</span></div>
              </>
            ) : (
              <p className="empty-state" style={{ padding: '1rem 0' }}>Sin datos</p>
            )}
          </div>

          <div className="stat-card">
            <h3>{selectedDate ? `Totales del ${fmtDate(selectedDate)}` : 'Totales del período'}</h3>
            {totales.entregas > 0 ? (
              <>
                <div className="stat-row"><span>Litros entregados</span><span className="value">{fmt(totales.total_litros)}</span></div>
                <div className="stat-row"><span>Entregas</span><span className="value">{totales.entregas}</span></div>
              </>
            ) : (
              <p className="empty-state" style={{ padding: '1rem 0' }}>Sin datos</p>
            )}
          </div>
        </div>

        <ChartPanel
          title="Litros entregados por dia"
          actions={
            <div className="period-toggle">
              {[14, 30, 90].map((days) => (
                <button
                  key={days}
                  type="button"
                  className={`period-toggle__btn${chartDays === days ? ' active' : ''}`}
                  onClick={() => setChartDays(days)}
                >
                  {days} dias
                </button>
              ))}
            </div>
          }
        >
          <LitrosBarChart
            data={chartLitros}
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
          />
        </ChartPanel>

        <ChartPanel title="Litros por mes">
          <LitrosLineChart data={litrosPorMes} dots />
        </ChartPanel>

        <ChartPanel title="Litros por mes — comparación de años">
          <YearCompareLineChart data={yearCompare.data} years={yearCompare.years} />
        </ChartPanel>

        <div className="table-wrap">
          {tablaRegistros.length === 0 ? (
            <div className="empty-state">
              {selectedDate
                ? 'No hay remitos para el dia seleccionado.'
                : 'No hay remitos para el período seleccionado.'}
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
                {tablaRegistros.map((r, i) => (
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
      </main>
    </div>
  );
}
