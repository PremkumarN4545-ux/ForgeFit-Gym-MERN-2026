import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Copy, CreditCard, KeyRound, Pencil, Trash2, UserCheck, UserX } from 'lucide-react';
import * as memberService from '../services/memberService';
import { getErrorMessage } from '../services/api';
import { useToast } from '../context/ToastContext.jsx';
import Modal, { ConfirmDialog } from '../components/Modal.jsx';
import { EmptyState, ErrorState, PageHeader, PageLoader, StatusBadge } from '../components/Feedback.jsx';
import { daysUntil, durationLabel, formatCurrency, formatDate, paymentDetailsSummary } from '../utils/format';

export default function MemberDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [member, setMember] = useState(null);
  const [payments, setPayments] = useState(null);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingPasswordReset, setConfirmingPasswordReset] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [temporaryCredentials, setTemporaryCredentials] = useState(null);
  const [updatingAccountStatus, setUpdatingAccountStatus] = useState(false);

  useEffect(() => {
    let ignore = false;
    setMember(null);
    Promise.all([memberService.getMember(id), memberService.getMemberPayments(id)])
      .then(([m, p]) => {
        if (ignore) return;
        setMember(m);
        setPayments(p);
      })
      .catch((err) => !ignore && setError(getErrorMessage(err)));
    return () => {
      ignore = true;
    };
  }, [id]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await memberService.deleteMember(id);
      toast.success(`${member.fullName} was deleted.`);
      navigate('/members', { replace: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
      setDeleting(false);
    }
  };

  const handleResetPassword = async () => {
    setResettingPassword(true);
    try {
      const result = await memberService.resetMemberPassword(id);
      setTemporaryCredentials(result);
      setConfirmingPasswordReset(false);
      toast.success(`Temporary password created for ${result.member.memberId}.`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setResettingPassword(false);
    }
  };

  const handleAccountStatus = async () => {
    const accountStatus = member.loginInfo?.enabled ? 'Inactive' : 'Active';
    setUpdatingAccountStatus(true);
    try {
      const result = await memberService.setMemberAccountStatus(id, accountStatus);
      setMember((current) => ({
        ...current,
        status: result.member.status,
        loginInfo: { ...current.loginInfo, enabled: result.loginEnabled },
      }));
      toast.success(result.loginEnabled ? 'Member login enabled.' : 'Member login disabled.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUpdatingAccountStatus(false);
    }
  };

  const copyTemporaryPassword = async () => {
    try {
      await navigator.clipboard.writeText(temporaryCredentials.temporaryPassword);
      toast.success('Temporary password copied.');
    } catch {
      toast.error('Could not copy the password. Select and copy it manually.');
    }
  };

  if (error) return <ErrorState message={error} onRetry={() => navigate('/members')} />;
  if (!member || !payments) return <PageLoader label="Loading member..." />;

  const days = daysUntil(member.expiryDate);
  const remaining =
    member.status === 'Inactive' ? 'Suspended' : days < 0 ? `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago` : days === 0 ? 'Expires today' : `${days} day${days === 1 ? '' : 's'} left`;

  const info = [
    ['Member ID', member.memberId],
    ['Email', member.email],
    ['Phone', member.phone],
    ['Gender', member.gender],
    ['Date of birth', `${formatDate(member.dateOfBirth)} (${member.age} yrs)`],
    ['Address', member.address],
    ['Joining date', formatDate(member.joiningDate)],
    ['Login credentials', member.loginInfo?.credentialState || 'Not checked'],
    ['Login access', member.loginInfo?.enabled ? 'Enabled' : 'Disabled'],
  ];
  const membership = [
    ['Plan', member.plan ? `${member.plan.name} (${durationLabel(member.plan.durationMonths)})` : '-'],
    ['Start date', formatDate(member.startDate)],
    ['Expiry date', formatDate(member.expiryDate)],
    ['Time remaining', remaining],
    ['Status', <StatusBadge key="s" status={member.status} />],
  ];

  return (
    <>
      <PageHeader
        title={member.fullName}
        subtitle={`Member ${member.memberId}`}
        actions={
          <>
            <Link to="/members" className="btn btn-ghost"><ArrowLeft size={16} /> Back</Link>
            <Link to={`/payments?record=${member._id}`} className="btn btn-secondary"><CreditCard size={16} /> Record payment</Link>
            <Link to={`/members/${member._id}/edit`} className="btn btn-primary"><Pencil size={16} /> Edit</Link>
            <button type="button" className="btn btn-secondary" onClick={() => setConfirmingPasswordReset(true)} disabled={resettingPassword}>
              <KeyRound size={16} /> RESET MEMBER PASSWORD
            </button>
            <button type="button" className={member.loginInfo?.enabled ? 'btn btn-ghost' : 'btn btn-secondary'} onClick={handleAccountStatus} disabled={updatingAccountStatus}>
              {member.loginInfo?.enabled ? <UserX size={16} /> : <UserCheck size={16} />}
              {member.loginInfo?.enabled ? 'Disable login' : 'Enable login'}
            </button>
            <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)}><Trash2 size={16} /> Delete</button>
          </>
        }
      />

      <div className="grid-2">
        <section className="card">
          <h3 className="card-title">Personal information</h3>
          <dl className="detail-list">
            {info.map(([k, v]) => <div key={k} className="detail-row"><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
        </section>
        <section className="card">
          <h3 className="card-title">Membership</h3>
          <dl className="detail-list">
            {membership.map(([k, v]) => <div key={k} className="detail-row"><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
        </section>
      </div>

      <section className="card">
        <div className="card-title-row">
          <h3 className="card-title">Payment history</h3>
          <span className="muted">Total paid: <strong>{formatCurrency(payments.totalPaid)}</strong></span>
        </div>
        {payments.data.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Payment ID</th><th>Plan</th><th>Amount</th><th>Date</th><th>Method</th><th>Reference</th><th>Status</th></tr></thead>
              <tbody>
                {payments.data.map((p) => (
                  <tr key={p._id}>
                    <td>{p.paymentId}</td>
                    <td>{p.planName}</td>
                    <td>{formatCurrency(p.amount)}</td>
                    <td>{formatDate(p.paymentDate)}</td>
                    <td>{p.method}{paymentDetailsSummary(p) && <div className="muted small">{paymentDetailsSummary(p)}</div>}</td>
                    <td>{p.transactionRef || '-'}</td>
                    <td><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No payments recorded" text="Record this member's first payment." action={<Link to={`/payments?record=${member._id}`} className="btn btn-primary">Record payment</Link>} />
        )}
        {confirmingPasswordReset && (
          <ConfirmDialog
            title="Reset member password"
            message={`Generate a one-time development password for ${member.fullName} (${member.email})? Any existing password for this linked member login will stop working.`}
            confirmLabel="Reset password"
            loading={resettingPassword}
            onConfirm={handleResetPassword}
            onCancel={() => setConfirmingPasswordReset(false)}
          />
        )}
        {temporaryCredentials && (
          <Modal title="Temporary member password" onClose={() => setTemporaryCredentials(null)}>
            <p className="info-note">Copy this password now. It is shown only once and is not stored in plain text.</p>
            <dl className="detail-list">
              <div className="detail-row"><dt>Member</dt><dd>{temporaryCredentials.member.fullName} ({temporaryCredentials.member.memberId})</dd></div>
              <div className="detail-row"><dt>Login email</dt><dd>{temporaryCredentials.member.email}</dd></div>
              <div className="detail-row"><dt>Linked existing account</dt><dd>{temporaryCredentials.linkedRegisteredAccount ? 'Yes' : 'No; using the existing Member record'}</dd></div>
            </dl>
            <div className="field">
              <label htmlFor="temporary-member-password">Temporary password</label>
              <input id="temporary-member-password" type="text" readOnly value={temporaryCredentials.temporaryPassword} />
            </div>
            <p className="field-hint">Use this email and password on the existing member login page. An admin can issue a new temporary password if needed.</p>
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={copyTemporaryPassword}><Copy size={16} /> Copy password</button>
              <button type="button" className="btn btn-primary" onClick={() => setTemporaryCredentials(null)}>Done</button>
            </div>
          </Modal>
        )}
      </section>

      {confirming && (
        <ConfirmDialog
          title="Delete member"
          message={`Delete ${member.fullName} (${member.memberId})? This cannot be undone. Their payment records are kept.`}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}
