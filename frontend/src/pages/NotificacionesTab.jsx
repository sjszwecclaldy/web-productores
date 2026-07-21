import { useEffect, useState } from 'react';
import { api } from '../api';
import { fmt, fmtDate } from '../utils';

const INDICADOR_LABEL = {
  litros: 'Litros',
  grasa: 'Grasa',
  proteina: 'Proteína',
  celulas: 'Células somáticas',
  bacterias: 'Recuento bacteriano',
};

export default function NotificacionesTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    try {
      const data = await api('/api/admin/notificaciones');
      setItems(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function marcarLeida(id) {
    try {
      await api(`/api/admin/notificaciones/${id}/leer`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function eliminar(id) {
    try {
      await api(`/api/admin/notificaciones/${id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) {
    return <div className="empty-state">Cargando…</div>;
  }

  return (
    <>
      {error && <div className="error-msg">{error}</div>}

      {items.length === 0 ? (
        <div className="empty-state">No hay notificaciones.</div>
      ) : (
        <div className="comunicados-list">
          {items.map((n) => (
            <article key={n.id} className={`comunicado-card${n.leida ? '' : ' comunicado-card--importante'}`}>
              <div className="comunicado-card__head">
                <h3>
                  {n.card_name || n.card_code} <span className="muted-code">({n.card_code})</span>
                </h3>
                {!n.leida && <span className="badge badge--importante">Nueva</span>}
              </div>
              <p className="comunicado-card__meta">
                {INDICADOR_LABEL[n.indicador] || n.indicador} · {fmtDate(n.fecha)} · detectado {n.creado}
              </p>
              <p className="comunicado-card__body">
                {n.mensaje}
                {' '}
                (valor {fmt(n.valor)} · promedio {fmt(n.promedio)} · desvío {fmt(n.desvio_pct)}%)
              </p>
              <div className="comunicado-card__actions">
                {!n.leida && (
                  <button type="button" className="btn btn-ghost" style={{ width: 'auto', padding: '0.25rem 0.6rem' }} onClick={() => marcarLeida(n.id)}>
                    Marcar leída
                  </button>
                )}
                <button type="button" className="btn btn-ghost" style={{ width: 'auto', padding: '0.25rem 0.6rem', color: '#b3261e' }} onClick={() => eliminar(n.id)}>
                  Eliminar
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
