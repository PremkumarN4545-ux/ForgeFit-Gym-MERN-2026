import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { PageLoader } from './Feedback.jsx';

/** Renders child routes only for a signed-in admin. */
export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader label="Checking your session..." />;
  if (!user) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  if (user.role !== 'admin') return <Navigate to="/account" replace />;
  return <Outlet />;
}
