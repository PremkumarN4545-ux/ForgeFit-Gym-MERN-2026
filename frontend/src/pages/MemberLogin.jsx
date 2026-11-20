import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Dumbbell, Eye, EyeOff, Lock, LogIn, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { getErrorMessage } from '../services/api';
import { EMAIL_RE } from '../utils/format';
import { PageLoader, Spinner } from '../components/Feedback.jsx';

export default function MemberLogin() {
  const { user, loading, loginMember } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [resetInfo, setResetInfo] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <PageLoader label="Checking your session..." />;
  if (user) return <Navigate to={user.role === 'admin' ? '/admin/dashboard' : '/account'} replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const found = {};
    if (!email.trim()) found.email = 'Email is required';
    else if (!EMAIL_RE.test(email.trim())) found.email = 'Enter a valid email address';
    if (!password) found.password = 'Password is required';
    setErrors(found);
    setServerError('');
    setResetInfo(false);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      const account = await loginMember(email.trim(), password);
      navigate(account.role === 'admin' ? '/admin/dashboard' : '/account', { replace: true });
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
        <span className="login-kicker">FORGEFIT ACCESS</span>
        <h1>Your fitness journey, all in one place.</h1>
        <p>Sign in with a member or administrator account to access the correct ForgeFit portal.</p>
        <div className="login-assurance"><span><ShieldCheck size={17} /></span><div><strong>Secure account access</strong><small>Members and administrators are sent to their own dashboard.</small></div></div>
      </section>

      <section className="login-panel">
        <form className="login-card" onSubmit={handleSubmit} noValidate>
          <Link className="login-back-home" to="/">← Back to home</Link>
          <h2>ForgeFit sign in</h2>
          <p className="muted">Use your member or administrator account.</p>

          {location.state?.success && (
            <div className="alert alert-success" role="status">{location.state.success}</div>
          )}
          {serverError && (
            <div className="alert alert-error" role="alert">
              <AlertCircle size={18} /> {serverError}
            </div>
          )}

          <div className={`field${errors.email ? ' has-error' : ''}`}>
            <label htmlFor="member-login-email">Email Address</label>
            <div className="input-icon">
              <Mail size={18} />
              <input
                id="member-login-email"
                type="email"
                autoComplete="username"
                placeholder="you@example.com"
                value={email}
                aria-invalid={Boolean(errors.email)}
                onChange={(e) => { setEmail(e.target.value); setErrors((er) => ({ ...er, email: undefined })); }}
              />
            </div>
            {errors.email && <span className="field-error">{errors.email}</span>}
          </div>

          <div className={`field${errors.password ? ' has-error' : ''}`}>
            <label htmlFor="member-login-password">Password</label>
            <div className="input-icon">
              <Lock size={18} />
              <input
                id="member-login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Your password"
                value={password}
                aria-invalid={Boolean(errors.password)}
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

          <button type="button" className="member-forgot-link" onClick={() => setResetInfo(true)}>
            Forgot Password?
          </button>
          {resetInfo && (
            <p className="member-reset-info" role="status">
              Please contact your gym administrator to reset your member password.
            </p>
          )}

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? <Spinner small /> : <LogIn size={18} />} Sign In
          </button>
          <p className="member-auth-switch">New to ForgeFit? <Link to="/register">Create Account</Link></p>
        </form>
      </section>
    </div>
  );
}
