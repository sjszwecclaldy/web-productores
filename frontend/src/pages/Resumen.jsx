import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearToken } from '../api';
import { avgCalidadByDate, formatChartDate, groupSumByDate } from '../chartUtils';
import { apiFromDate, buildQueryFrom, DATA_FROM_DATE, filterFromMinDate, fmt } from '../utils';
import AppHeader from '../components/AppHeader';
import CalidadLineChart from '../components/CalidadLineChart';
import ChartPanel from '../components/ChartPanel';
import LitrosLineChart from '../components/LitrosLineChart';
import LoadingScreen from '../components/LoadingScreen';
import PeriodFilter from '../components/PeriodFilter';

const avg = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null);
const nums = (rows, key) => rows.filter((r) => r[key] != null).map((r) => Number(r[key]));

const fmtL = (v) => (v != null ? `${fmt(v)} L` : '—');
const fmtP = (v) => (v != null ? `${fmt(v)} %` : '—');
const fmtN = (v) => (v != null ? fmt(v) : '—');

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
  const [activePreset, setActivePreset] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [from, setFrom] = useState(() => apiFromDate(30));
  const [to, setTo] = useState('');

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
        await loadAll();
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

  const sanitariaSerie = useMemo(
    () =>
      [...calidadSan]
        .map((r) => ({
          date: r.lab_date,
          label: formatChartDate(r.lab_date),
          celulas: r.celulas != null ? Number(r.celulas) : null,
          bacterias: r.bacterias != null ? Number(r.bacterias) : null,
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [calidadSan]
  );

  const ultima = {
    litros: remisiones[0]?.quantity,
    grasa: calidad[0]?.fat,
    proteina: calidad[0]?.protein,
    celulas: calidadSan[0]?.celulas,
    bacterias: calidadSan[0]?.bacterias,
  };

  const promedio = useMemo(
    () => ({
      litros: litrosByDay.length
        ? litrosByDay.reduce((s, d) => s + (Number(d.total) || 0), 0) / litrosByDay.length
        : null,
      grasa: avg(nums(calidad, 'fat')),
      proteina: avg(nums(calidad, 'protein')),
      celulas: avg(nums(calidadSan, 'celulas')),
      bacterias: avg(nums(calidadSan, 'bacterias')),
    }),
    [litrosByDay, calidad, calidadSan]
  );

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

        <PeriodFilter from={from} to={to} onFrom={setFrom} onTo={setTo} activePreset={activePreset} onApply={applyPeriod} />

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
              series={[{ key: 'celulas', label: 'Cél. somáticas', color: '#1a5c35' }]}
            />
          </ChartPanel>
          <ChartPanel title="Evolución recuento bacteriano">
            <CalidadLineChart
              data={sanitariaSerie}
              series={[{ key: 'bacterias', label: 'Recuento bact.', color: '#2d8c52' }]}
            />
          </ChartPanel>
        </div>

      </main>
    </div>
  );
}
