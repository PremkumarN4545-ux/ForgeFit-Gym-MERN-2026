import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Eye, KeyRound, Pencil, Plus, RefreshCw, Search, Trash2, UserCheck, UserX, Users, X } from 'lucide-react';
import * as memberService from '../services/memberService';
import * as planService from '../services/planService';
import { getErrorMessage } from '../services/api';
import { useToast } from '../context/ToastContext.jsx';
import useDebounce from '../hooks/useDebounce';
import Modal, { ConfirmDialog } from '../components/Modal.jsx';
import Pagination from '../components/Pagination.jsx';
import { EmptyState, ErrorState, PageHeader, PageLoader, StatusBadge } from '../components/Feedback.jsx';
import { formatDate } from '../utils/format';

export default function Members() {
  const toast = useToast();
  const [result, setResult] = useState(null);
  const [registeredResult, setRegisteredResult] = useState(null);
  const [plans, setPlans] = useState([]);
  const [error, setError] = useState('');
  const [registeredError, setRegisteredError] = useState('');
  const [loading, setLoading] = useState(true);
  const [registeredLoading, setRegisteredLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [plan, setPlan] = useState('');
  const [page, setPage] = useState(1);
  const [registeredPage, setRegisteredPage] = useState(1);
  const [selectedRegisteredUser, setSelectedRegisteredUser] = useState(null);
  const [loadingRegisteredUser, setLoadingRegisteredUser] = useState(false);
  const [resettingRegisteredPassword, setResettingRegisteredPassword] = useState(false);
  const [updatingRegisteredStatus, setUpdatingRegisteredStatus] = useState(false);
  const [registeredTemporaryCredentials, setRegisteredTemporaryCredentials] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const debouncedSearch = useDebounce(search);

  useEffect(() => {
    planService.listPlans().then(setPlans).catch(() => setPlans([]));
  }, []);

  // Any filter change returns to page 1.
  useEffect(() => {
    setPage(1);
    setRegisteredPage(1);
  }, [debouncedSearch, status, plan]);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    memberService
      .listMembers({ page, limit: 10, search: debouncedSearch || undefined, status: status || undefined, plan: plan || undefined })
      .then((res) => {
        if (ignore) return;
        setResult(res);
        setError('');
      })
      .catch((err) => !ignore && setError(getErrorMessage(err)))
      .finally(() => !ignore && setLoading(false));
    return () => {
      ignore = true;
    };
  }, [page, debouncedSearch, status, plan, reloadKey]);

  useEffect(() => {
    let ignore = false;
    setRegisteredLoading(true);
    memberService.listRegisteredUsers({
      page: registeredPage,
      limit: 10,
      search: debouncedSearch || undefined,
    })
      .then((res) => {
        if (ignore) return;
        setRegisteredResult(res);
        setRegisteredError('');
      })
      .catch((err) => !ignore && setRegisteredError(getErrorMessage(err)))
      .finally(() => !ignore && setRegisteredLoading(false));
    return () => { ignore = true; };
  }, [registeredPage, debouncedSearch, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const filtersActive = Boolean(search || status || plan);
  const clearFilters = () => { setSearch(''); setStatus(''); setPlan(''); };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await memberService.deleteMember(toDelete._id);
      toast.success(`${toDelete.fullName} was deleted.`);
      setToDelete(null);
      // If the last row of a later page was removed, step back a page.
      if (result.data.length === 1 && page > 1) setPage(page - 1);
      else reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const viewRegisteredUser = async (id) => {
    setLoadingRegisteredUser(true);
    try {
      setSelectedRegisteredUser(await memberService.getRegisteredUser(id));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoadingRegisteredUser(false);
    }
  };

  const resetSelectedRegisteredPassword = async () => {
    setResettingRegisteredPassword(true);
    try {
      const result = await memberService.resetRegisteredUserPassword(selectedRegisteredUser._id);
      setRegisteredTemporaryCredentials(result);
      toast.success(`Temporary password created for ${result.user.email}.`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setResettingRegisteredPassword(false);
    }
  };

  const toggleSelectedRegisteredStatus = async () => {
    const accountStatus = selectedRegisteredUser.accountStatus === 'Active' ? 'Inactive' : 'Active';
    setUpdatingRegisteredStatus(true);
    try {
      const result = await memberService.setRegisteredUserAccountStatus(selectedRegisteredUser._id, accountStatus);
      setSelectedRegisteredUser(result.user);
      reload();
      toast.success(`Registered account ${accountStatus.toLowerCase()}.`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUpdatingRegisteredStatus(false);
    }
  };

  const copyRegisteredTemporaryPassword = async () => {
    try {
      await navigator.clipboard.writeText(registeredTemporaryCredentials.temporaryPassword);
      toast.success('Temporary password copied.');
    } catch {
      toast.error('Could not copy the password. Select and copy it manually.');
    }
  };

  return (
    <>
      <PageHeader
        title="Members"
        subtitle="Manage gym members and review registered member accounts."
        actions={
          <>
            <button type="button" className="btn btn-ghost" onClick={reload} disabled={loading || registeredLoading}>
              <RefreshCw size={16} /> Refresh
            </button>
            <Link to="/members/new" className="btn btn-primary"><Plus size={16} /> Add member</Link>
          </>
        }
      />

      <section className="card">
        <div className="toolbar">
          <div className="search-input">
            <Search size={16} />
            <input placeholder="Search name, email, phone or ID" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
            <option value="">All statuses</option>
            <option>Active</option>
            <option>Expired</option>
            <option>Inactive</option>
          </select>
          <select value={plan} onChange={(e) => setPlan(e.target.value)} aria-label="Filter by plan">
            <option value="">All plans</option>
            {plans.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
          {filtersActive && (
            <button type="button" className="btn btn-ghost" onClick={clearFilters}><X size={16} /> Clear</button>
          )}
        </div>

        {!result && loading ? (
          <PageLoader label="Loading members..." />
        ) : error && !result ? (
          <ErrorState message={error} onRetry={reload} />
        ) : result.data.length === 0 ? (
          <EmptyState
            icon={Users}
            title={filtersActive ? 'No members match your filters' : 'No members yet'}
            text={filtersActive ? 'Try a different search or clear the filters.' : 'Add your first member to get started.'}
            action={!filtersActive && <Link to="/members/new" className="btn btn-primary">Add member</Link>}
          />
        ) : (
          <>
            <div className={`table-wrap${loading ? ' is-loading' : ''}`}>
              <table className="table">
                <thead>
                  <tr><th>ID</th><th>Member</th><th>Phone</th><th>Plan</th><th>Expiry</th><th>Status</th><th className="col-actions">Actions</th></tr>
                </thead>
                <tbody>
                  {result.data.map((m) => (
                    <tr key={m._id}>
                      <td>{m.memberId}</td>
                      <td><strong>{m.fullName}</strong><div className="muted small">{m.email}</div></td>
                      <td>{m.phone}</td>
                      <td>{m.plan?.name || '-'}</td>
                      <td>{formatDate(m.expiryDate)}</td>
                      <td><StatusBadge status={m.status} /></td>
                      <td className="col-actions">
                        <Link to={`/members/${m._id}`} className="icon-btn" title="View" aria-label={`View ${m.fullName}`}><Eye size={17} /></Link>
                        <Link to={`/members/${m._id}/edit`} className="icon-btn" title="Edit" aria-label={`Edit ${m.fullName}`}><Pencil size={17} /></Link>
                        <button type="button" className="icon-btn danger" title="Delete" aria-label={`Delete ${m.fullName}`} onClick={() => setToDelete(m)}><Trash2 size={17} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination pagination={result.pagination} onChange={setPage} />
          </>
        )}
      </section>

      <section className="card">
        <div className="card-title-row">
          <div>
            <h2 className="card-title">Registered Member Accounts</h2>
            <p className="muted small">Website registrations stored in MongoDB. These accounts are separate from assigned gym memberships and payment records.</p>
          </div>
          {registeredResult?.pagination && (
            <span className="muted small">{registeredResult.pagination.total} account{registeredResult.pagination.total === 1 ? '' : 's'}</span>
          )}
        </div>
        {registeredError && registeredResult && <ErrorState message={registeredError} onRetry={reload} />}
        {registeredError && !registeredResult ? (
          <ErrorState message={registeredError} onRetry={reload} />
        ) : !registeredResult && registeredLoading ? (
          <PageLoader label="Loading registered accounts..." />
        ) : registeredResult?.data.length ? (
          <>
            <div className={`table-wrap${registeredLoading ? ' is-loading' : ''}`}>
              <table className="table">
                <thead>
                  <tr><th>User ID</th><th>Full Name</th><th>Email</th><th>Phone</th><th>Registration Date</th><th>Account Status</th><th className="col-actions">Actions</th></tr>
                </thead>
                <tbody>
                  {registeredResult.data.map((account) => (
                    <tr key={account._id}>
                      <td title={account._id}>{account._id}</td>
                      <td><strong>{account.fullName}</strong></td>
                      <td>{account.email}</td>
                      <td>{account.phone || '-'}</td>
                      <td>{formatDate(account.registrationDate)}</td>
                      <td><StatusBadge status={account.accountStatus} /></td>
                      <td className="col-actions">
                        <button
                          type="button"
                          className="icon-btn"
                          title="View registered account"
                          aria-label={`View registered account for ${account.fullName}`}
                          onClick={() => viewRegisteredUser(account._id)}
                          disabled={loadingRegisteredUser}
                        >
                          <Eye size={17} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination pagination={registeredResult.pagination} onChange={setRegisteredPage} />
          </>
        ) : (
          <EmptyState
            icon={Users}
            title={debouncedSearch ? 'No registered accounts match your search' : 'No registered accounts yet'}
            text={debouncedSearch ? 'Try another name, email or phone number.' : 'Accounts created through the member registration page will appear here.'}
          />
        )}
      </section>

      {selectedRegisteredUser && (
        <Modal title="Registered account details" onClose={() => setSelectedRegisteredUser(null)}>
          <dl className="detail-list">
            <div className="detail-row"><dt>User ID</dt><dd>{selectedRegisteredUser._id}</dd></div>
            <div className="detail-row"><dt>Full name</dt><dd>{selectedRegisteredUser.fullName}</dd></div>
            <div className="detail-row"><dt>Email address</dt><dd>{selectedRegisteredUser.email}</dd></div>
            <div className="detail-row"><dt>Phone number</dt><dd>{selectedRegisteredUser.phone || '-'}</dd></div>
            <div className="detail-row"><dt>Registration date</dt><dd>{formatDate(selectedRegisteredUser.registrationDate)}</dd></div>
            <div className="detail-row"><dt>Account status</dt><dd><StatusBadge status={selectedRegisteredUser.accountStatus} /></dd></div>
          </dl>
          <p className="field-hint">Password information is never returned to the admin portal.</p>
          {loadingRegisteredUser && <PageLoader label="Loading account details..." />}
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={resetSelectedRegisteredPassword} disabled={resettingRegisteredPassword || loadingRegisteredUser}>
              <KeyRound size={16} /> RESET MEMBER PASSWORD
            </button>
            <button type="button" className="btn btn-ghost" onClick={toggleSelectedRegisteredStatus} disabled={updatingRegisteredStatus || loadingRegisteredUser}>
              {selectedRegisteredUser.accountStatus === 'Active' ? <UserX size={16} /> : <UserCheck size={16} />}
              {selectedRegisteredUser.accountStatus === 'Active' ? 'Disable account' : 'Enable account'}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setSelectedRegisteredUser(null)}>Close</button>
          </div>
        </Modal>
      )}

      {registeredTemporaryCredentials && (
        <Modal title="Temporary member password" onClose={() => setRegisteredTemporaryCredentials(null)}>
          <p className="info-note">Copy this password now. It is shown only once and is not stored in plain text.</p>
          <dl className="detail-list">
            <div className="detail-row"><dt>Member account</dt><dd>{registeredTemporaryCredentials.user.fullName}</dd></div>
            <div className="detail-row"><dt>Login email</dt><dd>{registeredTemporaryCredentials.user.email}</dd></div>
            <div className="detail-row"><dt>Linked member ID</dt><dd>{registeredTemporaryCredentials.user.memberId || 'No existing Member record'}</dd></div>
          </dl>
          <div className="field">
            <label htmlFor="temporary-registered-password">Temporary password</label>
            <input id="temporary-registered-password" type="text" readOnly value={registeredTemporaryCredentials.temporaryPassword} />
          </div>
          <p className="field-hint">Use this email and password on the existing member login page. An admin can issue a new temporary password if needed.</p>
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={copyRegisteredTemporaryPassword}><Copy size={16} /> Copy password</button>
            <button type="button" className="btn btn-primary" onClick={() => setRegisteredTemporaryCredentials(null)}>Done</button>
          </div>
        </Modal>
      )}

      {toDelete && (
        <ConfirmDialog
          title="Delete member"
          message={`Delete ${toDelete.fullName} (${toDelete.memberId})? This cannot be undone. Their payment records are kept for your revenue history.`}
          loading={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </>
  );
}
