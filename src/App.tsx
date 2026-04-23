/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Leads from './pages/Leads';
import LeadDetails from './pages/LeadDetails';
import Users from './pages/Users';
import Settings from './pages/Settings';
import Reports from './pages/Reports';
import FollowUps from './pages/FollowUps';
import CampaignSources from './pages/CampaignSources';
import TelecallerDashboard from './pages/TelecallerDashboard';
import { RoleProvider, useRole } from './contexts/RoleContext';
import { Toaster } from '@/components/ui/sonner';

// ── Guard: redirect to /login if not authenticated ───────────────────────────
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useRole();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// ── Guard: redirect admin away from /login ───────────────────────────────────
function PublicRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isTelecaller } = useRole();
  if (isAuthenticated) {
    return <Navigate to={isTelecaller ? '/my-dashboard' : '/dashboard'} replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  const { isTelecaller, isAdmin } = useRole();

  return (
    <Routes>
      {/* Public: Login */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />

      {/* Protected: CRM dashboard */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        {/* Root → role-based home */}
        <Route
          index
          element={<Navigate to={isTelecaller ? '/my-dashboard' : '/dashboard'} replace />}
        />

        {/* Admin / Manager routes */}
        <Route path="dashboard"    element={isAdmin    ? <Dashboard />           : <Navigate to="/my-dashboard" replace />} />
        <Route path="users"        element={isAdmin    ? <Users />               : <Navigate to="/my-dashboard" replace />} />
        <Route path="campaigns"    element={isAdmin    ? <CampaignSources />     : <Navigate to="/my-dashboard" replace />} />
        <Route path="reports"      element={isAdmin    ? <Reports />             : <Navigate to="/my-dashboard" replace />} />

        {/* Telecaller route */}
        <Route path="my-dashboard" element={isTelecaller ? <TelecallerDashboard /> : <Navigate to="/dashboard" replace />} />

        {/* Shared routes */}
        <Route path="leads"        element={<Leads />} />
        <Route path="leads/:id"    element={<LeadDetails />} />
        <Route path="follow-ups"   element={<FollowUps />} />
        <Route path="settings"     element={<Settings />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to={isTelecaller ? '/my-dashboard' : '/dashboard'} replace />} />
      </Route>

      {/* Absolute catch-all */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <RoleProvider>
      <Router>
        <AppRoutes />
        <Toaster position="top-right" />
      </Router>
    </RoleProvider>
  );
}
