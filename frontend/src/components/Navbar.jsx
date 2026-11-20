import { useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const TITLES = [
  ['/admin/dashboard', 'Dashboard'],
  ['/dashboard', 'Dashboard'],
  ['/members', 'Members'],
  ['/plans', 'Membership Plans'],
  ['/payments', 'Payments'],
];

export default function Navbar({ onMenu }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const title = TITLES.find(([p]) => pathname.startsWith(p))?.[1] || 'ForgeFit';
  const initials = (user?.name || 'A')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="navbar">
      <button type="button" className="icon-btn menu-btn" onClick={onMenu} aria-label="Open menu">
        <Menu size={22} />
      </button>
      <h2 className="navbar-title">{title}</h2>
      <div className="navbar-user">
        <div className="navbar-user-text">
          <strong>{user?.name}</strong>
          <span>{user?.email}</span>
        </div>
        <div className="avatar">{initials}</div>
      </div>
    </header>
  );
}
