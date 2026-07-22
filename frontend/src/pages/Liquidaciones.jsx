import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearToken } from '../api';
import {
  formatMonthLabel,
  groupDualByMonth,
  rowsOnMonth,
  toggleSelectedMonth,
} from '../chartUtils';
import { apiFromDate, buildQueryFrom, DATA_FROM_DATE, filterFromMinDate, fmt, fmtDate, isCurrentMonth } from '../utils';
import AppHeader from '../components/AppHeader';
import ChartPanel from '../components/ChartPanel';
import ExportButton from '../components/ExportButton';
import LoadingScreen from '../components/LoadingScreen';
import MonthlyBarChart from '../components/MonthlyBarChart';
import PeriodFilter from '../components/PeriodFilter';
import { loadPeriodo, savePeriodo } from '../periodoStore';
import { SelectedMonthBanner } from '../components/SelectedDateBanner';
import VerMasButton from '../components/VerMasButton';
import { useColapsable } from '../hooks/useColapsable';

const EXPORT_COLS = [
  { header: 'Fecha', value: (r) => fmtDate(r.doc_date) },
  { header: 'Referencia', value: (r) => r.num_at_card },
  { header: 'Litros', value: (r) => r.cantidad },
  { header: 'Importe Bruto', value: (r) => r.total },
  { header: 'IMEBA', value: (r) => r.imeba },
  { header: 'INIA', value: (r) => r.inia },
  { header: 'Aftosa', value: (r) => r.aftosa_usd },
  { header: 'Enfermedades', value: (r) => r.enferm_usd },
  { header: 'Importe Neto', value: (r) => calcImporteNeto(r) },
];

function calcImporteNeto(r) {
  const n = (v) => Number(v) || 0;
  return n(r.total) - n(r.imeba) - n(r.inia) - n(r.aftosa_usd) - n(r.enferm_usd);
}

function LiqRow({ r }) {
  return (
    <>
      <td>{fmtDate(r.doc_date)}</td>
      <td>{r.num_at_card}</td>
      <td className="num">{fmt(r.cantidad)}</td>
      <td className="num">{fmt(r.total)}</td>
      <td className="num">{fmt(r.imeba)}</td>
      <td className="num">{fmt(r.inia)}</td>
      <td className="num">{fmt(r.aftosa_usd)}</td>
      <td className="num">{fmt(r.enferm_usd)}</td>
    </>
  );
}

export default function Liquidaciones() {
  const navigate = useNavigate();
  const [registros, setRegistros] = useState([]);
  const periodoInit = loadPeriodo();
  const [activePreset, setActivePreset] = useState(periodoInit.preset);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [from, setFrom] = useState(periodoInit.from);
  const [to, setTo] = useState(periodoInit.to);

  async function loadRegistros(f = from, t = to) {
    const params = new URLSearchParams();
    params.set('from', buildQueryFrom(f));
    if (t) params.set('to', t);
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

  async function applyPeriod(f, t, preset) {
    setFrom(f);
    setTo(t);
    setActivePreset(preset);
    savePeriodo(preset, f, t);
    setLoading(true);
    setError('');
    setSelectedMonth(null);
    try {
      await loadRegistros(f, t);
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

  const mesCorriente = useMemo(
    () => registros.filter((r) => isCurrentMonth(r.doc_date)),
    [registros]
  );

  const historico = useMemo(() => {
    const base = selectedMonth ? selectedRows : registros;
    return base.filter((r) => !isCurrentMonth(r.doc_date));
  }, [selectedMonth, selectedRows, registros]);

  const { visibles, restantes, abierto, toggle } = useColapsable(historico, 10);

  function handleMonthSelect(month) {
    setSelectedMonth((current) => toggleSelectedMonth(current, month));
  }

  if (loading) {
    return <LoadingScreen />;
  }

  const ultima = selectedMonth ? selectedRows[0] || null : registros[0] || null;
  const importeNeto = ultima ? calcImporteNeto(ultima) : null;

  return (
    <div className="layout">
      <AppHeader />

      <main className="main">
        <h2 className="page-title">Liquidaciones</h2>
        {error && <div className="error-msg">{error}</div>}

        <PeriodFilter from={from} to={to} onFrom={setFrom} onTo={setTo} activePreset={activePreset} onApply={applyPeriod} />

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
                <div className="stat-row"><span>Importe Bruto</span><span className="value">{fmt(ultima.total)}</span></div>
                <div className="stat-row"><span>IMEBA</span><span className="value">{fmt(ultima.imeba)}</span></div>
                <div className="stat-row"><span>INIA</span><span className="value">{fmt(ultima.inia)}</span></div>
                <div className="stat-row"><span>Aftosa</span><span className="value">{fmt(ultima.aftosa_usd)}</span></div>
                <div className="stat-row"><span>Enfermedades</span><span className="value">{fmt(ultima.enferm_usd)}</span></div>
                <div className="stat-row"><span>Importe Neto</span><span className="value">{fmt(importeNeto)}</span></div>
              </>
            ) : (
              <p className="empty-state" style={{ padding: '1rem 0' }}>Sin datos</p>
            )}
          </div>
        </div>

        <ChartPanel title="Importe Bruto por mes">
          <MonthlyBarChart
            data={chartMonthly}
            selectedMonth={selectedMonth}
            onMonthSelect={handleMonthSelect}
            bars={[{ key: 'importe', label: 'Importe Bruto', color: '#1a5c35' }]}
          />
        </ChartPanel>

        {mesCorriente.length > 0 && (
          <>
            <h3 className="section-title">Mes corriente — pendiente de validación</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Referencia</th>
                    <th className="num">Litros</th>
                    <th className="num">Importe Bruto</th>
                    <th className="num">IMEBA</th>
                    <th className="num">INIA</th>
                    <th className="num">Aftosa</th>
                    <th className="num">Enfermedades</th>
                    <th>Estado</th>
                    <th className="num">Importe Neto</th>
                  </tr>
                </thead>
                <tbody>
                  {mesCorriente.map((r, i) => (
                    <tr key={`mc-${r.num_at_card}-${r.doc_date}-${i}`}>
                      <LiqRow r={r} />
                      <td><span className="badge badge--pendiente">Pendiente de validación</span></td>
                      <td className="num">{fmt(calcImporteNeto(r))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="table-toolbar">
          <h3 className="section-title" style={{ margin: 0 }}>Histórico</h3>
          <ExportButton filename="liquidaciones.xlsx" columns={EXPORT_COLS} rows={registros} />
        </div>
        <div className="table-wrap">
          {historico.length === 0 ? (
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
                  <th className="num">Importe Bruto</th>
                  <th className="num">IMEBA</th>
                  <th className="num">INIA</th>
                  <th className="num">Aftosa</th>
                  <th className="num">Enfermedades</th>
                  <th className="num">Importe Neto</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((r, i) => (
                  <tr key={`${r.num_at_card}-${r.doc_date}-${i}`}>
                    <LiqRow r={r} />
                    <td className="num">{fmt(calcImporteNeto(r))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <VerMasButton abierto={abierto} restantes={restantes} onToggle={toggle} />
      </main>
    </div>
  );
}
