import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AlertCircle, Dumbbell, Lock, Mail, Phone, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { getErrorMessage, getFieldErrors } from '../services/api';
import { EMAIL_RE, PHONE_RE } from '../utils/format';
import { PageLoader, Spinner } from '../components/Feedback.jsx';

export default function Register() {
  const { user, loading, registerMember } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <PageLoader label="Checking your session..." />;
  if (user) return <Navigate to={user.role === 'admin' ? '/admin/dashboard' : '/account'} replace />;

  const update = (field) => (e) => {
    setForm((current) => ({ ...current, [field]: e.target.value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const found = {};
    const fullName = form.fullName.trim();
    const email = form.email.trim();

    if (fullName.length < 2 || fullName.length > 100) found.fullName = 'Enter your full name (2-100 characters)';
    if (!email) found.email = 'Email is required';
    else if (!EMAIL_RE.test(email)) found.email = 'Enter a valid email address';
    const phone = form.phone.trim();
    if (!PHONE_RE.test(phone) || phone.replace(/\D/g, '').length < 7) found.phone = 'Enter a valid phone number';
    if (form.password.length < 8 || form.password.length > 128) {
      found.password = 'Password must be 8-128 characters';
    } else if (!/[a-z]/.test(form.password) || !/[A-Z]/.test(form.password) || !/\d/.test(form.password)) {
      found.password = 'Password must include uppercase and lowercase letters and a number';
    }
    if (!form.confirmPassword) found.confirmPassword = 'Please confirm your password';
    else if (form.confirmPassword !== form.password) found.confirmPassword = 'Passwords do not match';

    setErrors(found);
    setServerError('');
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      const result = await registerMember({ fullName, email, phone, password: form.password });
      navigate('/member-login', {
        replace: true,
        state: { email, success: result.message || 'Account created. You can now sign in.' },
      });
    } catch (err) {
      setErrors((current) => ({ ...current, ...getFieldErrors(err) }));
      setServerError(getErrorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <section className="login-brand">
        <div className="brand">
          <span className="brand-mark"><Dumbbell size={22} /></span>
          <span className="brand-name">ForgeFit</span>
        </div>
        <span className="login-kicker">MEMBER REGISTRATION</span>
        <h1>Welcome to your next strong start.</h1>
        <p>Create your ForgeFit member account to continue.</p>
      </section>

      <section className="login-panel">
        <form className="login-card register-card" onSubmit={handleSubmit} noValidate>
          <Link className="login-back-home" to="/">← Back to home</Link>
          <h2>Create Account</h2>
          <p className="muted">Create an account to access your ForgeFit member portal.</p>

          {serverError && (
            <div className="alert alert-error" role="alert">
              <AlertCircle size={18} /> {serverError}
            </div>
          )}

          <div className={`field${errors.fullName ? ' has-error' : ''}`}>
            <label htmlFor="register-name">Full Name</label>
            <div className="input-icon">
              <UserRound size={18} />
              <input id="register-name" type="text" autoComplete="name" maxLength="100" placeholder="Your full name" value={form.fullName} aria-invalid={Boolean(errors.fullName)} onChange={update('fullName')} />
            </div>
            {errors.fullName && <span className="field-error">{errors.fullName}</span>}
          </div>

          <div className={`field${errors.email ? ' has-error' : ''}`}>
            <label htmlFor="register-email">Email Address</label>
            <div className="input-icon">
              <Mail size={18} />
              <input id="register-email" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} aria-invalid={Boolean(errors.email)} onChange={update('email')} />
            </div>
            {errors.email && <span className="field-error">{errors.email}</span>}
          </div>

          <div className={`field${errors.phone ? ' has-error' : ''}`}>
            <label htmlFor="register-phone">Phone Number</label>
            <div className="input-icon">
              <Phone size={18} />
              <input id="register-phone" type="tel" autoComplete="tel" maxLength="20" placeholder="Your phone number" value={form.phone} aria-invalid={Boolean(errors.phone)} onChange={update('phone')} />
            </div>
            {errors.phone && <span className="field-error">{errors.phone}</span>}
          </div>

          <div className={`field${errors.password ? ' has-error' : ''}`}>
            <label htmlFor="register-password">Password</label>
            <div className="input-icon">
              <Lock size={18} />
              <input id="register-password" type="password" autoComplete="new-password" maxLength="128" placeholder="At least 8 characters" value={form.password} aria-invalid={Boolean(errors.password)} onChange={update('password')} />
            </div>
            {errors.password && <span className="field-error">{errors.password}</span>}
          </div>

          <div className={`field${errors.confirmPassword ? ' has-error' : ''}`}>
            <label htmlFor="register-confirm-password">Confirm Password</label>
            <div className="input-icon">
              <Lock size={18} />
              <input id="register-confirm-password" type="password" autoComplete="new-password" maxLength="128" placeholder="Re-enter your password" value={form.confirmPassword} aria-invalid={Boolean(errors.confirmPassword)} onChange={update('confirmPassword')} />
            </div>
            {errors.confirmPassword && <span className="field-error">{errors.confirmPassword}</span>}
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? <Spinner small /> : null} Create Account
          </button>
          <p className="member-auth-switch">Already registered? <Link to="/member-login">Sign In</Link></p>
        </form>
      </section>
    </div>
  );
}
