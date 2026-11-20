import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { PageLoader } from './Feedback.jsx';

export default function MemberRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader label="Checking your session..." />;
  if (!user) return <Navigate to="/member-login" replace state={{ from: location.pathname }} />;
  if (user.role !== 'member') return <Navigate to="/admin/dashboard" replace />;
  return <Outlet />;
}
