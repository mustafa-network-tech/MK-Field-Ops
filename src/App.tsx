import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { I18nProvider } from './i18n/I18nContext';
import { AppProvider, useApp } from './context/AppContext';
import { Layout } from './components/Layout';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Workspace } from './pages/Workspace';
import { PendingJoin } from './pages/PendingJoin';
import { ForgotPassword } from './pages/ForgotPassword';
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
import { UserGuide } from './pages/UserGuide';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { RefundPolicy } from './pages/RefundPolicy';
import { TermsOfUse } from './pages/TermsOfUse';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useApp();
  if (!user) return <Navigate to="/login" replace />;
  if (!user.companyId) return <Navigate to="/pending-join" replace />;
  return <>{children}</>;
}

function PendingJoinRoute() {
  const { user } = useApp();
  if (!user) return <Navigate to="/login" replace />;
  if (user.companyId) return <Navigate to="/" replace />;
  return <PendingJoin />;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user } = useApp();
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RootRoute() {
  const { user } = useApp();
  if (!user) return <Landing />;
  return <Outlet />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
      <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
      <Route path="/workspace" element={<PublicOnlyRoute><Workspace /></PublicOnlyRoute>} />
      <Route path="/pending-join" element={<PendingJoinRoute />} />
      <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPassword /></PublicOnlyRoute>} />
      <Route path="/kullanim-kilavuzu" element={<UserGuide />} />
      <Route path="/gizlilik-politikasi" element={<PrivacyPolicy />} />
      <Route path="/kullanim-sartlari" element={<TermsOfUse />} />
      <Route path="/geri-odeme-politikasi" element={<RefundPolicy />} />
      <Route path="/" element={<RootRoute />}>
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
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
