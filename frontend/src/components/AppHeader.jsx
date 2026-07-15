import { NavLink, useNavigate } from 'react-router-dom';
import { clearToken, getCardName } from '../api';

export default function AppHeader({ title }) {
  const navigate = useNavigate();

  function logout() {
    clearToken();
    navigate('/login');
  }

  const linkClass = ({ isActive }) => (isActive ? 'nav-link active' : 'nav-link');

  return (
    <header className="header">
      <div className="header-brand">
        <div className="brand-logo-wrap">
          <img src="/logo-claldy.png" alt="CLALDY" className="brand-logo" />
        </div>
        <div>
          <h1>{title}</h1>
          {getCardName() && <span>{getCardName()}</span>}
        </div>
      </div>
      <nav className="nav">
        <NavLink to="/" end className={linkClass}>Calidad</NavLink>
        <NavLink to="/remisiones" className={linkClass}>Remisiones</NavLink>
        <NavLink to="/liquidaciones" className={linkClass}>Liquidaciones</NavLink>
        <NavLink to="/reliquidaciones" className={linkClass}>Reliquidaciones</NavLink>
      </nav>
      <button type="button" className="btn btn-ghost" onClick={logout}>
        Salir
      </button>
    </header>
  );
}
