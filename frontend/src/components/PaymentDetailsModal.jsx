import { Link } from 'react-router-dom';
import Modal from './Modal.jsx';
import { StatusBadge } from './Feedback.jsx';
import { formatCurrency, formatDate, paymentDetailRows } from '../utils/format';

export default function PaymentDetailsModal({ payment, onClose }) {
  const rows = [
    ['Payment ID', payment.paymentId],
    ['Member', payment.member ? <Link to={`/members/${payment.member}`} onClick={onClose}>{payment.memberName} ({payment.memberCode})</Link> : payment.memberName],
    ['Membership plan', payment.planName],
    ['Amount', formatCurrency(payment.amount)],
    ['Payment date', formatDate(payment.paymentDate)],
    ['Payment method', payment.method],
    ...paymentDetailRows(payment).map(([k, v]) => [k, v || '-']),
    ['Source', payment.source === 'Member' ? 'Submitted by member' : 'Recorded by admin'],
    ['Transaction reference', payment.transactionRef || '-'],
    ['Status', <StatusBadge key="s" status={payment.status} />],
    ['Notes', payment.notes || '-'],
    ['Recorded on', formatDate(payment.createdAt)],
  ];
  return (
    <Modal title="Payment details" onClose={onClose}>
      <dl className="detail-list">
        {rows.map(([k, v]) => (
          <div key={k} className="detail-row">
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="form-actions">
        <button type="button" className="btn btn-primary" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}
