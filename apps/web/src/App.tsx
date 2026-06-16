import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import LoginPage from './pages/login';
import AdminDashboardPage  from './pages/admin/index';
import AdminIncidentsPage  from './pages/admin/incidents';
import AdminMapPage        from './pages/admin/map';
import AdminAnalyticsPage  from './pages/admin/analytics';
import AdminBroadcastPage  from './pages/admin/broadcast';
import AdminDriversPage    from './pages/admin/drivers';
import AdminEventsPage     from './pages/admin/events';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/"       element={<Navigate to="/admin" replace />} />
      <Route path="/login"  element={<LoginPage />} />
      <Route path="/admin" element={<ProtectedRoute><AdminDashboardPage /></ProtectedRoute>} />
      <Route path="/admin/incidents" element={<ProtectedRoute><AdminIncidentsPage /></ProtectedRoute>} />
      <Route path="/admin/map"       element={<ProtectedRoute><AdminMapPage /></ProtectedRoute>} />
      <Route path="/admin/analytics" element={<ProtectedRoute><AdminAnalyticsPage /></ProtectedRoute>} />
      <Route path="/admin/broadcast" element={<ProtectedRoute><AdminBroadcastPage /></ProtectedRoute>} />
      <Route path="/admin/drivers"   element={<ProtectedRoute><AdminDriversPage /></ProtectedRoute>} />
      <Route path="/admin/events"    element={<ProtectedRoute><AdminEventsPage /></ProtectedRoute>} />
      <Route path="*"       element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  );
}
