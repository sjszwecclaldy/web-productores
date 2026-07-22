import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, clearToken } from '../api';
import {
  groupAvgByMonth,
  groupSumByDate,
  groupSumByMonth,
  litrosByYearMonth,
  rowsOnDate,
  toggleSelectedDate,
} from '../chartUtils';
import { apiFromDate, buildQueryFrom, DATA_FROM_DATE, filterFromMinDate, fmt, fmtDate, isCurrentMonth } from '../utils';
import AppHeader from '../components/AppHeader';
import ChartPanel from '../components/ChartPanel';
import ExportButton from '../components/ExportButton';
import LitrosBarChart from '../components/LitrosBarChart';
import LitrosLineChart from '../components/LitrosLineChart';
import YearCompareLineChart from '../components/YearCompareLineChart';
import LoadingScreen from '../components/LoadingScreen';
import PeriodFilter from '../components/PeriodFilter';
import SelectedDateBanner from '../components/SelectedDateBanner';

const EXPORT_COLS = [
  { header: 'Fecha', value: (r) => fmtDate(r.doc_date) },
  { header: 'Remito', value: (r) => r.doc_num },
  { header: 'Litros', value: (r) => r.quantity },
  { header: 'Temperatura', value: (r) => r.temperatura },
  { header: 'Antibióticos', value: (r) => r.antibiotico },
];

function isAntibioticoSi(v) {
  const s = String(v || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return s === 'si' || s === 'y' || s === 'yes';
}

export default function Remisiones() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlight = searchParams.get('fecha');
  const [registros, setRegistros] = useState([]);
  const [allRegistros, setAllRegistros] = useState([]);
  const [activePreset, setActivePreset] = useState(30);
  const [selectedDate, setSelectedDate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [from, setFrom] = useState(() => {
    const def = apiFromDate(30);
    return highlight && highlight < def ? highlight : def;
  });
  const [to, setTo] = useState('');

  async function loadRegistros(f = from, t = to) {
    const params = new URLSearchParams();
    params.set('from', buildQueryFrom(f));
    if (t) params.set('to', t);
    const data = await api(`/api/remisiones?${params.toString()}`);
    setRegistros(filterFromMinDate(data.data, 'doc_date'));
  }

  // Serie completa (sin filtro): alimenta solo el grafico de comparacion de anos.
  async function loadYearData() {
    const data = await api(`/api/remisiones?from=${DATA_FROM_DATE}`);
    setAllRegistros(filterFromMinDate(data.data, 'doc_date'));
  }

  useEffect(() => {
    async function init() {
      try {
        await Promise.all([loadRegistros(), loadYearData()]);
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
    setSelectedDate(null);
    try {
      await loadRegistros(f, t);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const chartLitros = useMemo(
    () => groupSumByDate(registros, 'doc_date', 'quantity'),
    [registros]
  );

  const yearCompare = useMemo(
    () => litrosByYearMonth(allRegistros, 'doc_date', 'quantity'),
    [allRegistros]
  );

  const litrosPorMes = useMemo(
    () => groupSumByMonth(registros, 'doc_date', 'quantity').slice(-12),
    [registros]
  );

  const tempPorMes = useMemo(
    () => groupAvgByMonth(registros, 'doc_date', 'temperatura').slice(-12),
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

  const antibioticos = useMemo(() => {
    const src = selectedDate ? selectedRemisiones : registros;
    const conAntib = src.filter((r) => isAntibioticoSi(r.antibiotico));
    return {
      remisiones: conAntib.length,
      litros: conAntib.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0),
    };
  }, [selectedDate, selectedRemisiones, registros]);

  const mesCorriente = useMemo(
    () => registros.filter((r) => isCurrentMonth(r.doc_date)),
    [registros]
  );

  const historico = useMemo(() => {
    const base = selectedDate ? selectedRemisiones : registros;
    return base.filter((r) => !isCurrentMonth(r.doc_date));
  }, [selectedDate, selectedRemisiones, registros]);

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

        <PeriodFilter from={from} to={to} onFrom={setFrom} onTo={setTo} activePreset={activePreset} onApply={applyPeriod} />

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

          <div className="stat-card">
            <h3>{selectedDate ? `Antibióticos del ${fmtDate(selectedDate)}` : 'Antibióticos del período'}</h3>
            {totales.entregas > 0 ? (
              <>
                <div className="stat-row"><span>Remisiones con antibióticos</span><span className="value">{antibioticos.remisiones}</span></div>
                <div className="stat-row"><span>Litros afectados</span><span className="value">{fmt(antibioticos.litros)}</span></div>
              </>
            ) : (
              <p className="empty-state" style={{ padding: '1rem 0' }}>Sin datos</p>
            )}
          </div>
        </div>

        <ChartPanel title="Litros entregados por dia">
          <LitrosBarChart
            data={chartLitros}
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
          />
        </ChartPanel>

        <ChartPanel title="Litros por mes">
          <LitrosLineChart data={litrosPorMes} dots />
        </ChartPanel>

        <ChartPanel title="Temperatura por mes">
          <LitrosLineChart
            data={tempPorMes}
            dots
            valueLabel="Temperatura"
            valueUnit=" °C"
            emptyMessage="Sin datos de temperatura para el período"
          />
        </ChartPanel>

        <ChartPanel title="Litros por mes — comparación de años">
          <YearCompareLineChart data={yearCompare.data} years={yearCompare.years} />
        </ChartPanel>

        {mesCorriente.length > 0 && (
          <>
            <h3 className="section-title">Mes corriente — pendiente de validación</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Remito</th>
                    <th className="num">Litros</th>
                    <th className="num">Temperatura</th>
                    <th>Antibióticos</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {mesCorriente.map((r, i) => (
                    <tr
                      key={`mc-${r.doc_num}-${i}`}
                      className={highlight && String(r.doc_date).slice(0, 10) === highlight ? 'row-highlight' : undefined}
                    >
                      <td>{fmtDate(r.doc_date)}</td>
                      <td>{r.doc_num}</td>
                      <td className="num">{fmt(r.quantity)}</td>
                      <td className="num">{fmt(r.temperatura)}</td>
                      <td>{r.antibiotico || '—'}</td>
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
          <ExportButton filename="remisiones.xlsx" columns={EXPORT_COLS} rows={registros} />
        </div>
        <div className="table-wrap">
          {historico.length === 0 ? (
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
                  <th className="num">Temperatura</th>
                  <th>Antibióticos</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((r, i) => (
                  <tr
                    key={`${r.doc_num}-${i}`}
                    className={highlight && String(r.doc_date).slice(0, 10) === highlight ? 'row-highlight' : undefined}
                  >
                    <td>{fmtDate(r.doc_date)}</td>
                    <td>{r.doc_num}</td>
                    <td className="num">{fmt(r.quantity)}</td>
                    <td className="num">{fmt(r.temperatura)}</td>
                    <td>{r.antibiotico || '—'}</td>
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
