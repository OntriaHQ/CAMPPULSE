import { Link, Navigate, Route, Routes } from "react-router-dom";
import { REDEMPTION_CITY_CENTER } from "@camppulse/map-config";
import { ProtectedRoute } from "./components/shared/ProtectedRoute";
import AdminAnalyticsPage from "./pages/admin/analytics";
import AdminBroadcastPage from "./pages/admin/broadcast";
import AdminDriversPage from "./pages/admin/drivers";
import AdminIncidentsPage from "./pages/admin/incidents";
import AdminDashboardPage from "./pages/admin/index";
import AdminMapPage from "./pages/admin/map";
import LoginPage from "./pages/login";
import NavPage from "./pages/nav/index";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export default function App() {
  return (
    <>
      <nav style={{ padding: "1rem 2rem", borderBottom: "1px solid #e2e8f0" }}>
        <Link to="/nav">Guest Nav</Link>
        <Link to="/admin">Admin</Link>
        <Link to="/login">Login</Link>
        <span style={{ marginLeft: "1rem", color: "#64748b", fontSize: "0.875rem" }}>
          API: {apiUrl} · Center: {REDEMPTION_CITY_CENTER.lat}, {REDEMPTION_CITY_CENTER.lon}
        </span>
      </nav>
      <Routes>
        <Route path="/" element={<Navigate to="/nav" replace />} />
        <Route path="/nav" element={<NavPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/incidents"
          element={
            <ProtectedRoute>
              <AdminIncidentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/map"
          element={
            <ProtectedRoute>
              <AdminMapPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/analytics"
          element={
            <ProtectedRoute>
              <AdminAnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/drivers"
          element={
            <ProtectedRoute>
              <AdminDriversPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/broadcast"
          element={
            <ProtectedRoute>
              <AdminBroadcastPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  );
}
