import { Routes, Route, Navigate } from 'react-router-dom';
import { getToken } from './api';
import AdminProducerGate from './components/AdminProducerGate';
import Login from './pages/Login';
import Activate from './pages/Activate';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Resumen from './pages/Resumen';
import Composicion from './pages/Composicion';
import Remisiones from './pages/Remisiones';
import Liquidaciones from './pages/Liquidaciones';
import Reliquidaciones from './pages/Reliquidaciones';

function PrivateRoute({ children }) {
  return getToken() ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  return getToken() ? <Navigate to="/" replace /> : children;
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
