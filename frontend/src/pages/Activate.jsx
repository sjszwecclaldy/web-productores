import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, setToken } from '../api';

export default function Activate() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    card_code: '',
    activation_code: '',
    email: '',
    password: '',
    confirm: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setLoading(true);
    try {
      const data = await api('/auth/activate', {
        method: 'POST',
        body: JSON.stringify({
          card_code: form.card_code.trim(),
          activation_code: form.activation_code.trim(),
          email: form.email.trim(),
          password: form.password,
        }),
      });
      setToken(data.token);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-card">
      <h2>Activar cuenta</h2>
      <p className="subtitle">
        Ingresá el código que recibiste por WhatsApp y elegí tu email y contraseña.
      </p>

      {error && <div className="error-msg">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="card_code">Código de productor</label>
          <input
            id="card_code"
            value={form.card_code}
            onChange={update('card_code')}
            required
            placeholder="Ej: P00123"
          />
        </div>
        <div className="form-group">
          <label htmlFor="activation_code">Código de activación</label>
          <input
            id="activation_code"
            value={form.activation_code}
            onChange={update('activation_code')}
            required
            placeholder="Recibido por WhatsApp"
          />
        </div>
        <div className="form-group">
          <label htmlFor="email">Tu email</label>
          <input
            id="email"
            type="email"
            value={form.email}
            onChange={update('email')}
            required
            autoComplete="email"
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            value={form.password}
            onChange={update('password')}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
        <div className="form-group">
          <label htmlFor="confirm">Confirmar contraseña</label>
          <input
            id="confirm"
            type="password"
            value={form.confirm}
            onChange={update('confirm')}
            required
            autoComplete="new-password"
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Activando…' : 'Activar cuenta'}
        </button>
      </form>

      <div className="auth-links">
        <Link to="/login">Ya tengo cuenta — Iniciar sesión</Link>
      </div>
    </div>
  );
}
