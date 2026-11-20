import { Inbox } from 'lucide-react';

export function Spinner({ small = false }) {
  return <span className={`spinner${small ? ' spinner-sm' : ''}`} role="status" aria-label="Loading" />;
}

export function PageLoader({ label = 'Loading...' }) {
  return (
    <div className="page-loader">
      <Spinner />
      <p>{label}</p>
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, text, action }) {
  return (
    <div className="empty-state">
      <Icon size={40} />
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="empty-state">
      <h3>Something went wrong</h3>
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function StatusBadge({ status }) {
  return <span className={`badge badge-${String(status || '').toLowerCase()}`}>{status}</span>;
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}
