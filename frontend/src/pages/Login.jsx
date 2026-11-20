import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AlertCircle, Dumbbell, Eye, EyeOff, Lock, LogIn, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { getErrorMessage } from '../services/api';
import { EMAIL_RE } from '../utils/format';
import { PageLoader, Spinner } from '../components/Feedback.jsx';

export default function Login() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <PageLoader label="Checking your session..." />;
  if (user) return <Navigate to={user.role === 'member' ? '/account' : '/admin/dashboard'} replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const found = {};
    if (!email.trim()) found.email = 'Email is required';
    else if (!EMAIL_RE.test(email.trim())) found.email = 'Enter a valid email address';
    if (!password) found.password = 'Password is required';
    setErrors(found);
    setServerError('');
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate('/admin/dashboard', { replace: true });
    } catch (err) {
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
        <span className="login-kicker">MEMBERSHIP MANAGEMENT PLATFORM</span>
        <h1>Run your gym with confidence.</h1>
        <p>Bring your members, membership plans and payments together in one secure, easy-to-use workspace.</p>
        <div className="login-assurance"><span><ShieldCheck size={17} /></span><div><strong>Administrator access</strong><small>Your gym operations, organised in one place.</small></div></div>
      </section>

      <section className="login-panel">
        <form className="login-card" onSubmit={handleSubmit} noValidate>
          <Link className="login-back-home" to="/">← Back to home</Link>
          <h2>Welcome back</h2>
          <p className="muted">Sign in with your administrator account to access the ForgeFit portal.</p>

          {serverError && (
            <div className="alert alert-error" role="alert">
              <AlertCircle size={18} /> {serverError}
            </div>
          )}

          <div className={`field${errors.email ? ' has-error' : ''}`}>
            <label htmlFor="login-email">Email</label>
            <div className="input-icon">
              <Mail size={18} />
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrors((er) => ({ ...er, email: undefined })); }}
              />
            </div>
            {errors.email && <span className="field-error">{errors.email}</span>}
          </div>

          <div className={`field${errors.password ? ' has-error' : ''}`}>
            <label htmlFor="login-password">Password</label>
            <div className="input-icon">
              <Lock size={18} />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Your password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErrors((er) => ({ ...er, password: undefined })); }}
              />
              <button
                type="button"
                className="icon-btn input-toggle"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <span className="field-error">{errors.password}</span>}
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? <Spinner small /> : <LogIn size={18} />} Sign in
          </button>
        </form>
      </section>
    </div>
  );
}
