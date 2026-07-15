import { NavLink, useNavigate } from 'react-router-dom';
import { clearToken, getCardName } from '../api';
import {
  IconCalidad,
  IconLiquidaciones,
  IconReliquidaciones,
  IconRemisiones,
  IconResumen,
} from './icons';

const NAV_ITEMS = [
  { to: '/', end: true, label: 'Resumen', Icon: IconResumen },
  { to: '/calidad', label: 'Calidad', Icon: IconCalidad },
  { to: '/remisiones', label: 'Remisiones', Icon: IconRemisiones },
  { to: '/liquidaciones', label: 'Liquidaciones', Icon: IconLiquidaciones },
  { to: '/reliquidaciones', label: 'Reliquidaciones', Icon: IconReliquidaciones },
];

export default function AppHeader() {
  const navigate = useNavigate();

  function logout() {
    clearToken();
    navigate('/login');
  }

  const linkClass = ({ isActive }) => (isActive ? 'nav-tab active' : 'nav-tab');

  return (
    <header className="app-header">
      <div className="topbar">
        <div className="topbar-brand">
          <div className="brand-logo-wrap">
            <img src="/logo-claldy.png" alt="CLALDY" className="brand-logo" />
          </div>
          <div className="topbar-title">
            <h1>Portal de Productores</h1>
            <span className="topbar-subtitle">CLALDY Natural</span>
          </div>
        </div>
        <div className="topbar-actions">
          {getCardName() && <span className="topbar-user">{getCardName()}</span>}
          <button type="button" className="btn btn-ghost" onClick={logout}>
            Salir
          </button>
        </div>
      </div>
      <nav className="nav-tabs" aria-label="Secciones del portal">
        {NAV_ITEMS.map(({ to, end, label, Icon }) => (
          <NavLink key={to} to={to} end={end} className={linkClass}>
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
