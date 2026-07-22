import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearToken } from '../api';
import {
  CHART_COLORS,
  formatMonthLabel,
  groupSumByMonth,
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
import { SelectedMonthBanner } from '../components/SelectedDateBanner';
import VerMasButton from '../components/VerMasButton';
import { useColapsable } from '../hooks/useColapsable';

const EXPORT_COLS = [
  { header: 'Fecha', value: (r) => fmtDate(r.doc_date) },
  { header: 'Documento', value: (r) => r.doc_num },
  { header: 'Concepto', value: (r) => r.descripcion || '' },
  { header: 'Importe Bruto', value: (r) => r.line_total },
];

export default function Reliquidaciones() {
  const navigate = useNavigate();
  const [registros, setRegistros] = useState([]);
  const [activePreset, setActivePreset] = useState(365);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [from, setFrom] = useState(() => apiFromDate(365));
  const [to, setTo] = useState('');

  async function loadRegistros(f = from, t = to) {
    const params = new URLSearchParams();
    params.set('from', buildQueryFrom(f));
    if (t) params.set('to', t);
    const data = await api(`/api/reliquidaciones?${params.toString()}`);
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

  const chartMonthly = useMemo(() => {
    const rows = groupSumByMonth(registros, 'doc_date', 'line_total');
    return rows.map((r) => ({ ...r, importe: r.total }));
  }, [registros]);

  const selectedRows = useMemo(
    () => rowsOnMonth(registros, 'doc_date', selectedMonth),
    [registros, selectedMonth]
  );

  const totales = useMemo(() => {
    const src = selectedMonth ? selectedRows : registros;
    return {
      total_importe: src.reduce((sum, row) => sum + (Number(row.line_total) || 0), 0),
      reliquidaciones: src.length,
    };
  }, [selectedMonth, selectedRows, registros]);

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

  return (
    <div className="layout">
      <AppHeader />

      <main className="main">
        <h2 className="page-title">Reliquidaciones</h2>
        {error && <div className="error-msg">{error}</div>}

        <PeriodFilter from={from} to={to} onFrom={setFrom} onTo={setTo} activePreset={activePreset} onApply={applyPeriod} />

        <SelectedMonthBanner month={selectedMonth} onClear={() => setSelectedMonth(null)} />

        <div className="cards-grid">
          <div className="stat-card">
            <h3>
              {selectedMonth
                ? `Reliquidacion de ${formatMonthLabel(selectedMonth)}`
                : 'Última reliquidación'}
            </h3>
            {ultima ? (
              <>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: 'var(--muted)' }}>
                  Fecha: {fmtDate(ultima.doc_date)}
                  {ultima.doc_num != null && ` · Doc. ${ultima.doc_num}`}
                </p>
                {ultima.descripcion && (
                  <div className="stat-row"><span>Concepto</span><span className="value">{ultima.descripcion}</span></div>
                )}
                <div className="stat-row"><span>Importe Bruto</span><span className="value">{fmt(ultima.line_total)}</span></div>
              </>
            ) : (
              <p className="empty-state" style={{ padding: '1rem 0' }}>Sin datos</p>
            )}
          </div>

          <div className="stat-card">
            <h3>{selectedMonth ? `Totales ${formatMonthLabel(selectedMonth)}` : 'Totales del período'}</h3>
            {totales.reliquidaciones > 0 ? (
              <>
                <div className="stat-row"><span>Importe total bruto</span><span className="value">{fmt(totales.total_importe)}</span></div>
                <div className="stat-row"><span>Reliquidaciones</span><span className="value">{totales.reliquidaciones}</span></div>
              </>
            ) : (
              <p className="empty-state" style={{ padding: '1rem 0' }}>Sin datos</p>
            )}
          </div>
        </div>

        <ChartPanel title="Ajustes por mes">
          <MonthlyBarChart
            data={chartMonthly}
            selectedMonth={selectedMonth}
            onMonthSelect={handleMonthSelect}
            bars={[{ key: 'importe', label: 'Importe Bruto', color: CHART_COLORS.gold }]}
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
                    <th>Documento</th>
                    <th>Concepto</th>
                    <th className="num">Importe Bruto</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {mesCorriente.map((r, i) => (
                    <tr key={`mc-${r.doc_num}-${i}`}>
                      <td>{fmtDate(r.doc_date)}</td>
                      <td>{r.doc_num}</td>
                      <td>{r.descripcion || ''}</td>
                      <td className="num">{fmt(r.line_total)}</td>
                      <td><span className="badge badge--pendiente">Pendiente de validación</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="table-toolbar">
          <h3 className="section-title" style={{ margin: 0 }}>Histórico</h3>
          <ExportButton filename="reliquidaciones.xlsx" columns={EXPORT_COLS} rows={registros} />
        </div>
        <div className="table-wrap">
          {historico.length === 0 ? (
            <div className="empty-state">
              {selectedMonth
                ? 'No hay reliquidaciones para el mes seleccionado.'
                : 'No hay reliquidaciones para el período seleccionado.'}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Documento</th>
                  <th>Concepto</th>
                  <th className="num">Importe Bruto</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((r, i) => (
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
        <VerMasButton abierto={abierto} restantes={restantes} onToggle={toggle} />
      </main>
    </div>
  );
}
