import { useEffect, useState } from 'react';
import { api } from '../api';

const INDICADORES = [
  { key: 'litros', label: 'Litros' },
  { key: 'grasa', label: 'Grasa' },
  { key: 'proteina', label: 'Proteína' },
  { key: 'celulas', label: 'Células somáticas' },
  { key: 'bacterias', label: 'Recuento bacteriano' },
];

const DIRECCIONES = [
  { key: 'arriba', label: 'Por encima del promedio' },
  { key: 'abajo', label: 'Por debajo del promedio' },
  { key: 'ambos', label: 'Ambos' },
];

const TIPOS = [
  { key: 'desvio', label: 'Desvío vs promedio' },
  { key: 'intervalo', label: 'Intervalo de aceptación' },
];

const labelInd = (k) => INDICADORES.find((i) => i.key === k)?.label || k;
const labelDir = (k) => DIRECCIONES.find((d) => d.key === k)?.label || k;
const labelTipo = (k) => TIPOS.find((t) => t.key === k)?.label || k;

const emptyForm = {
  indicador: 'litros',
  tipo: 'desvio',
  ventana_dias: 4,
  umbral_pct: 15,
  direccion: 'arriba',
  limite_min: '',
  limite_max: '',
  activa: true,
};

// Resumen legible de los parámetros de una regla, según su tipo.
function paramsResumen(r) {
  if (r.tipo === 'intervalo') {
    const min = r.limite_min != null ? r.limite_min : null;
    const max = r.limite_max != null ? r.limite_max : null;
    if (min != null && max != null) return `Aceptable entre ${min} y ${max}`;
    if (min != null) return `Aceptable ≥ ${min}`;
    if (max != null) return `Aceptable ≤ ${max}`;
    return '—';
  }
  return `${labelDir(r.direccion)} · ${r.umbral_pct}% · ventana ${r.ventana_dias}`;
}

