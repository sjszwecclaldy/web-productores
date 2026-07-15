import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearToken } from '../api';
import { fmt, fmtDate } from '../utils';
import AppHeader from '../components/AppHeader';

export default function Liquidaciones() {
  const navigate = useNavigate();
  const [resumen, setResumen] = useState(null);
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  async function loadResumen() {
    const data = await api('/api/liquidaciones/resumen');
    setResumen(data);
  }

  async function loadRegistros() {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    const data = await api(`/api/liquidaciones${qs ? `?${qs}` : ''}`);
    setRegistros(data.data);
  }

  useEffect(() => {
    async function init() {
      try {
        await Promise.all([loadResumen(), loadRegistros()]);
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

  if (loading && !resumen) {
    return <div className="loading">Cargando…</div>;
  }

  const ultima = resumen?.ultima;
  const totales = resumen?.totales_ultimo_ano;

  return (
    <div className="layout">
      <AppHeader />

      <main className="main">
        <h2 className="page-title">Liquidaciones</h2>
        {error && <div className="error-msg">{error}</div>}

        <div className="cards-grid">
          <div className="stat-card">
            <h3>Última liquidación</h3>
            {ultima ? (
              <>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: 'var(--muted)' }}>
                  Fecha: {fmtDate(ultima.doc_date)}
                  {ultima.num_at_card && ` · Ref. ${ultima.num_at_card}`}
                </p>
                <div className="stat-row"><span>Litros</span><span className="value">{fmt(ultima.cantidad)}</span></div>
                <div className="stat-row"><span>Importe total</span><span className="value">{fmt(ultima.total)}</span></div>
                <div className="stat-row"><span>IMEBA</span><span className="value">{fmt(ultima.imeba)}</span></div>
                <div className="stat-row"><span>INIA</span><span className="value">{fmt(ultima.inia)}</span></div>
                <div className="stat-row"><span>Aftosa (USD)</span><span className="value">{fmt(ultima.aftosa_usd)}</span></div>
                <div className="stat-row"><span>Enfermedades (USD)</span><span className="value">{fmt(ultima.enferm_usd)}</span></div>
              </>
            ) : (
              <p className="empty-state" style={{ padding: '1rem 0' }}>Sin datos</p>
            )}
          </div>

          <div className="stat-card">
            <h3>Totales último año</h3>
            {totales ? (
              <>
                <div className="stat-row"><span>Litros liquidados</span><span className="value">{fmt(totales.total_litros)}</span></div>
                <div className="stat-row"><span>Importe total</span><span className="value">{fmt(totales.total_importe)}</span></div>
                <div className="stat-row"><span>Liquidaciones</span><span className="value">{totales.liquidaciones}</span></div>
              </>
            ) : (
              <p className="empty-state" style={{ padding: '1rem 0' }}>Sin datos</p>
            )}
          </div>
        </div>

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
            <div className="empty-state">No hay liquidaciones para el período seleccionado.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Referencia</th>
                  <th>Litros</th>
                  <th>Total</th>
                  <th>IMEBA</th>
                  <th>INIA</th>
                  <th>Aftosa (USD)</th>
                  <th>Enferm. (USD)</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((r, i) => (
                  <tr key={`${r.num_at_card}-${r.doc_date}-${i}`}>
                    <td>{fmtDate(r.doc_date)}</td>
                    <td>{r.num_at_card}</td>
                    <td className="num">{fmt(r.cantidad)}</td>
                    <td className="num">{fmt(r.total)}</td>
                    <td className="num">{fmt(r.imeba)}</td>
                    <td className="num">{fmt(r.inia)}</td>
                    <td className="num">{fmt(r.aftosa_usd)}</td>
                    <td className="num">{fmt(r.enferm_usd)}</td>
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
