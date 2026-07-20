import { Routes, Route, Navigate } from 'react-router-dom';
import { getToken, isAdmin } from './api';
import AdminProducerGate from './components/AdminProducerGate';
import PanelComparativo from './pages/PanelComparativo';
import Login from './pages/Login';
import Activate from './pages/Activate';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Resumen from './pages/Resumen';
import Composicion from './pages/Composicion';
import Calidad from './pages/Calidad';
import Remisiones from './pages/Remisiones';
import Liquidaciones from './pages/Liquidaciones';
import Reliquidaciones from './pages/Reliquidaciones';
import Visitas from './pages/Visitas';
import Comunicados from './pages/Comunicados';

function PrivateRoute({ children }) {
  return getToken() ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  return getToken() ? <Navigate to="/" replace /> : children;
}

function RequireAdmin({ children }) {
  return isAdmin() ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/activate"
        element={
          <PublicRoute>
            <Activate />
          </PublicRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicRoute>
            <ForgotPassword />
          </PublicRoute>
        }
      />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <AdminProducerGate>
              <Resumen />
            </AdminProducerGate>
          </PrivateRoute>
        }
      />
      <Route
        path="/composicion"
        element={
          <PrivateRoute>
            <AdminProducerGate>
              <Composicion />
            </AdminProducerGate>
          </PrivateRoute>
        }
      />
      <Route path="/calidad" element={<Navigate to="/composicion" replace />} />
      <Route
        path="/calidad-sanitaria"
        element={
          <PrivateRoute>
            <AdminProducerGate>
              <Calidad />
            </AdminProducerGate>
          </PrivateRoute>
        }
      />
      <Route
        path="/remisiones"
        element={
          <PrivateRoute>
            <AdminProducerGate>
              <Remisiones />
            </AdminProducerGate>
          </PrivateRoute>
        }
      />
      <Route
        path="/liquidaciones"
        element={
          <PrivateRoute>
            <AdminProducerGate>
              <Liquidaciones />
            </AdminProducerGate>
          </PrivateRoute>
        }
      />
      <Route
        path="/reliquidaciones"
        element={
          <PrivateRoute>
            <AdminProducerGate>
              <Reliquidaciones />
            </AdminProducerGate>
          </PrivateRoute>
        }
      />
      <Route
        path="/visitas"
        element={
          <PrivateRoute>
            <AdminProducerGate>
              <Visitas />
            </AdminProducerGate>
          </PrivateRoute>
        }
      />
      <Route
        path="/comunicados"
        element={
          <PrivateRoute>
            <Comunicados />
          </PrivateRoute>
        }
      />
      <Route
        path="/comparativa"
        element={
          <PrivateRoute>
            <RequireAdmin>
              <PanelComparativo />
            </RequireAdmin>
          </PrivateRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
