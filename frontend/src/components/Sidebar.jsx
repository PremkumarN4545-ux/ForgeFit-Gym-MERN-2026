import { NavLink, useNavigate } from 'react-router-dom';
import { Dumbbell, LayoutDashboard, Layers, LogOut, Receipt, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const LINKS = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/members', label: 'Members', icon: Users },
  { to: '/plans', label: 'Membership Plans', icon: Layers },
  { to: '/payments', label: 'Payments', icon: Receipt },
];

export default function Sidebar({ open, onClose }) {
  const { logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.info('You have been signed out.');
    navigate('/admin/login', { replace: true });
  };

  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="brand">
          <span className="brand-mark">
            <Dumbbell size={20} />
          </span>
          <span className="brand-name">ForgeFit</span>
        </div>
        <nav className="nav">
          {LINKS.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} onClick={onClose}>
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <button type="button" className="nav-link nav-logout" onClick={handleLogout}>
          <LogOut size={19} />
          <span>Logout</span>
        </button>
      </aside>
    </>
  );
}
