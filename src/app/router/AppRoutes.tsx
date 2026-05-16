import React, { lazy } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useApp } from '@/app/providers/AppContext';
import { Layout } from '@/app/layouts/Layout';

const Landing = lazy(() => import('@/features/landing/pages/Landing').then((m) => ({ default: m.Landing })));
const Login = lazy(() => import('@/features/auth/pages/Login').then((m) => ({ default: m.Login })));
const Register = lazy(() => import('@/features/auth/pages/Register').then((m) => ({ default: m.Register })));
const Workspace = lazy(() => import('@/features/auth/pages/Workspace').then((m) => ({ default: m.Workspace })));
const PendingJoin = lazy(() => import('@/features/auth/pages/PendingJoin').then((m) => ({ default: m.PendingJoin })));
const ForgotPassword = lazy(() => import('@/features/auth/pages/ForgotPassword').then((m) => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => import('@/features/auth/pages/ResetPassword').then((m) => ({ default: m.ResetPassword })));
const Dashboard = lazy(() => import('@/features/dashboard/pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const JobEntry = lazy(() => import('@/features/jobs/pages/JobEntry').then((m) => ({ default: m.JobEntry })));
const MyJobs = lazy(() => import('@/features/jobs/pages/MyJobs').then((m) => ({ default: m.MyJobs })));
const Management = lazy(() => import('@/features/companies/pages/Management').then((m) => ({ default: m.Management })));
const TeamDetail = lazy(() => import('@/features/teams/pages/TeamDetail').then((m) => ({ default: m.TeamDetail })));
const Approvals = lazy(() => import('@/features/approvals/pages/Approvals').then((m) => ({ default: m.Approvals })));
const Reports = lazy(() => import('@/features/reports/pages/Reports').then((m) => ({ default: m.Reports })));
const DeliveryNotes = lazy(() => import('@/features/stock/pages/DeliveryNotes').then((m) => ({ default: m.DeliveryNotes })));
const Settings = lazy(() => import('@/features/settings/pages/Settings').then((m) => ({ default: m.Settings })));
const PayrollPeriods = lazy(() => import('@/features/settings/pages/PayrollPeriods').then((m) => ({ default: m.PayrollPeriods })));
const AuditLogs = lazy(() => import('@/features/settings/pages/AuditLogs').then((m) => ({ default: m.AuditLogs })));
const PlanChange = lazy(() => import('@/features/settings/pages/PlanChange').then((m) => ({ default: m.PlanChange })));
const UserGuide = lazy(() => import('@/features/legal/pages/UserGuide').then((m) => ({ default: m.UserGuide })));
const PrivacyPolicy = lazy(() => import('@/features/legal/pages/PrivacyPolicy').then((m) => ({ default: m.PrivacyPolicy })));
const RefundPolicy = lazy(() => import('@/features/legal/pages/RefundPolicy').then((m) => ({ default: m.RefundPolicy })));
const TermsOfUse = lazy(() => import('@/features/legal/pages/TermsOfUse').then((m) => ({ default: m.TermsOfUse })));
const SuperAdmin = lazy(() => import('@/features/settings/pages/SuperAdmin').then((m) => ({ default: m.SuperAdmin })));

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

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
      <Route path="/workspace" element={<PublicOnlyRoute><Workspace /></PublicOnlyRoute>} />
      <Route path="/pricing" element={<Landing />} />
      <Route path="/plan-and-payment" element={<PlanChange />} />
      <Route path="/pending-join" element={<PendingJoinRoute />} />
      <Route path="/super-admin" element={<SuperAdminRoute><SuperAdmin /></SuperAdminRoute>} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
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
