import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AppLayout from './components/AppLayout.jsx';
import Login from './pages/Login.jsx';
import MemberLogin from './pages/MemberLogin.jsx';
import Register from './pages/Register.jsx';
import MemberAccount from './pages/MemberAccount.jsx';
import Home from './pages/Home.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Members from './pages/Members.jsx';
import AddMember from './pages/AddMember.jsx';
import EditMember from './pages/EditMember.jsx';
import MemberDetails from './pages/MemberDetails.jsx';
import Plans from './pages/Plans.jsx';
import Payments from './pages/Payments.jsx';
import NotFound from './pages/NotFound.jsx';
import MemberRoute from './components/MemberRoute.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/admin/login" element={<Login />} />
      <Route path="/login" element={<Navigate to="/admin/login" replace />} />
      <Route path="/member-login" element={<MemberLogin />} />
      <Route path="/register" element={<Register />} />
      <Route element={<MemberRoute />}>
        <Route path="/account" element={<MemberAccount />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/dashboard" element={<Dashboard />} />
          <Route path="/dashboard" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/members" element={<Members />} />
          <Route path="/members/new" element={<AddMember />} />
          <Route path="/members/:id" element={<MemberDetails />} />
          <Route path="/members/:id/edit" element={<EditMember />} />
          <Route path="/plans" element={<Plans />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}
