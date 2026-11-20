import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Clock, Eye, IndianRupee, Pencil, Plus, Receipt, Search, Trash2, TrendingUp, X } from 'lucide-react';
import * as paymentService from '../services/paymentService';
import * as planService from '../services/planService';
import { getErrorMessage } from '../services/api';
import { useToast } from '../context/ToastContext.jsx';
import useDebounce from '../hooks/useDebounce';
import DashboardCard from '../components/DashboardCard.jsx';
import PaymentFormModal from '../components/PaymentFormModal.jsx';
import PaymentDetailsModal from '../components/PaymentDetailsModal.jsx';
import { ConfirmDialog } from '../components/Modal.jsx';
import Pagination from '../components/Pagination.jsx';
import { EmptyState, ErrorState, PageHeader, PageLoader, StatusBadge } from '../components/Feedback.jsx';
import { formatCurrency, formatDate, paymentDetailsSummary } from '../utils/format';

export default function Payments() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const memberFilter = searchParams.get('member') || '';
  const [recordFor, setRecordFor] = useState(searchParams.get('record') || ''); // member id to pre-fill

  const [result, setResult] = useState(null);
  const [plans, setPlans] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(() => (searchParams.get('record') ? { payment: null } : null)); // null = closed
  const [viewing, setViewing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const debounced = useDebounce(search);

  useEffect(() => {
    planService.listPlans().then(setPlans).catch(() => setPlans([]));
  }, []);

  // ?record=<memberId> opened the form; strip it from the URL so a refresh doesn't reopen it.
  useEffect(() => {
    if (searchParams.get('record')) {
      const next = new URLSearchParams(searchParams);
      next.delete('record');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => setPage(1), [debounced, status, memberFilter]);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    paymentService
      .listPayments({ page, limit: 10, search: debounced || undefined, status: status || undefined, member: memberFilter || undefined })
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
  }, [page, debounced, status, memberFilter, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const closeForm = () => { setForm(null); setRecordFor(''); };
  const filtersActive = Boolean(search || status || memberFilter);
  const clearFilters = () => { setSearch(''); setStatus(''); setSearchParams({}, { replace: true }); };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await paymentService.deletePayment(toDelete._id);
      toast.success(`Payment ${toDelete.paymentId} was deleted.`);
      setToDelete(null);
      if (result.data.length === 1 && page > 1) setPage(page - 1);
      else reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const summary = result?.summary;

  return (
    <>
      <PageHeader
        title="Payments"
        subtitle="Record and review member payments. Only Paid payments count as revenue."
        actions={<button type="button" className="btn btn-primary" onClick={() => setForm({ payment: null })}><Plus size={16} /> Record payment</button>}
      />

      {summary && (
        <div className="stat-grid stat-grid-3">
          <DashboardCard icon={IndianRupee} label="Total revenue" value={formatCurrency(summary.totalRevenue)} hint={`${summary.paidCount} paid payments`} tone="navy" />
          <DashboardCard icon={TrendingUp} label="Revenue this month" value={formatCurrency(summary.monthRevenue)} tone="green" />
          <DashboardCard icon={Clock} label="Pending" value={summary.pendingCount} hint={`${formatCurrency(summary.pendingAmount)} not yet counted`} tone="amber" />
        </div>
      )}

      <section className="card">
        <div className="toolbar">
          <div className="search-input">
            <Search size={16} />
            <input placeholder="Search ID, member, plan or reference" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
            <option value="">All statuses</option>
            <option>Paid</option>
            <option>Pending</option>
            <option>Failed</option>
          </select>
          {filtersActive && <button type="button" className="btn btn-ghost" onClick={clearFilters}><X size={16} /> Clear</button>}
        </div>
        {memberFilter && result?.data[0] && (
          <p className="info-note">Showing payment history for <strong>{result.data[0].memberName}</strong>.</p>
        )}

        {!result && loading ? (
          <PageLoader label="Loading payments..." />
        ) : error && !result ? (
          <ErrorState message={error} onRetry={reload} />
        ) : result.data.length === 0 ? (
          <EmptyState icon={Receipt} title={filtersActive ? 'No payments match your filters' : 'No payments yet'} text={filtersActive ? 'Try different filters.' : 'Record the first payment to see it here.'} />
        ) : (
          <>
            <div className={`table-wrap${loading ? ' is-loading' : ''}`}>
              <table className="table">
                <thead>
                  <tr><th>Payment ID</th><th>Member</th><th>Plan</th><th>Amount</th><th>Date</th><th>Method</th><th>Reference</th><th>Status</th><th className="col-actions">Actions</th></tr>
                </thead>
                <tbody>
                  {result.data.map((p) => (
                    <tr key={p._id}>
                      <td>{p.paymentId}</td>
                      <td><strong>{p.memberName}</strong><div className="muted small">{p.memberCode}</div></td>
                      <td>{p.planName}</td>
                      <td>{formatCurrency(p.amount)}</td>
                      <td>{formatDate(p.paymentDate)}</td>
                      <td>{p.method}{paymentDetailsSummary(p) && <div className="muted small">{paymentDetailsSummary(p)}</div>}</td>
                      <td>{p.transactionRef || '-'}</td>
                      <td><StatusBadge status={p.status} /></td>
                      <td className="col-actions">
                        <button type="button" className="icon-btn" title="View" aria-label={`View ${p.paymentId}`} onClick={() => setViewing(p)}><Eye size={17} /></button>
                        <button type="button" className="icon-btn" title="Edit" aria-label={`Edit ${p.paymentId}`} onClick={() => setForm({ payment: p })}><Pencil size={17} /></button>
                        <button type="button" className="icon-btn danger" title="Delete" aria-label={`Delete ${p.paymentId}`} onClick={() => setToDelete(p)}><Trash2 size={17} /></button>
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

      {form && (
        <PaymentFormModal
          payment={form.payment}
          presetMemberId={recordFor}
          plans={plans}
          onClose={closeForm}
          onSaved={() => { closeForm(); reload(); }}
        />
      )}
      {viewing && <PaymentDetailsModal payment={viewing} onClose={() => setViewing(null)} />}
      {toDelete && (
        <ConfirmDialog
          title="Delete payment"
          message={`Delete payment ${toDelete.paymentId} (${formatCurrency(toDelete.amount)} from ${toDelete.memberName})? This will change your revenue totals if it was Paid.`}
          loading={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </>
  );
}
