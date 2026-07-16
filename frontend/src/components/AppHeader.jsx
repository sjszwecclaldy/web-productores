import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  api,
  clearToken,
  getCardName,
  isAdmin,
  getAdminCardCode,
  setAdminProducer,
} from '../api';
import {
  IconCalidad,
  IconLiquidaciones,
  IconReliquidaciones,
  IconRemisiones,
  IconResumen,
} from './icons';

const NAV_ITEMS = [
  { to: '/', end: true, label: 'Resumen', Icon: IconResumen },
  { to: '/composicion', label: 'Composición', Icon: IconCalidad },
  { to: '/remisiones', label: 'Remisiones', Icon: IconRemisiones },
  { to: '/liquidaciones', label: 'Liquidaciones', Icon: IconLiquidaciones },
  { to: '/reliquidaciones', label: 'Reliquidaciones', Icon: IconReliquidaciones },
];

function ProducerSelector() {
  const [productores, setProductores] = useState([]);
  const selected = getAdminCardCode();

  useEffect(() => {
    let active = true;
    api('/api/admin/productores')
      .then((data) => {
        if (active) setProductores(data.data || []);
      })
      .catch(() => {
        if (active) setProductores([]);
      });
    return () => {
      active = false;
    };
  }, []);

  function handleChange(e) {
    const code = e.target.value;
    if (!code) return;
    const prod = productores.find((p) => p.card_code === code);
    setAdminProducer(code, prod ? prod.card_name : code);
    window.location.reload();
  }

  return (
    <select className="producer-select" value={selected} onChange={handleChange}>
      <option value="">Seleccioná un productor…</option>
      {productores.map((p) => (
        <option key={p.card_code} value={p.card_code}>
          {p.card_name} ({p.card_code})
        </option>
      ))}
    </select>
  );
}

export default function AppHeader() {
  const navigate = useNavigate();
  const admin = isAdmin();

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
          {admin ? (
            <>
              <span className="topbar-user">Administrador</span>
              <ProducerSelector />
            </>
          ) : (
            getCardName() && <span className="topbar-user">{getCardName()}</span>
          )}
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
