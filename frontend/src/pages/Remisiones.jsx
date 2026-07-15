import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearToken } from '../api';
import { dateDaysAgo, filterLastDays, groupSumByDate } from '../chartUtils';
import { fmt, fmtDate } from '../utils';
import AppHeader from '../components/AppHeader';
import ChartPanel from '../components/ChartPanel';
import LitrosBarChart from '../components/LitrosBarChart';

export default function Remisiones() {
  const navigate = useNavigate();
  const [resumen, setResumen] = useState(null);
  const [registros, setRegistros] = useState([]);
  const [chartRegistros, setChartRegistros] = useState([]);
  const [chartDays, setChartDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  async function loadResumen() {
    const data = await api('/api/remisiones/resumen');
    setResumen(data);
  }

  async function loadChartRegistros() {
    const from = dateDaysAgo(90);
    const data = await api(`/api/remisiones?from=${from}`);
    setChartRegistros(data.data);
  }

  async function loadRegistros() {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    const data = await api(`/api/remisiones${qs ? `?${qs}` : ''}`);
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

  const chartLitros = useMemo(
    () => filterLastDays(groupSumByDate(chartRegistros, 'doc_date', 'quantity'), chartDays),
    [chartRegistros, chartDays]
  );

  if (loading && !resumen) {
    return <div className="loading">Cargando…</div>;
  }

  const ultimo = resumen?.ultimo;
  const totales = resumen?.totales_ultimo_mes;

  return (
    <div className="layout">
      <AppHeader />

      <main className="main">
        <h2 className="page-title">Remisiones</h2>
        {error && <div className="error-msg">{error}</div>}

        <div className="cards-grid">
          <div className="stat-card">
            <h3>Último remito</h3>
            {ultimo ? (
              <>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: 'var(--muted)' }}>
                  Fecha: {fmtDate(ultimo.doc_date)}
                  {ultimo.doc_num != null && ` · Remito ${ultimo.doc_num}`}
                </p>
                <div className="stat-row"><span>Producto</span><span className="value">{ultimo.descripcion || '—'}</span></div>
                <div className="stat-row"><span>Litros</span><span className="value">{fmt(ultimo.quantity)}</span></div>
                <div className="stat-row"><span>Precio</span><span className="value">{fmt(ultimo.price)}</span></div>
                <div className="stat-row"><span>Total</span><span className="value">{fmt(ultimo.line_total)}</span></div>
              </>
            ) : (
              <p className="empty-state" style={{ padding: '1rem 0' }}>Sin datos</p>
            )}
          </div>

          <div className="stat-card">
            <h3>Totales último mes</h3>
            {totales ? (
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
          <LitrosBarChart data={chartLitros} />
        </ChartPanel>

        <form className="filters" onSubmit={handleFilter}>
          <div className="form-group">
            <label htmlFor="from">Desde</label>
            <input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
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
            <div className="empty-state">No hay remitos para el período seleccionado.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Remito</th>
                  <th>Producto</th>
                  <th>Litros</th>
                  <th>Precio</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((r, i) => (
                  <tr key={`${r.doc_num}-${i}`}>
                    <td>{fmtDate(r.doc_date)}</td>
                    <td>{r.doc_num}</td>
                    <td>{r.descripcion || ''}</td>
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
