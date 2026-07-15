import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, setToken, setCardName } from '../api';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setToken(data.token);
      if (data.card_name) setCardName(data.card_name);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-panel auth-panel--brand">
        <div className="auth-hero-logo">
          <div className="brand-logo-wrap">
            <img src="/logo-claldy.png" alt="CLALDY" className="auth-hero-logo__img" />
          </div>
        </div>
        <h1 className="auth-hero-title">Portal de Productores</h1>
        <p className="auth-hero-text">
          Consultá la calidad de tu leche, entregas, liquidaciones y ajustes en un solo lugar.
        </p>
        <ul className="auth-hero-features">
          <li>Resumen de produccion</li>
          <li>Calidad y composicion</li>
          <li>Remisiones y entregas</li>
          <li>Liquidaciones mensuales</li>
          <li>Reliquidaciones</li>
        </ul>
      </div>

      <div className="auth-panel auth-panel--form">
        <div className="auth-form-wrap">
          <h2>Iniciar sesión</h2>
          <p className="subtitle">Accedé con tu email y contraseña</p>

          {error && <div className="error-msg">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Contraseña</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>

          <div className="auth-links">
            <Link to="/activate">Primera vez — Activar cuenta</Link>
            <br />
            <Link to="/forgot-password">Olvidé mi contraseña</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