export default function FiltrosTab() {
  const [reglas, setReglas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const data = await api('/api/admin/control-reglas');
      setReglas(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const update = (f) => (e) => setForm((s) => ({ ...s, [f]: e.target.value }));

  function openNew() {
    setEditId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(r) {
    setEditId(r.id);
    setForm({
      indicador: r.indicador,
      tipo: r.tipo || 'desvio',
      ventana_dias: r.ventana_dias,
      umbral_pct: r.umbral_pct,
      direccion: r.direccion,
      limite_min: r.limite_min != null ? r.limite_min : '',
      limite_max: r.limite_max != null ? r.limite_max : '',
      activa: r.activa,
    });
    setShowForm(true);
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = { indicador: form.indicador, tipo: form.tipo, activa: form.activa };
      if (form.tipo === 'intervalo') {
        payload.limite_min = form.limite_min === '' ? null : Number(form.limite_min);
        payload.limite_max = form.limite_max === '' ? null : Number(form.limite_max);
      } else {
        payload.ventana_dias = Number(form.ventana_dias);
        payload.umbral_pct = Number(form.umbral_pct);
        payload.direccion = form.direccion;
      }
      if (editId) {
        await api(`/api/admin/control-reglas/${editId}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await api('/api/admin/control-reglas', { method: 'POST', body: JSON.stringify(payload) });
      }
      setShowForm(false);
      setEditId(null);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function eliminar(id) {
    if (!window.confirm('¿Eliminar esta regla?')) return;
    setError('');
    try {
      await api(`/api/admin/control-reglas/${id}`, { method: 'DELETE' });
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
      <p style={{ color: 'var(--muted)', marginTop: 0 }}>
        Las reglas generan una notificación cuando un dato se aparta de lo esperado. Hay dos tipos:
        <strong> desvío vs promedio</strong> (compara cada dato con el promedio de las últimas N mediciones
        del productor) e <strong>intervalo de aceptación</strong> (marca los datos que caen fuera de un
        rango de valores aceptables).
      </p>

      {error && <div className="error-msg">{error}</div>}

      <div className="table-toolbar">
        <h3 className="section-title" style={{ margin: 0 }}>Reglas de control</h3>
        {!showForm && (
          <button type="button" className="btn btn-primary" style={{ width: 'auto' }} onClick={openNew}>
            + Nueva regla
          </button>
        )}
      </div>

      {showForm && (
        <form className="stat-card" onSubmit={save} style={{ marginBottom: '1rem' }}>
          <h3>{editId ? 'Editar regla' : 'Nueva regla'}</h3>
          <div className="cards-grid">
            <div className="form-group">
              <label htmlFor="r-ind">Indicador</label>
              <select id="r-ind" value={form.indicador} onChange={update('indicador')}>
                {INDICADORES.map((i) => (
                  <option key={i.key} value={i.key}>{i.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="r-tipo">Tipo de regla</label>
              <select id="r-tipo" value={form.tipo} onChange={update('tipo')}>
                {TIPOS.map((t) => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {form.tipo === 'intervalo' ? (
            <div className="cards-grid">
              <div className="form-group">
                <label htmlFor="r-min">Límite mínimo aceptable</label>
                <input id="r-min" type="number" step="any" placeholder="(sin mínimo)" value={form.limite_min} onChange={update('limite_min')} />
              </div>
              <div className="form-group">
                <label htmlFor="r-max">Límite máximo aceptable</label>
                <input id="r-max" type="number" step="any" placeholder="(sin máximo)" value={form.limite_max} onChange={update('limite_max')} />
              </div>
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem', gridColumn: '1 / -1', margin: 0 }}>
                Los datos dentro del rango se consideran aceptables. Los que caen por fuera generan
                notificación. Podés dejar un límite vacío para acotar solo por un lado.
              </p>
            </div>
          ) : (
            <div className="cards-grid">
              <div className="form-group">
                <label htmlFor="r-dir">Dirección</label>
                <select id="r-dir" value={form.direccion} onChange={update('direccion')}>
                  {DIRECCIONES.map((d) => (
                    <option key={d.key} value={d.key}>{d.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="r-vent">Ventana (N últimas mediciones)</label>
                <input id="r-vent" type="number" min="1" value={form.ventana_dias} onChange={update('ventana_dias')} />
              </div>
              <div className="form-group">
                <label htmlFor="r-umb">Umbral (%)</label>
                <input id="r-umb" type="number" min="1" step="0.1" value={form.umbral_pct} onChange={update('umbral_pct')} />
              </div>
            </div>
          )}

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.activa} onChange={(e) => setForm((s) => ({ ...s, activa: e.target.checked }))} style={{ width: 'auto' }} />
              Regla activa
            </label>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="submit" className="btn btn-primary" style={{ width: 'auto' }} disabled={saving}>
              {saving ? 'Guardando…' : editId ? 'Guardar cambios' : 'Crear regla'}
            </button>
            <button type="button" className="btn btn-ghost" style={{ width: 'auto' }} onClick={() => { setShowForm(false); setEditId(null); }}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="table-wrap">
        {reglas.length === 0 ? (
          <div className="empty-state">No hay reglas todavía.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Indicador</th>
                <th>Tipo</th>
                <th>Parámetros</th>
                <th>Estado</th>
                <th className="num">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {reglas.map((r) => (
                <tr key={r.id}>
                  <td>{labelInd(r.indicador)}</td>
                  <td>{labelTipo(r.tipo)}</td>
                  <td>{paramsResumen(r)}</td>
                  <td>{r.activa ? 'Activa' : 'Inactiva'}</td>
                  <td className="num">
                    <button type="button" className="btn btn-ghost" style={{ width: 'auto', padding: '0.25rem 0.6rem' }} onClick={() => openEdit(r)}>Editar</button>{' '}
                    <button type="button" className="btn btn-ghost" style={{ width: 'auto', padding: '0.25rem 0.6rem', color: '#b3261e' }} onClick={() => eliminar(r.id)}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
