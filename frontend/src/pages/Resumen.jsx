import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearToken } from '../api';
import {
  avgCalidadByDate,
  CHART_COLORS,
  formatMonthLabel,
  geometricMean,
  groupAvgByMonth,
  groupCountByMonth,
  groupSanitariaByDay,
  groupSumByDate,
  groupSumByMonth,
} from '../chartUtils';
import { buildQueryFrom, DATA_FROM_DATE, filterFromMinDate, fmt, fmtDate } from '../utils';
import AppHeader from '../components/AppHeader';
import CalidadLineChart from '../components/CalidadLineChart';
import ChartPanel from '../components/ChartPanel';
import ExportButton from '../components/ExportButton';
import LitrosLineChart from '../components/LitrosLineChart';
import LoadingScreen from '../components/LoadingScreen';
import PeriodFilter from '../components/PeriodFilter';
import { loadPeriodo, savePeriodo } from '../periodoStore';

const avg = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null);
const nums = (rows, key) => rows.filter((r) => r[key] != null).map((r) => Number(r[key]));

const fmtL = (v) => (v != null ? `${fmt(v)} L` : '—');
const fmtP = (v) => (v != null ? `${fmt(v)} %` : '—');
const fmtN = (v) => (v != null ? fmt(v) : '—');

const EXPORT_MENSUAL_COLS = [
  { header: 'Mes', value: (r) => r.label },
  { header: 'Litros', value: (r) => r.litros },
  { header: 'Entregas', value: (r) => r.entregas },
  { header: 'Grasa %', value: (r) => r.grasa },
  { header: 'Proteína %', value: (r) => r.proteina },
  { header: 'Sólidos totales %', value: (r) => r.solidos },
  { header: 'Células somáticas (miles)', value: (r) => r.celulas },
  { header: 'Recuento bacteriano (miles)', value: (r) => r.bacterias },
];

function toMonthMap(series) {
  const map = new Map();
  for (const row of series) map.set(row.month, row.total);
  return map;
}

// Un indicador con su valor de ultima entrega y su promedio del periodo.
function MetricCard({ icon, name, ultima, promedio }) {
  return (
    <div className="metric-card">
      <div className="metric-card__head">
        <span className="metric-card__icon">{icon}</span>
        <span className="metric-card__name">{name}</span>
      </div>
      <div className="metric-card__row">
        <span>Última entrega</span>
        <strong>{ultima}</strong>
      </div>
      <div className="metric-card__row">
        <span>Promedio período</span>
        <strong>{promedio}</strong>
      </div>
    </div>
  );
}

