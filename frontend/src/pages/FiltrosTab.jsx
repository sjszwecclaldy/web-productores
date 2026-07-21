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

const labelInd = (k) => INDICADORES.find((i) => i.key === k)?.label || k;
const labelDir = (k) => DIRECCIONES.find((d) => d.key === k)?.label || k;

const emptyForm = { indicador: 'litros', ventana_dias: 4, umbral_pct: 15, direccion: 'arriba', activa: true };

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
      ventana_dias: r.ventana_dias,
      umbral_pct: r.umbral_pct,
      direccion: r.direccion,
      activa: r.activa,
    });
    setShowForm(true);
  }

  async function save(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        indicador: form.indicador,
        ventana_dias: Number(form.ventana_dias),
        umbral_pct: Number(form.umbral_pct),
        direccion: form.direccion,
        activa: form.activa,
      };
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
        Las reglas comparan cada dato nuevo contra el promedio de las últimas N mediciones del productor.
        Si el desvío supera el umbral, se genera una notificación.
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
                <th>Dirección</th>
                <th className="num">Ventana</th>
                <th className="num">Umbral</th>
                <th>Estado</th>
                <th className="num">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {reglas.map((r) => (
                <tr key={r.id}>
                  <td>{labelInd(r.indicador)}</td>
                  <td>{labelDir(r.direccion)}</td>
                  <td className="num">{r.ventana_dias}</td>
                  <td className="num">{r.umbral_pct}%</td>
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
