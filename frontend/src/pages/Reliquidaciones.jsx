import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearToken } from '../api';
import { CHART_COLORS, dateDaysAgo, groupSumByMonth } from '../chartUtils';
import { fmt, fmtDate } from '../utils';
import AppHeader from '../components/AppHeader';
import ChartPanel from '../components/ChartPanel';
import MonthlyBarChart from '../components/MonthlyBarChart';

export default function Reliquidaciones() {
  const navigate = useNavigate();
  const [resumen, setResumen] = useState(null);
  const [registros, setRegistros] = useState([]);
  const [chartRegistros, setChartRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  async function loadResumen() {
    const data = await api('/api/reliquidaciones/resumen');
    setResumen(data);
  }

  async function loadChartRegistros() {
    const from = dateDaysAgo(365);
    const data = await api(`/api/reliquidaciones?from=${from}`);
    setChartRegistros(data.data);
  }

  async function loadRegistros() {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    const data = await api(`/api/reliquidaciones${qs ? `?${qs}` : ''}`);
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

  const chartMonthly = useMemo(() => {
    const rows = groupSumByMonth(chartRegistros, 'doc_date', 'line_total');
    return rows.map((r) => ({ ...r, importe: r.total }));
  }, [chartRegistros]);

  if (loading && !resumen) {
    return <div className="loading">Cargando…</div>;
  }

  const ultima = resumen?.ultima;
  const totales = resumen?.totales_ultimo_ano;

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
            <h3>Totales último año</h3>
            {totales ? (
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
