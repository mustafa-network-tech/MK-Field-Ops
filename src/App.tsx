import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { I18nProvider } from './i18n/I18nContext';
import { AppProvider, useApp } from './context/AppContext';
import { Layout } from './components/Layout';

const Landing = lazy(() => import('./pages/Landing').then((m) => ({ default: m.Landing })));
const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })));
const Register = lazy(() => import('./pages/Register').then((m) => ({ default: m.Register })));
const Workspace = lazy(() => import('./pages/Workspace').then((m) => ({ default: m.Workspace })));
const PendingJoin = lazy(() => import('./pages/PendingJoin').then((m) => ({ default: m.PendingJoin })));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword').then((m) => ({ default: m.ForgotPassword })));
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const JobEntry = lazy(() => import('./pages/JobEntry').then((m) => ({ default: m.JobEntry })));
const MyJobs = lazy(() => import('./pages/MyJobs').then((m) => ({ default: m.MyJobs })));
const Management = lazy(() => import('./pages/Management').then((m) => ({ default: m.Management })));
const TeamDetail = lazy(() => import('./pages/TeamDetail').then((m) => ({ default: m.TeamDetail })));
const Approvals = lazy(() => import('./pages/Approvals').then((m) => ({ default: m.Approvals })));
const Reports = lazy(() => import('./pages/Reports').then((m) => ({ default: m.Reports })));
const DeliveryNotes = lazy(() => import('./pages/DeliveryNotes').then((m) => ({ default: m.DeliveryNotes })));
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));
const PayrollPeriods = lazy(() => import('./pages/PayrollPeriods').then((m) => ({ default: m.PayrollPeriods })));
const AuditLogs = lazy(() => import('./pages/AuditLogs').then((m) => ({ default: m.AuditLogs })));
const PlanChange = lazy(() => import('./pages/PlanChange').then((m) => ({ default: m.PlanChange })));
const UserGuide = lazy(() => import('./pages/UserGuide').then((m) => ({ default: m.UserGuide })));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy').then((m) => ({ default: m.PrivacyPolicy })));
const RefundPolicy = lazy(() => import('./pages/RefundPolicy').then((m) => ({ default: m.RefundPolicy })));
const TermsOfUse = lazy(() => import('./pages/TermsOfUse').then((m) => ({ default: m.TermsOfUse })));
const SuperAdmin = lazy(() => import('./pages/SuperAdmin').then((m) => ({ default: m.SuperAdmin })));

function PageFallback() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh', color: '#94a3b8' }}>
      Loading…
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useApp();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'superAdmin') return <Navigate to="/super-admin" replace />;
  if (!user.companyId) return <Navigate to="/pending-join" replace />;
  return <>{children}</>;
}

function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useApp();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'superAdmin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function PendingJoinRoute() {
  const { user } = useApp();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'superAdmin') return <Navigate to="/super-admin" replace />;
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
      <Route path="/pricing" element={<Landing />} />
      <Route path="/plan-and-payment" element={<PlanChange />} />
      <Route path="/pending-join" element={<PendingJoinRoute />} />
      <Route path="/super-admin" element={<SuperAdminRoute><SuperAdmin /></SuperAdminRoute>} />
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
        <Route path="plan" element={<Navigate to="/plan-and-payment" replace />} />
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
          <Suspense fallback={<PageFallback />}>
            <AppRoutes />
          </Suspense>
        </BrowserRouter>
      </AppProvider>
    </I18nProvider>
  );
}
