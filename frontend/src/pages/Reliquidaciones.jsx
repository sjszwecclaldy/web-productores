import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearToken } from '../api';
import { apiFromDate, buildQueryFrom, DATA_FROM_DATE, filterFromMinDate, fmt, fmtDate } from '../utils';
import AppHeader from '../components/AppHeader';
import ChartPanel from '../components/ChartPanel';
import LoadingScreen from '../components/LoadingScreen';
import MonthlyBarChart from '../components/MonthlyBarChart';
import { CHART_COLORS, getCurrentMonthRange, groupSumByMonth, sumReliquidacionesMonth } from '../chartUtils';

export default function Reliquidaciones() {
  const navigate = useNavigate();
  const [registros, setRegistros] = useState([]);
  const [chartRegistros, setChartRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [from, setFrom] = useState(DATA_FROM_DATE);
  const [to, setTo] = useState('');
  const monthLabel = getCurrentMonthRange().label;

  async function loadChartRegistros() {
    const data = await api(`/api/reliquidaciones?from=${apiFromDate(365)}`);
    setChartRegistros(filterFromMinDate(data.data, 'doc_date'));
  }

  async function loadRegistros() {
    const params = new URLSearchParams();
    params.set('from', buildQueryFrom(from));
    if (to) params.set('to', to);
    const data = await api(`/api/reliquidaciones?${params.toString()}`);
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
    try {
      await loadRegistros();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const chartMonthly = useMemo(() => {
    const rows = groupSumByMonth(chartRegistros, 'doc_date', 'line_total');
    return rows.map((r) => ({ ...r, importe: r.total }));
  }, [chartRegistros]);

  if (loading) {
    return <LoadingScreen />;
  }

  const ultima = chartRegistros[0] || null;
  const totales = sumReliquidacionesMonth(chartRegistros);

  return (
    <div className="layout">
      <AppHeader />

      <main className="main">
        <h2 className="page-title">Reliquidaciones</h2>
        {error && <div className="error-msg">{error}</div>}

        <div className="cards-grid">
          <div className="stat-card">
            <h3>Última reliquidación</h3>
            {ultima ? (
              <>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: 'var(--muted)' }}>
                  Fecha: {fmtDate(ultima.doc_date)}
                  {ultima.doc_num != null && ` · Doc. ${ultima.doc_num}`}
                </p>
                {ultima.descripcion && (
                  <div className="stat-row"><span>Concepto</span><span className="value">{ultima.descripcion}</span></div>
                )}
                <div className="stat-row"><span>Importe</span><span className="value">{fmt(ultima.line_total)}</span></div>
              </>
            ) : (
              <p className="empty-state" style={{ padding: '1rem 0' }}>Sin datos</p>
            )}
          </div>

          <div className="stat-card">
            <h3>Totales mes corriente ({monthLabel})</h3>
            {totales.reliquidaciones > 0 ? (
              <>
                <div className="stat-row"><span>Importe total</span><span className="value">{fmt(totales.total_importe)}</span></div>
                <div className="stat-row"><span>Reliquidaciones</span><span className="value">{totales.reliquidaciones}</span></div>
              </>
            ) : (
              <p className="empty-state" style={{ padding: '1rem 0' }}>Sin datos</p>
            )}
          </div>
        </div>

        <ChartPanel title="Ajustes por mes (ultimo ano)">
          <MonthlyBarChart
            data={chartMonthly}
            bars={[{ key: 'importe', label: 'Importe', color: CHART_COLORS.gold }]}
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
          {registros.length === 0 ? (
            <div className="empty-state">No hay reliquidaciones para el período seleccionado.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Documento</th>
                  <th>Concepto</th>
                  <th>Importe</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((r, i) => (
                  <tr key={`${r.doc_num}-${i}`}>
                    <td>{fmtDate(r.doc_date)}</td>
                    <td>{r.doc_num}</td>
                    <td>{r.descripcion || ''}</td>
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
