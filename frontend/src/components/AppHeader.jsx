import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  api,
  clearToken,
  getCardName,
  isAdmin,
  getAdminCardName,
  setAdminProducer,
} from '../api';
import {
  IconCalidad,
  IconComparativa,
  IconSanidad,
  IconLiquidaciones,
  IconReliquidaciones,
  IconRemisiones,
  IconResumen,
} from './icons';

const NAV_ITEMS = [
  { to: '/', end: true, label: 'Resumen', Icon: IconResumen },
  { to: '/composicion', label: 'Composición', Icon: IconCalidad },
  { to: '/calidad-sanitaria', label: 'Calidad', Icon: IconSanidad },
  { to: '/remisiones', label: 'Remisiones', Icon: IconRemisiones },
  { to: '/liquidaciones', label: 'Liquidaciones', Icon: IconLiquidaciones },
  { to: '/reliquidaciones', label: 'Reliquidaciones', Icon: IconReliquidaciones },
];

const ADMIN_NAV_ITEM = { to: '/comparativa', label: 'Comparativa', Icon: IconComparativa };

function normalize(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function ProducerSelector() {
  const [productores, setProductores] = useState([]);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const seleccionado = getAdminCardName();

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

  const filtrados = q
    ? productores.filter((p) => normalize(`${p.card_name} ${p.card_code}`).includes(normalize(q)))
    : productores;

  function elegir(p) {
    setAdminProducer(p.card_code, p.card_name);
    window.location.reload();
  }

  return (
    <div className="producer-combo">
      <input
        className="producer-combo__input"
        type="text"
        placeholder={seleccionado || 'Buscar productor…'}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && filtrados.length > 0 && (
        <ul className="producer-combo__list">
          {filtrados.slice(0, 50).map((p) => (
            <li
              key={p.card_code}
              className="producer-combo__item"
              onMouseDown={() => elegir(p)}
            >
              {p.card_name} <span className="producer-combo__code">({p.card_code})</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AppHeader() {
  const navigate = useNavigate();
  const admin = isAdmin();
  const navItems = admin ? [...NAV_ITEMS, ADMIN_NAV_ITEM] : NAV_ITEMS;

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
        {navItems.map(({ to, end, label, Icon }) => (
          <NavLink key={to} to={to} end={end} className={linkClass}>
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
