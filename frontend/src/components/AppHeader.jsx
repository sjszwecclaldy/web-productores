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
      <div>
        <h1>{title}</h1>
        {getCardName() && <span>{getCardName()}</span>}
      </div>
      <nav className="nav">
        <NavLink to="/" end className={linkClass}>Calidad</NavLink>
        <NavLink to="/remisiones" className={linkClass}>Remisiones</NavLink>
      </nav>
      <button type="button" className="btn btn-ghost" onClick={logout}>
        Salir
      </button>
    </header>
  );
}
