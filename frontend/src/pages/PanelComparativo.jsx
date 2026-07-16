import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearToken } from '../api';
import { CHART_COLORS } from '../chartUtils';
import { fmt, fmtDate } from '../utils';
import AppHeader from '../components/AppHeader';
import ChartPanel from '../components/ChartPanel';
import KpiCard from '../components/KpiCard';
import LoadingScreen from '../components/LoadingScreen';
import RankingBarChart from '../components/RankingBarChart';

const PERIODOS = [
  { dias: 30, label: '30 días' },
  { dias: 90, label: '90 días' },
  { dias: 365, label: '365 días' },
];

const COLUMNAS = [
  { key: 'card_name', label: 'Productor', num: false },
  { key: 'litros', label: 'Litros', num: true },
  { key: 'entregas', label: 'Entregas', num: true },
  { key: 'ultima_entrega', label: 'Última entrega', num: false, fecha: true },
  { key: 'importe_liquidado', label: 'Importe liq.', num: true },
  { key: 'grasa', label: 'Grasa', num: true },
  { key: 'proteina', label: 'Proteína', num: true },
  { key: 'lactosa', label: 'Lactosa', num: true },
  { key: 'solidos', label: 'Sólidos', num: true },
];

function desdeDias(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

export default function PanelComparativo() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dias, setDias] = useState(90);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [rango, setRango] = useState(null);
  const [sortKey, setSortKey] = useState('litros');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams();
        if (rango) {
          params.set('desde', rango.desde);
          if (rango.hasta) params.set('hasta', rango.hasta);
        } else {
          params.set('desde', desdeDias(dias));
        }
        const res = await api(`/api/admin/dashboard?${params.toString()}`);
        setData(res);
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
    load();
  }, [dias, rango, navigate]);

  function aplicarRango(e) {
    e.preventDefault();
    if (!desde) return;
    setRango({ desde, hasta: hasta || null });
  }

  function usarPeriodo(d) {
    setRango(null);
    setDias(d);
  }

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const productores = data?.productores || [];

  const tabla = useMemo(() => {
    const rows = [...productores];
    rows.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      const na = Number(va);
      const nb = Number(vb);
      const bothNum = Number.isFinite(na) && Number.isFinite(nb);
      let cmp;
      if (bothNum) {
        cmp = na - nb;
      } else {
        cmp = String(va ?? '').localeCompare(String(vb ?? ''));
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [productores, sortKey, sortDir]);

  const top10Litros = useMemo(
    () => [...productores].sort((a, b) => Number(b.litros) - Number(a.litros)).slice(0, 10),
    [productores]
  );

  const top10Grasa = useMemo(
    () =>
      [...productores]
        .filter((p) => Number(p.muestras) > 0 && p.grasa != null)
        .sort((a, b) => Number(b.grasa) - Number(a.grasa))
        .slice(0, 10),
    [productores]
  );

  if (loading && !data) {
    return <LoadingScreen />;
  }

  const kpis = data?.kpis;
  const recientes = data?.recientes || [];

  return (
    <div className="layout">
      <AppHeader />

      <main className="main">
        <h2 className="page-title">Panel comparativo</h2>
        {error && <div className="error-msg">{error}</div>}

        <div className="comparativa-filtros">
          <div className="period-toggle">
            {PERIODOS.map((p) => (
              <button
                key={p.dias}
                type="button"
                className={`period-toggle__btn${!rango && dias === p.dias ? ' active' : ''}`}
                onClick={() => usarPeriodo(p.dias)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <form className="comparativa-rango" onSubmit={aplicarRango}>
            <div className="form-group">
              <label htmlFor="desde">Desde</label>
              <input id="desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="hasta">Hasta</label>
              <input id="hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary">
              Aplicar rango
            </button>
          </form>
        </div>

        {kpis && (
          <div className="cards-grid">
            <KpiCard label="Productores con datos" value={fmt(kpis.productores_con_datos)} />
            <KpiCard label="Litros totales" value={fmt(kpis.total_litros)} />
            <KpiCard label="Entregas totales" value={fmt(kpis.total_entregas)} />
            <KpiCard label="Importe liquidado" value={fmt(kpis.total_importe_liquidado)} />
            <KpiCard label="Prom. grasa" value={fmt(kpis.promedio_grasa)} />
            <KpiCard label="Prom. proteína" value={fmt(kpis.promedio_proteina)} />
          </div>
        )}

        <ChartPanel title="Top 10 productores por litros remitidos">
          <RankingBarChart data={top10Litros} dataKey="litros" unit="L" color={CHART_COLORS.primary} />
        </ChartPanel>

        <ChartPanel title="Top 10 productores por materia grasa (promedio)">
          <RankingBarChart data={top10Grasa} dataKey="grasa" unit="%" color={CHART_COLORS.gold} />
        </ChartPanel>

        <h3 className="section-title">Comparativa por productor</h3>
        <div className="table-wrap">
          {tabla.length === 0 ? (
            <div className="empty-state">Sin productores para mostrar.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  {COLUMNAS.map((c) => (
                    <th
                      key={c.key}
                      className={`sortable${c.num ? ' num' : ''}${sortKey === c.key ? ' sorted' : ''}`}
                      onClick={() => toggleSort(c.key)}
                    >
                      {c.label}
                      {sortKey === c.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tabla.map((p) => (
                  <tr key={p.card_code}>
                    <td>{p.card_name} <span className="muted-code">({p.card_code})</span></td>
                    <td className="num">{fmt(p.litros)}</td>
                    <td className="num">{fmt(p.entregas)}</td>
                    <td>{p.ultima_entrega ? fmtDate(p.ultima_entrega) : '—'}</td>
                    <td className="num">{fmt(p.importe_liquidado)}</td>
                    <td className="num">{p.grasa != null ? fmt(p.grasa) : '—'}</td>
                    <td className="num">{p.proteina != null ? fmt(p.proteina) : '—'}</td>
                    <td className="num">{p.lactosa != null ? fmt(p.lactosa) : '—'}</td>
                    <td className="num">{p.solidos != null ? fmt(p.solidos) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <h3 className="section-title">Entregas recientes del padrón</h3>
        <div className="table-wrap">
          {recientes.length === 0 ? (
            <div className="empty-state">Sin entregas recientes.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Productor</th>
                  <th>Remito</th>
                  <th className="num">Litros</th>
                </tr>
              </thead>
              <tbody>
                {recientes.map((r, i) => (
                  <tr key={`${r.card_code}-${r.doc_num}-${i}`}>
                    <td>{fmtDate(r.doc_date)}</td>
                    <td>{r.card_name} <span className="muted-code">({r.card_code})</span></td>
                    <td>{r.doc_num}</td>
                    <td className="num">{fmt(r.litros)}</td>
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
