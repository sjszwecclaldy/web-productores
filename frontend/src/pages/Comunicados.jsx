import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearToken, isAdmin } from '../api';
import { fmtDate } from '../utils';
import AppHeader from '../components/AppHeader';
import LoadingScreen from '../components/LoadingScreen';

const emptyForm = {
  titulo: '',
  cuerpo: '',
  card_code: '',
  importante: false,
};

export default function Comunicados() {
  const navigate = useNavigate();
  const admin = isAdmin();
  const [comunicados, setComunicados] = useState([]);
  const [productores, setProductores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function loadComunicados() {
    const path = admin ? '/api/admin/comunicados' : '/api/comunicados';
    const data = await api(path);
    setComunicados(data.data || []);
  }

  useEffect(() => {
    async function init() {
      try {
        await loadComunicados();
        if (admin) {
          const prod = await api('/api/admin/productores');
          setProductores(prod.data || []);
        }
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

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  function openNew() {
    setEditId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(c) {
    setEditId(c.id);
    setForm({
      titulo: c.titulo || '',
      cuerpo: c.cuerpo || '',
      card_code: c.card_code || '',
      importante: !!c.importante,
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
    if (!form.titulo.trim() || !form.cuerpo.trim()) {
      setError('El título y el mensaje son obligatorios.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        titulo: form.titulo.trim(),
        cuerpo: form.cuerpo.trim(),
        card_code: form.card_code || null,
        importante: form.importante,
      };
      if (editId) {
        await api(`/api/admin/comunicados/${editId}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await api('/api/admin/comunicados', { method: 'POST', body: JSON.stringify(payload) });
      }
      cancelForm();
      await loadComunicados();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteComunicado(id) {
    if (!window.confirm('¿Eliminar este comunicado? Esta acción no se puede deshacer.')) return;
    setError('');
    try {
      await api(`/api/admin/comunicados/${id}`, { method: 'DELETE' });
      await loadComunicados();
    } catch (err) {
      setError(err.message);
    }
  }

  function destinatarioLabel(c) {
    if (!c.card_code) return 'Todos los productores';
    return c.card_name ? `${c.card_name} (${c.card_code})` : c.card_code;
  }

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="layout">
      <AppHeader />

      <main className="main">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <h2 className="page-title" style={{ marginBottom: 0 }}>Comunicados</h2>
          {admin && !showForm && (
            <button type="button" className="btn btn-primary" style={{ width: 'auto' }} onClick={openNew}>
              + Nuevo comunicado
            </button>
          )}
        </div>

        {error && <div className="error-msg">{error}</div>}

        {admin && showForm && (
          <form className="stat-card" onSubmit={saveForm} style={{ marginTop: '1rem' }}>
            <h3>{editId ? 'Editar comunicado' : 'Nuevo comunicado'}</h3>
            <div className="form-group" style={{ marginTop: '0.5rem' }}>
              <label htmlFor="c-titulo">Título</label>
              <input id="c-titulo" type="text" value={form.titulo} onChange={update('titulo')} placeholder="Título del comunicado" required />
            </div>
            <div className="cards-grid">
              <div className="form-group">
                <label htmlFor="c-dest">Destinatario</label>
                <select id="c-dest" value={form.card_code} onChange={update('card_code')}>
                  <option value="">Todos los productores</option>
                  {productores.map((p) => (
                    <option key={p.card_code} value={p.card_code}>
                      {p.card_name} ({p.card_code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.importante}
                    onChange={(e) => setForm((f) => ({ ...f, importante: e.target.checked }))}
                    style={{ width: 'auto' }}
                  />
                  Marcar como importante
                </label>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="c-cuerpo">Mensaje</label>
              <textarea
                id="c-cuerpo"
                rows={4}
                value={form.cuerpo}
                onChange={update('cuerpo')}
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
                {saving ? 'Guardando…' : editId ? 'Guardar cambios' : 'Publicar comunicado'}
              </button>
              <button type="button" className="btn btn-ghost" style={{ width: 'auto' }} onClick={cancelForm}>
                Cancelar
              </button>
            </div>
          </form>
        )}

        <div className="comunicados-list" style={{ marginTop: '1rem' }}>
          {comunicados.length === 0 ? (
            <div className="empty-state">No hay comunicados por el momento.</div>
          ) : (
            comunicados.map((c) => (
              <article
                key={c.id}
                className={`comunicado-card${c.importante ? ' comunicado-card--importante' : ''}`}
              >
                <div className="comunicado-card__head">
                  <h3>{c.titulo}</h3>
                  {c.importante && <span className="badge badge--importante">Importante</span>}
                </div>
                <p className="comunicado-card__meta">
                  {fmtDate(c.fecha)}
                  {admin
                    ? ` · Para: ${destinatarioLabel(c)}`
                    : c.dirigido
                      ? ' · Dirigido a vos'
                      : ''}
                </p>
                <p className="comunicado-card__body">{c.cuerpo}</p>
                {admin && (
                  <div className="comunicado-card__actions">
                    <button type="button" className="btn btn-ghost" style={{ width: 'auto', padding: '0.25rem 0.6rem' }} onClick={() => openEdit(c)}>
                      Editar
                    </button>
                    <button type="button" className="btn btn-ghost" style={{ width: 'auto', padding: '0.25rem 0.6rem', color: '#b3261e' }} onClick={() => deleteComunicado(c.id)}>
                      Eliminar
                    </button>
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
