import { useEffect } from 'react';
import { X } from 'lucide-react';
import { Spinner } from './Feedback.jsx';

export default function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

/** Confirmation prompt used before every destructive action. */
export function ConfirmDialog({ title, message, confirmLabel = 'Delete', loading = false, onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={loading ? () => {} : onCancel}>
      <p className="confirm-text">{message}</p>
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={loading}>
          Cancel
        </button>
        <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={loading}>
          {loading && <Spinner small />} {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
