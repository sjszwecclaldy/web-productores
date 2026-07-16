import { isAdmin, getAdminCardCode } from '../api';
import AppHeader from './AppHeader';

// Para el admin: si todavía no eligió un productor, muestra un aviso en vez de
// llamar a la API (que no devolvería datos). Los productores comunes pasan de largo.
export default function AdminProducerGate({ children }) {
  if (isAdmin() && !getAdminCardCode()) {
    return (
      <div className="layout">
        <AppHeader />
        <main className="main">
          <h2 className="page-title">Panel administrativo</h2>
          <div className="empty-state">
            Seleccioná un productor en el menú de arriba para ver su información.
          </div>
        </main>
      </div>
    );
  }
  return children;
}
