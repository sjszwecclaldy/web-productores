import { useState } from 'react';
import AppHeader from '../components/AppHeader';
import ComparativaTab from './ComparativaTab';
import NotificacionesTab from './NotificacionesTab';
import FiltrosTab from './FiltrosTab';

const TABS = [
  { key: 'comparativa', label: 'Comparativa' },
  { key: 'notificaciones', label: 'Notificaciones' },
  { key: 'filtros', label: 'Filtros' },
];

export default function Tecnico() {
  const [tab, setTab] = useState('comparativa');

  return (
    <div className="layout">
      <AppHeader />

      <main className="main">
        <h2 className="page-title">Técnico</h2>

        <div className="subtabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`subtab${tab === t.key ? ' active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'comparativa' && <ComparativaTab />}
        {tab === 'notificaciones' && <NotificacionesTab />}
        {tab === 'filtros' && <FiltrosTab />}
      </main>
    </div>
  );
}
