import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearToken, isAdmin, getAdminCardCode } from '../api';
import { fmtDate } from '../utils';
import AppHeader from '../components/AppHeader';
import LoadingScreen from '../components/LoadingScreen';

const TEMAS = ['Calidad de Leche', 'Antibiótico', 'Visita de rutina', 'Otros'];

const emptyForm = {
  fecha: '',
  tema: TEMAS[0],
  tecnico: '',
  comentarios: '',
  accion: '',
  proxima_visita: '',
};

export default function Visitas() {
  const navigate = useNavigate();
  const admin = isAdmin();
  const [visitas, setVisitas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filtros
  const [temaFiltro, setTemaFiltro] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  // Formulario admin (alta / edición)
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function loadVisitas() {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (temaFiltro) params.set('tema', temaFiltro);
    const qs = params.toString();
    const data = await api(`/api/visitas${qs ? `?${qs}` : ''}`);
    setVisitas(data.data || []);
  }

  useEffect(() => {
    async function init() {
      try {
        await loadVisitas();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  async function handleFilter(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await loadVisitas();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  function openNew() {
    setEditId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(v) {
    setEditId(v.id);
    setForm({
      fecha: v.fecha || '',
      tema: TEMAS.includes(v.tema) ? v.tema : TEMAS[0],
      tecnico: v.tecnico || '',
      comentarios: v.comentarios || '',
      accion: v.accion || '',
      proxima_visita: v.proxima_visita || '',
    });
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditId(null);
    setForm(emptyForm);
  }

  async function saveForm(e) {
    e.preventDefault();
    setError('');
    if (!form.fecha || !form.tema) {
      setError('Fecha y tema son obligatorios.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        fecha: form.fecha,
        tema: form.tema,
        tecnico: form.tecnico.trim() || null,
        comentarios: form.comentarios.trim() || null,
        accion: form.accion.trim() || null,
        proxima_visita: form.proxima_visita || null,
      };
      if (editId) {
        await api(`/api/admin/visitas/${editId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await api('/api/admin/visitas', {
          method: 'POST',
          body: JSON.stringify({ ...payload, card_code: getAdminCardCode() }),
        });
      }
      cancelForm();
      await loadVisitas();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteVisita(id) {
    if (!window.confirm('¿Eliminar esta visita? Esta acción no se puede deshacer.')) return;
    setError('');
    try {
      await api(`/api/admin/visitas/${id}`, { method: 'DELETE' });
      await loadVisitas();
    } catch (err) {
      setError(err.message);
    }
  }

  const visibles = useMemo(() => visitas, [visitas]);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="layout">
      <AppHeader />

      <main className="main">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <h2 className="page-title" style={{ marginBottom: 0 }}>Visitas del Departamento Técnico</h2>
          {admin && !showForm && (
            <button type="button" className="btn btn-primary" style={{ width: 'auto' }} onClick={openNew}>
              + Agregar visita
            </button>
          )}
        </div>

        {error && <div className="error-msg">{error}</div>}

        {admin && showForm && (
          <form className="stat-card" onSubmit={saveForm} style={{ marginTop: '1rem' }}>
            <h3>{editId ? 'Editar visita' : 'Nueva visita'}</h3>
            <div className="cards-grid" style={{ marginTop: '0.5rem' }}>
              <div className="form-group">
                <label htmlFor="v-fecha">Fecha</label>
                <input id="v-fecha" type="date" value={form.fecha} onChange={update('fecha')} required />
              </div>
              <div className="form-group">
                <label htmlFor="v-tema">Tema</label>
                <select id="v-tema" value={form.tema} onChange={update('tema')}>
                  {TEMAS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="v-tecnico">Técnico</label>
                <input id="v-tecnico" type="text" value={form.tecnico} onChange={update('tecnico')} placeholder="Nombre del técnico" />
              </div>
              <div className="form-group">
                <label htmlFor="v-proxima">Próxima visita</label>
                <input id="v-proxima" type="date" value={form.proxima_visita} onChange={update('proxima_visita')} />
              </div>
            </div>
            <div className="form-group" style={{ marginTop: '0.5rem' }}>
              <label htmlFor="v-comentarios">Comentarios / observaciones</label>
              <textarea
                id="v-comentarios"
                rows={3}
                value={form.comentarios}
                onChange={update('comentarios')}
                ref={(el) => {
                  if (el) {
                    el.style.height = 'auto';
                    el.style.height = `${el.scrollHeight}px`;
                  }
                }}
              />
            </div>
            <div className="form-group">
              <label htmlFor="v-accion">Acción acordada</label>
              <textarea
                id="v-accion"
                rows={2}
                value={form.accion}
                onChange={update('accion')}
                ref={(el) => {
                  if (el) {
                    el.style.height = 'auto';
                    el.style.height = `${el.scrollHeight}px`;
                  }
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button type="submit" className="btn btn-primary" style={{ width: 'auto' }} disabled={saving}>
                {saving ? 'Guardando…' : editId ? 'Guardar cambios' : 'Crear visita'}
              </button>
              <button type="button" className="btn btn-ghost" style={{ width: 'auto' }} onClick={cancelForm}>
                Cancelar
              </button>
            </div>
          </form>
        )}

        <form className="filters" onSubmit={handleFilter}>
          <div className="form-group">
            <label htmlFor="f-tema">Tema</label>
            <select id="f-tema" value={temaFiltro} onChange={(e) => setTemaFiltro(e.target.value)}>
              <option value="">Todos</option>
              {TEMAS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="from">Desde</label>
            <input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="to">Hasta</label>
            <input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: 'auto' }}>
            Filtrar
          </button>
        </form>

        <div className="table-wrap">
          {visibles.length === 0 ? (
            <div className="empty-state">No hay visitas registradas para el filtro seleccionado.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tema</th>
                  <th>Técnico</th>
                  <th>Comentarios</th>
                  <th>Acción</th>
                  <th>Próxima visita</th>
                  {admin && <th className="num">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {visibles.map((v) => (
                  <tr key={v.id}>
                    <td>{fmtDate(v.fecha)}</td>
                    <td>{v.tema}</td>
                    <td>{v.tecnico || ''}</td>
                    <td>{v.comentarios || ''}</td>
                    <td>{v.accion || ''}</td>
                    <td>{v.proxima_visita ? fmtDate(v.proxima_visita) : ''}</td>
                    {admin && (
                      <td className="num">
                        <button type="button" className="btn btn-ghost" style={{ width: 'auto', padding: '0.25rem 0.6rem' }} onClick={() => openEdit(v)}>
                          Editar
                        </button>{' '}
                        <button type="button" className="btn btn-ghost" style={{ width: 'auto', padding: '0.25rem 0.6rem', color: '#b3261e' }} onClick={() => deleteVisita(v.id)}>
                          Eliminar
                        </button>
                      </td>
                    )}
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
