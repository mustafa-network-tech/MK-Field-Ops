import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { I18nProvider } from './i18n/I18nContext';
import { AppProvider, useApp } from './context/AppContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { JobEntry } from './pages/JobEntry';
import { MyJobs } from './pages/MyJobs';
import { Management } from './pages/Management';
import { TeamDetail } from './pages/TeamDetail';
import { Approvals } from './pages/Approvals';
import { Reports } from './pages/Reports';
import { DeliveryNotes } from './pages/DeliveryNotes';
import { Settings } from './pages/Settings';
import { PayrollPeriods } from './pages/PayrollPeriods';
import { AuditLogs } from './pages/AuditLogs';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useApp();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user } = useApp();
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
      <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="jobs" element={<JobEntry />} />
        <Route path="my-jobs" element={<MyJobs />} />
        <Route path="management" element={<Management />} />
        <Route path="management/*" element={<Management />} />
        <Route path="team/:teamId" element={<TeamDetail />} />
        <Route path="approvals" element={<Approvals />} />
        <Route path="reports" element={<Reports />} />
        <Route path="delivery-notes" element={<DeliveryNotes />} />
        <Route path="settings" element={<Settings />} />
        <Route path="payroll" element={<PayrollPeriods />} />
        <Route path="audit-logs" element={<AuditLogs />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AppProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AppProvider>
    </I18nProvider>
  );
}
