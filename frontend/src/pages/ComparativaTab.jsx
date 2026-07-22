import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearToken } from '../api';
import { fmt, fmtDate } from '../utils';
import ChartPanel from '../components/ChartPanel';
import KpiCard from '../components/KpiCard';
import MultiProductorChart from '../components/MultiProductorChart';
import VerMasButton from '../components/VerMasButton';
import { useColapsable } from '../hooks/useColapsable';

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
  { key: 'grasa', label: 'Grasa', num: true },
  { key: 'proteina', label: 'Proteína', num: true },
  { key: 'lactosa', label: 'Lactosa', num: true },
  { key: 'solidos', label: 'Sólidos', num: true },
  { key: 'celulas', label: 'Cél. som.', num: true },
  { key: 'bacterias', label: 'Rec. bact.', num: true },
];

function desdeDias(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

export default function ComparativaTab() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [series, setSeries] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dias, setDias] = useState(90);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [rango, setRango] = useState(null);
  const [sortKey, setSortKey] = useState('litros');
  const [sortDir, setSortDir] = useState('desc');

  const [grupos, setGrupos] = useState([]);
  const [grupoSel, setGrupoSel] = useState(''); // '' = todos
  const [showModal, setShowModal] = useState(false);
  const [showProm, setShowProm] = useState(true);

  const cargarGrupos = useCallback(async () => {
    try {
      const res = await api('/api/admin/grupos');
      setGrupos(res.data || []);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    cargarGrupos();
  }, [cargarGrupos]);

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
        if (grupoSel) params.set('grupo_id', grupoSel);
        const qs = params.toString();
        const [res, ser] = await Promise.all([
          api(`/api/admin/dashboard?${qs}`),
          api(`/api/admin/comparativa-series?${qs}`),
        ]);
        setData(res);
        setSeries(ser.series);
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
  }, [dias, rango, grupoSel, navigate]);

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

  const { visibles, restantes, abierto, toggle } = useColapsable(tabla, 10);

  if (loading && !data) {
    return <div className="empty-state">Cargando…</div>;
  }

  const kpis = data?.kpis;

  return (
    <>
      {error && <div className="error-msg">{error}</div>}

      <div className="grupo-bar">
        <div className="form-group">
          <label htmlFor="grupo-sel">Grupo a analizar</label>
          <select id="grupo-sel" value={grupoSel} onChange={(e) => setGrupoSel(e.target.value)}>
            <option value="">Todos los productores</option>
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>{g.nombre} ({g.card_codes.length})</option>
            ))}
          </select>
        </div>
        <button type="button" className="btn btn-primary" style={{ width: 'auto' }} onClick={() => setShowModal(true)}>
          Gestionar grupos
        </button>
      </div>

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
          <KpiCard label="Prom. células" value={fmt(kpis.promedio_celulas)} />
          <KpiCard label="Prom. bacterias" value={fmt(kpis.promedio_bacterias)} />
        </div>
      )}

      <div className="table-toolbar">
        <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
          Cada línea es un productor del grupo.
        </span>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
          <input type="checkbox" checked={showProm} onChange={(e) => setShowProm(e.target.checked)} style={{ width: 'auto' }} />
          Mostrar promedio del grupo
        </label>
      </div>

      <div className="charts-grid">
        <ChartPanel title="Litros remitidos por mes">
          <MultiProductorChart data={series?.litros} showPromedio={showProm} unit="L" />
        </ChartPanel>
        <ChartPanel title="Liquidación bruta por mes">
          <MultiProductorChart data={series?.liquidacion_bruta} showPromedio={showProm} />
        </ChartPanel>
      </div>

      <div className="charts-grid">
        <ChartPanel title="Células somáticas (promedio mensual)">
          <MultiProductorChart data={series?.celulas} showPromedio={showProm} />
        </ChartPanel>
        <ChartPanel title="Recuento bacteriano (promedio mensual)">
          <MultiProductorChart data={series?.bacterias} showPromedio={showProm} />
        </ChartPanel>
      </div>

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
              {visibles.map((p) => (
                <tr key={p.card_code}>
                  <td>{p.card_name} <span className="muted-code">({p.card_code})</span></td>
                  <td className="num">{fmt(p.litros)}</td>
                  <td className="num">{fmt(p.entregas)}</td>
                  <td>{p.ultima_entrega ? fmtDate(p.ultima_entrega) : '—'}</td>
                  <td className="num">{p.grasa != null ? fmt(p.grasa) : '—'}</td>
                  <td className="num">{p.proteina != null ? fmt(p.proteina) : '—'}</td>
                  <td className="num">{p.lactosa != null ? fmt(p.lactosa) : '—'}</td>
                  <td className="num">{p.solidos != null ? fmt(p.solidos) : '—'}</td>
                  <td className="num">{p.celulas != null ? fmt(p.celulas) : '—'}</td>
                  <td className="num">{p.bacterias != null ? fmt(p.bacterias) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <VerMasButton abierto={abierto} restantes={restantes} onToggle={toggle} />

      {showModal && (
        <GestionGruposModal
          grupos={grupos}
          onClose={() => setShowModal(false)}
          onChange={async () => {
            await cargarGrupos();
          }}
        />
      )}
    </>
  );
}

// --- Modal de gestión de grupos ---
function GestionGruposModal({ grupos, onClose, onChange }) {
  const [padron, setPadron] = useState([]);
  const [nuevo, setNuevo] = useState('');
  const [editId, setEditId] = useState(null);
  const [nombre, setNombre] = useState('');
  const [miembros, setMiembros] = useState(() => new Set());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api('/api/admin/productores');
        setPadron(res.data || []);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, []);

  function abrirEdicion(g) {
    setEditId(g.id);
    setNombre(g.nombre);
    setMiembros(new Set(g.card_codes || []));
    setError('');
  }

  async function crear() {
    const n = nuevo.trim();
    if (!n) return;
    setBusy(true);
    setError('');
    try {
      await api('/api/admin/grupos', { method: 'POST', body: JSON.stringify({ nombre: n }) });
      setNuevo('');
      await onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function guardar() {
    if (!editId) return;
    setBusy(true);
    setError('');
    try {
      await api(`/api/admin/grupos/${editId}`, {
        method: 'PUT',
        body: JSON.stringify({ nombre: nombre.trim(), card_codes: [...miembros] }),
      });
      setEditId(null);
      await onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function eliminar(id) {
    if (!window.confirm('¿Eliminar este grupo?')) return;
    setBusy(true);
    setError('');
    try {
      await api(`/api/admin/grupos/${id}`, { method: 'DELETE' });
      if (editId === id) setEditId(null);
      await onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function toggleMiembro(code) {
    setMiembros((s) => {
      const next = new Set(s);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-card__header">
          <h3 style={{ margin: 0 }}>Gestionar grupos</h3>
          <button type="button" className="btn btn-vermas" style={{ padding: '0.2rem 0.6rem' }} onClick={onClose}>
            Cerrar
          </button>
        </div>

        {error && <div className="error-msg">{error}</div>}

        <div className="form-group" style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="nuevo-grupo">Nuevo grupo</label>
            <input id="nuevo-grupo" type="text" value={nuevo} onChange={(e) => setNuevo(e.target.value)} placeholder="Nombre del grupo" />
          </div>
          <button type="button" className="btn btn-primary" style={{ width: 'auto' }} disabled={busy || !nuevo.trim()} onClick={crear}>
            Crear
          </button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Grupo</th>
                <th className="num">Productores</th>
                <th className="num">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => (
                <tr key={g.id}>
                  <td>{g.nombre}</td>
                  <td className="num">{g.card_codes.length}</td>
                  <td className="num">
                    <button type="button" className="btn btn-ghost" style={{ width: 'auto', padding: '0.25rem 0.6rem' }} onClick={() => abrirEdicion(g)}>Editar</button>{' '}
                    <button type="button" className="btn btn-ghost" style={{ width: 'auto', padding: '0.25rem 0.6rem', color: '#b3261e' }} onClick={() => eliminar(g.id)}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {editId && (
          <div className="stat-card" style={{ marginTop: '1rem' }}>
            <div className="form-group">
              <label htmlFor="edit-nombre">Nombre del grupo</label>
              <input id="edit-nombre" type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--muted)' }}>
              Productores del grupo ({miembros.size})
            </label>
            <div className="grupo-miembros">
              {padron.map((p) => (
                <label key={p.card_code}>
                  <input type="checkbox" checked={miembros.has(p.card_code)} onChange={() => toggleMiembro(p.card_code)} />
                  {p.card_name} <span className="muted-code">({p.card_code})</span>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button type="button" className="btn btn-primary" style={{ width: 'auto' }} disabled={busy || !nombre.trim()} onClick={guardar}>
                {busy ? 'Guardando…' : 'Guardar cambios'}
              </button>
              <button type="button" className="btn btn-vermas" onClick={() => setEditId(null)}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
