import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearToken } from '../api';
import {
  filterLastDays,
  getCurrentMonthRange,
  groupSumByDate,
  rowsOnDate,
  sumRemisionesMonth,
  toggleSelectedDate,
} from '../chartUtils';
import { apiFromDate, buildQueryFrom, DATA_FROM_DATE, filterFromMinDate, fmt, fmtDate } from '../utils';
import AppHeader from '../components/AppHeader';
import ChartPanel from '../components/ChartPanel';
import LitrosBarChart from '../components/LitrosBarChart';
import LoadingScreen from '../components/LoadingScreen';
import SelectedDateBanner from '../components/SelectedDateBanner';

export default function Remisiones() {
  const navigate = useNavigate();
  const [registros, setRegistros] = useState([]);
  const [chartRegistros, setChartRegistros] = useState([]);
  const [chartDays, setChartDays] = useState(30);
  const [selectedDate, setSelectedDate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [from, setFrom] = useState(DATA_FROM_DATE);
  const [to, setTo] = useState('');
  const monthLabel = getCurrentMonthRange().label;

  async function loadChartRegistros() {
    const data = await api(`/api/remisiones?from=${apiFromDate(90)}`);
    setChartRegistros(filterFromMinDate(data.data, 'doc_date'));
  }

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

  const chartLitros = useMemo(
    () => filterLastDays(groupSumByDate(chartRegistros, 'doc_date', 'quantity'), chartDays),
    [chartRegistros, chartDays]
  );

  const selectedRemisiones = useMemo(
    () => rowsOnDate(chartRegistros, 'doc_date', selectedDate),
    [chartRegistros, selectedDate]
  );

  const ultimo = selectedDate ? selectedRemisiones[0] || null : chartRegistros[0] || null;

  const totalesDia = useMemo(() => {
    if (!selectedDate) return null;
    return {
      total_litros: selectedRemisiones.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0),
      total_importe: selectedRemisiones.reduce((sum, row) => sum + (Number(row.line_total) || 0), 0),
      entregas: selectedRemisiones.length,
    };
  }, [selectedDate, selectedRemisiones]);

  const totales = selectedDate ? totalesDia : sumRemisionesMonth(chartRegistros);

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
                <div className="stat-row"><span>Precio</span><span className="value">{fmt(ultimo.price)}</span></div>
                <div className="stat-row"><span>Total</span><span className="value">{fmt(ultimo.line_total)}</span></div>
              </>
            ) : (
              <p className="empty-state" style={{ padding: '1rem 0' }}>Sin datos</p>
            )}
          </div>

          <div className="stat-card">
            <h3>
              {selectedDate
                ? `Totales del ${fmtDate(selectedDate)}`
                : `Totales mes corriente (${monthLabel})`}
            </h3>
            {totales && totales.entregas > 0 ? (
              <>
                <div className="stat-row"><span>Litros entregados</span><span className="value">{fmt(totales.total_litros)}</span></div>
                <div className="stat-row"><span>Importe total</span><span className="value">{fmt(totales.total_importe)}</span></div>
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
                  <th>Litros</th>
                  <th>Precio</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {tablaRegistros.map((r, i) => (
                  <tr key={`${r.doc_num}-${i}`}>
                    <td>{fmtDate(r.doc_date)}</td>
                    <td>{r.doc_num}</td>
                    <td className="num">{fmt(r.quantity)}</td>
                    <td className="num">{fmt(r.price)}</td>
                    <td className="num">{fmt(r.line_total)}</td>
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