export default function Resumen() {
  const navigate = useNavigate();
  const [remisiones, setRemisiones] = useState([]);
  const [calidad, setCalidad] = useState([]);
  const [calidadSan, setCalidadSan] = useState([]);
  // Historial completo para la tabla mensual (no depende del filtro de período).
  const [allRemisiones, setAllRemisiones] = useState([]);
  const [allCalidad, setAllCalidad] = useState([]);
  const [allCalidadSan, setAllCalidadSan] = useState([]);
  const [vencRefre, setVencRefre] = useState(null);
  const periodoInit = loadPeriodo();
  const [activePreset, setActivePreset] = useState(periodoInit.preset);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [from, setFrom] = useState(periodoInit.from);
  const [to, setTo] = useState(periodoInit.to);

  async function loadVencimiento() {
    const data = await api('/api/vencimientos');
    setVencRefre(data.data?.venc_refre || null);
  }

  async function loadHistorico() {
    const qs = `from=${DATA_FROM_DATE}`;
    const [remData, calData, sanData] = await Promise.all([
      api(`/api/remisiones?${qs}`),
      api(`/api/calidad-composicion?${qs}`),
      api(`/api/calidad-sanitaria?${qs}`),
    ]);
    setAllRemisiones(filterFromMinDate(remData.data, 'doc_date'));
    setAllCalidad(filterFromMinDate(calData.data, 'collection_date'));
    setAllCalidadSan(filterFromMinDate(sanData.data, 'lab_date'));
  }

  async function loadAll(f = from, t = to) {
    const params = new URLSearchParams();
    params.set('from', buildQueryFrom(f));
    if (t) params.set('to', t);
    const qs = params.toString();
    const [remData, calData, sanData] = await Promise.all([
      api(`/api/remisiones?${qs}`),
      api(`/api/calidad-composicion?${qs}`),
      api(`/api/calidad-sanitaria?${qs}`),
    ]);
    setRemisiones(filterFromMinDate(remData.data, 'doc_date'));
    setCalidad(filterFromMinDate(calData.data, 'collection_date'));
    setCalidadSan(filterFromMinDate(sanData.data, 'lab_date'));
  }

  useEffect(() => {
    async function init() {
      try {
        await Promise.all([loadAll(), loadHistorico(), loadVencimiento()]);
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
    try {
      await loadAll(f, t);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const litrosByDay = useMemo(() => groupSumByDate(remisiones, 'doc_date', 'quantity'), [remisiones]);
  const calidadChart = useMemo(() => avgCalidadByDate(calidad), [calidad]);

  const sanitariaPorDia = useMemo(() => groupSanitariaByDay(calidadSan), [calidadSan]);

  const sanitariaSerie = useMemo(
    () =>
      sanitariaPorDia.map((r) => ({
        date: r.date,
        label: r.label,
        celulas: r.celulas,
        bacterias: r.bacterias,
      })),
    [sanitariaPorDia]
  );

  const ultimaDiaSan = useMemo(() => {
    if (!sanitariaPorDia.length) return null;
    return [...sanitariaPorDia].sort((a, b) => b.date.localeCompare(a.date))[0];
  }, [sanitariaPorDia]);

  const ultima = {
    litros: remisiones[0]?.quantity,
    grasa: calidad[0]?.fat,
    proteina: calidad[0]?.protein,
    celulas: ultimaDiaSan?.celulas,
    bacterias: ultimaDiaSan?.bacterias,
  };

  const promedio = useMemo(
    () => ({
      litros: litrosByDay.length
        ? litrosByDay.reduce((s, d) => s + (Number(d.total) || 0), 0) / litrosByDay.length
        : null,
      grasa: avg(nums(calidad, 'fat')),
      proteina: avg(nums(calidad, 'protein')),
      // Promedio del período: geo sobre todas las muestras (no sobre diarios).
      celulas: geometricMean(nums(calidadSan, 'celulas')),
      bacterias: geometricMean(nums(calidadSan, 'bacterias')),
    }),
    [litrosByDay, calidad, calidadSan]
  );

  const resumenMensual = useMemo(() => {
    const litros = toMonthMap(groupSumByMonth(allRemisiones, 'doc_date', 'quantity'));
    const entregas = toMonthMap(groupCountByMonth(allRemisiones, 'doc_date'));
    const grasa = toMonthMap(groupAvgByMonth(allCalidad, 'collection_date', 'fat'));
    const proteina = toMonthMap(groupAvgByMonth(allCalidad, 'collection_date', 'protein'));
    const solidos = toMonthMap(groupAvgByMonth(allCalidad, 'collection_date', 'ts'));
    const celulas = toMonthMap(
      groupAvgByMonth(allCalidadSan, 'lab_date', 'celulas', { geometric: true })
    );
    const bacterias = toMonthMap(
      groupAvgByMonth(allCalidadSan, 'lab_date', 'bacterias', { geometric: true })
    );

    const months = new Set([
      ...litros.keys(),
      ...entregas.keys(),
      ...grasa.keys(),
      ...proteina.keys(),
      ...solidos.keys(),
      ...celulas.keys(),
      ...bacterias.keys(),
    ]);

    return [...months]
      .sort((a, b) => b.localeCompare(a))
      .map((month) => ({
        month,
        label: formatMonthLabel(month),
        litros: litros.get(month) ?? null,
        entregas: entregas.get(month) ?? null,
        grasa: grasa.get(month) ?? null,
        proteina: proteina.get(month) ?? null,
        solidos: solidos.get(month) ?? null,
        celulas: celulas.get(month) ?? null,
        bacterias: bacterias.get(month) ?? null,
      }));
  }, [allRemisiones, allCalidad, allCalidadSan]);

  const indicadores = [
    { icon: '🥛', name: 'Litros', u: fmtL(ultima.litros), p: fmtL(promedio.litros) },
    { icon: '🧪', name: 'Grasa', u: fmtP(ultima.grasa), p: fmtP(promedio.grasa) },
    { icon: '🧬', name: 'Proteína', u: fmtP(ultima.proteina), p: fmtP(promedio.proteina) },
    { icon: '🔬', name: 'Células somáticas (miles)', u: fmtN(ultima.celulas), p: fmtN(promedio.celulas) },
    { icon: '🦠', name: 'Recuento bacteriano (miles)', u: fmtN(ultima.bacterias), p: fmtN(promedio.bacterias) },
  ];

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="layout">
      <AppHeader />

      <main className="main">
        <h2 className="page-title">Resumen</h2>
        {error && <div className="error-msg">{error}</div>}

        <PeriodFilter
          from={from}
          to={to}
          onFrom={setFrom}
          onTo={setTo}
          activePreset={activePreset}
          onApply={applyPeriod}
          abovePresets={
            <div className="venc-card">
              <span className="venc-card__label">Vencimiento refrendación (Sanidad del tambo)</span>
              <strong className="venc-card__value">{vencRefre ? fmtDate(vencRefre) : '—'}</strong>
            </div>
          }
        />

        <h3 className="section-title">Indicadores</h3>
        <div className="metric-grid">
          {indicadores.map((m) => (
            <MetricCard key={m.name} icon={m.icon} name={m.name} ultima={m.u} promedio={m.p} />
          ))}
        </div>

        <div className="charts-grid">
          <ChartPanel title="Litros entregados por día">
            <LitrosLineChart data={litrosByDay} />
          </ChartPanel>
          <ChartPanel title="Evolución composición (grasa y proteína)">
            <CalidadLineChart data={calidadChart} />
          </ChartPanel>
        </div>

        <div className="charts-grid">
          <ChartPanel title="Evolución células somáticas">
            <CalidadLineChart
              data={sanitariaSerie}
              series={[{ key: 'celulas', label: 'Cél. somáticas', color: CHART_COLORS.primary }]}
            />
          </ChartPanel>
          <ChartPanel title="Evolución recuento bacteriano">
            <CalidadLineChart
              data={sanitariaSerie}
              series={[{ key: 'bacterias', label: 'Recuento bact.', color: CHART_COLORS.accent }]}
            />
          </ChartPanel>
        </div>

        <div className="table-toolbar">
          <h3 className="section-title" style={{ margin: 0 }}>Resumen mensual</h3>
          <ExportButton filename="resumen-mensual.xlsx" columns={EXPORT_MENSUAL_COLS} rows={resumenMensual} />
        </div>
        <div className="table-wrap">
          {resumenMensual.length === 0 ? (
            <div className="empty-state">No hay datos históricos.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Mes</th>
                  <th className="num">Litros</th>
                  <th className="num">Entregas</th>
                  <th className="num">Grasa %</th>
                  <th className="num">Proteína %</th>
                  <th className="num">Sólidos %</th>
                  <th className="num">Células</th>
                  <th className="num">Bacterias</th>
                </tr>
              </thead>
              <tbody>
                {resumenMensual.map((r) => (
                  <tr key={r.month}>
                    <td>{r.label}</td>
                    <td className="num">{fmtN(r.litros)}</td>
                    <td className="num">{fmtN(r.entregas)}</td>
                    <td className="num">{fmtN(r.grasa)}</td>
                    <td className="num">{fmtN(r.proteina)}</td>
                    <td className="num">{fmtN(r.solidos)}</td>
                    <td className="num">{fmtN(r.celulas)}</td>
                    <td className="num">{fmtN(r.bacterias)}</td>
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
