import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MainLayout from '../layouts/MainLayout';
import AuthLayout from '../layouts/AuthLayout';
import { PageLoader } from '../components/common/Loader';
import Home from '../pages/Home';
import Login from '../pages/Login';
import Register from '../pages/Register';
import NotFound from '../pages/NotFound';

const Dashboard = lazy(() => import('../pages/Dashboard'));
const Cases = lazy(() => import('../pages/Cases'));
const CaseNew = lazy(() => import('../pages/CaseNew'));
const CaseDetail = lazy(() => import('../pages/CaseDetail'));
const DocumentReview = lazy(() => import('../pages/DocumentReview'));
const Users = lazy(() => import('../pages/admin/Users'));
const DocumentTypes = lazy(() => import('../pages/admin/DocumentTypes'));
const AuditLogs = lazy(() => import('../pages/admin/AuditLogs'));

function RequireAuth({ children, roles }) {
  const { isAuthenticated, checking, user } = useAuth();
  const location = useLocation();
  if (checking) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) return <NotFound />;
  return children;
}

function GuestOnly({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children;
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route element={<GuestOnly><AuthLayout /></GuestOnly>}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>
        <Route element={<RequireAuth><MainLayout /></RequireAuth>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/cases" element={<Cases />} />
          <Route path="/cases/new" element={<RequireAuth roles={['submitter', 'admin']}><CaseNew /></RequireAuth>} />
          <Route path="/cases/:caseId" element={<CaseDetail />} />
          <Route path="/cases/:caseId/documents/:documentId" element={<DocumentReview />} />
          <Route path="/admin/users" element={<RequireAuth roles={['admin']}><Users /></RequireAuth>} />
          <Route path="/admin/document-types" element={<RequireAuth roles={['admin']}><DocumentTypes /></RequireAuth>} />
          <Route path="/admin/audit" element={<RequireAuth roles={['admin']}><AuditLogs /></RequireAuth>} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
