import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setAdminProducer } from '../api';
import { fmt, fmtDate } from '../utils';
import VerMasButton from '../components/VerMasButton';
import { useColapsable } from '../hooks/useColapsable';

const INDICADORES = [
  { key: 'litros', label: 'Litros' },
  { key: 'grasa', label: 'Grasa' },
  { key: 'proteina', label: 'Proteína' },
  { key: 'celulas', label: 'Células somáticas' },
  { key: 'bacterias', label: 'Recuento bacteriano' },
];
const labelInd = (k) => INDICADORES.find((i) => i.key === k)?.label || k;

// Indicador -> pantalla del productor donde ver el dato atípico.
// calidad-sanitaria (no /calidad, que redirige a Composición).
const SCREEN = {
  litros: '/remisiones',
  grasa: '/composicion',
  proteina: '/composicion',
  celulas: '/calidad-sanitaria',
  bacterias: '/calidad-sanitaria',
};

// Texto del detalle: usa el mensaje del backend (sirve para desvío e intervalo);
// si no hubiera, arma un resumen con valor vs promedio.
function detalle(n) {
  if (n.mensaje) return n.mensaje;
  if (n.promedio != null && n.desvio_pct != null) {
    return `${fmt(n.valor)} vs prom. ${fmt(n.promedio)} (${n.desvio_pct > 0 ? '+' : ''}${fmt(n.desvio_pct)}%)`;
  }
  return fmt(n.valor);
}

const emptyFiltros = { productor: '', indicador: '', desde: '', hasta: '' };

export default function NotificacionesTab() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sel, setSel] = useState(() => new Set());
  const [filtros, setFiltros] = useState(emptyFiltros);

  async function load() {
    try {
      const data = await api('/api/admin/notificaciones');
      setItems(data.data || []);
      setSel(new Set());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const setF = (f) => (e) => setFiltros((s) => ({ ...s, [f]: e.target.value }));

  const filtrados = useMemo(() => {
    const q = filtros.productor.trim().toLowerCase();
    return items
      .filter((n) => {
        if (q && !`${n.card_name || ''} ${n.card_code}`.toLowerCase().includes(q)) return false;
        if (filtros.indicador && n.indicador !== filtros.indicador) return false;
        if (filtros.desde && n.fecha < filtros.desde) return false;
        if (filtros.hasta && n.fecha > filtros.hasta) return false;
        return true;
      })
      // Más reciente arriba (orden descendente por fecha).
      .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
  }, [items, filtros]);

  const { visibles, restantes, abierto, toggle } = useColapsable(filtrados, 10);

  const allSelected = filtrados.length > 0 && filtrados.every((n) => sel.has(n.id));

  function toggleAll() {
    if (allSelected) {
      setSel(new Set());
    } else {
      setSel(new Set(filtrados.map((n) => n.id)));
    }
  }

  function toggleOne(id) {
    setSel((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function eliminarSeleccionadas() {
    const ids = [...sel];
    if (ids.length === 0) return;
    setError('');
    try {
      await api('/api/admin/notificaciones/eliminar', { method: 'POST', body: JSON.stringify({ ids }) });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function irADato(n) {
    setAdminProducer(n.card_code, n.card_name || n.card_code);
    const screen = SCREEN[n.indicador] || '/';
    navigate(`${screen}?fecha=${n.fecha}`);
  }

  if (loading) {
    return <div className="empty-state">Cargando…</div>;
  }

  return (
    <>
      {error && <div className="error-msg">{error}</div>}

      <form className="filters" onSubmit={(e) => e.preventDefault()}>
        <div className="form-group">
          <label htmlFor="f-prod">Productor</label>
          <input id="f-prod" type="text" value={filtros.productor} onChange={setF('productor')} placeholder="Nombre o código" />
        </div>
        <div className="form-group">
          <label htmlFor="f-ind">Indicador</label>
          <select id="f-ind" value={filtros.indicador} onChange={setF('indicador')}>
            <option value="">Todos</option>
            {INDICADORES.map((i) => (
              <option key={i.key} value={i.key}>{i.label}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="f-desde">Desde</label>
          <input id="f-desde" type="date" value={filtros.desde} onChange={setF('desde')} />
        </div>
        <div className="form-group">
          <label htmlFor="f-hasta">Hasta</label>
          <input id="f-hasta" type="date" value={filtros.hasta} onChange={setF('hasta')} />
        </div>
      </form>

      <div className="table-toolbar">
        <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
          {sel.size > 0 ? `${sel.size} seleccionada(s)` : `${filtrados.length} notificación(es)`}
        </span>
        <button type="button" className="btn btn-danger" style={{ width: 'auto' }} disabled={sel.size === 0} onClick={eliminarSeleccionadas}>
          Eliminar seleccionadas
        </button>
      </div>

      <div className="table-wrap">
        {filtrados.length === 0 ? (
          <div className="empty-state">No hay notificaciones para el filtro.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: '2.2rem' }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                </th>
                <th>Fecha</th>
                <th>Productor</th>
                <th>Indicador</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((n) => (
                <tr key={n.id} className="clickable-row" onClick={() => irADato(n)}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={sel.has(n.id)} onChange={() => toggleOne(n.id)} />
                  </td>
                  <td>{fmtDate(n.fecha)}</td>
                  <td>{n.card_name || n.card_code} <span className="muted-code">({n.card_code})</span></td>
                  <td>{labelInd(n.indicador)}</td>
                  <td>{detalle(n)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <VerMasButton abierto={abierto} restantes={restantes} onToggle={toggle} />
    </>
  );
}
