import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearToken } from '../api';
import {
  formatMonthLabel,
  groupDualByMonth,
  rowsOnMonth,
  toggleSelectedMonth,
} from '../chartUtils';
import { buildQueryFrom, DATA_FROM_DATE, filterFromMinDate, fmt, fmtDate } from '../utils';
import AppHeader from '../components/AppHeader';
import ChartPanel from '../components/ChartPanel';
import LoadingScreen from '../components/LoadingScreen';
import MonthlyBarChart from '../components/MonthlyBarChart';
import PeriodFilter from '../components/PeriodFilter';
import { SelectedMonthBanner } from '../components/SelectedDateBanner';

export default function Liquidaciones() {
  const navigate = useNavigate();
  const [registros, setRegistros] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [from, setFrom] = useState(DATA_FROM_DATE);
  const [to, setTo] = useState('');

  async function loadRegistros() {
    const params = new URLSearchParams();
    params.set('from', buildQueryFrom(from));
    if (to) params.set('to', to);
    const data = await api(`/api/liquidaciones?${params.toString()}`);
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
    setSelectedMonth(null);
    try {
      await loadRegistros();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const chartMonthly = useMemo(
    () => groupDualByMonth(registros, 'doc_date', 'total', 'cantidad', 'importe', 'litros'),
    [registros]
  );

  const selectedRows = useMemo(
    () => rowsOnMonth(registros, 'doc_date', selectedMonth),
    [registros, selectedMonth]
  );

  const tablaRegistros = useMemo(
    () => (selectedMonth ? selectedRows : registros),
    [registros, selectedRows, selectedMonth]
  );

  function handleMonthSelect(month) {
    setSelectedMonth((current) => toggleSelectedMonth(current, month));
  }

  if (loading) {
    return <LoadingScreen />;
  }

  const ultima = selectedMonth ? selectedRows[0] || null : registros[0] || null;

  return (
    <div className="layout">
      <AppHeader />

      <main className="main">
        <h2 className="page-title">Liquidaciones</h2>
        {error && <div className="error-msg">{error}</div>}

        <PeriodFilter from={from} to={to} onFrom={setFrom} onTo={setTo} onSubmit={handleFilter} />

        <SelectedMonthBanner month={selectedMonth} onClear={() => setSelectedMonth(null)} />

        <div className="cards-grid">
          <div className="stat-card">
            <h3>
              {selectedMonth
                ? `Liquidacion de ${formatMonthLabel(selectedMonth)}`
                : 'Última liquidación'}
            </h3>
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
        </div>

        <ChartPanel title="Importe por mes">
          <MonthlyBarChart
            data={chartMonthly}
            selectedMonth={selectedMonth}
            onMonthSelect={handleMonthSelect}
            bars={[{ key: 'importe', label: 'Importe', color: '#1a5c35' }]}
          />
        </ChartPanel>

        <div className="table-wrap">
          {tablaRegistros.length === 0 ? (
            <div className="empty-state">
              {selectedMonth
                ? 'No hay liquidaciones para el mes seleccionado.'
                : 'No hay liquidaciones para el período seleccionado.'}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Referencia</th>
                  <th className="num">Litros</th>
                  <th className="num">Total</th>
                  <th className="num">IMEBA</th>
                  <th className="num">INIA</th>
                  <th className="num">Aftosa (USD)</th>
                  <th className="num">Enferm. (USD)</th>
                </tr>
              </thead>
              <tbody>
                {tablaRegistros.map((r, i) => (
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
