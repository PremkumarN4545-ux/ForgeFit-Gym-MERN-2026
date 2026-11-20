import { useCallback, useEffect, useState } from 'react';
import { Check, Layers, Pencil, Plus, Power, Search, Trash2, Users } from 'lucide-react';
import * as planService from '../services/planService';
import { getErrorMessage } from '../services/api';
import { useToast } from '../context/ToastContext.jsx';
import useDebounce from '../hooks/useDebounce';
import PlanFormModal from '../components/PlanFormModal.jsx';
import { ConfirmDialog } from '../components/Modal.jsx';
import { EmptyState, ErrorState, PageHeader, PageLoader, StatusBadge } from '../components/Feedback.jsx';
import { durationLabel, formatCurrency } from '../utils/format';

export default function Plans() {
  const toast = useToast();
  const [plans, setPlans] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState(undefined); // undefined = closed, null = new, object = edit
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const debounced = useDebounce(search);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let ignore = false;
    planService
      .listPlans({ search: debounced || undefined, status: status || undefined })
      .then((p) => {
        if (ignore) return;
        setPlans(p);
        setError('');
      })
      .catch((err) => !ignore && setError(getErrorMessage(err)));
    return () => {
      ignore = true;
    };
  }, [debounced, status, reloadKey]);

  const toggleStatus = async (plan) => {
    const next = plan.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await planService.setPlanStatus(plan._id, next);
      toast.success(`${plan.name} is now ${next.toLowerCase()}.`);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await planService.deletePlan(toDelete._id);
      toast.success(`${toDelete.name} was deleted.`);
      setToDelete(null);
      reload();
    } catch (err) {
      // e.g. 409 when members are still assigned to the plan
      toast.error(getErrorMessage(err));
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Membership plans"
        subtitle="Create and manage the plans your members can join."
        actions={<button type="button" className="btn btn-primary" onClick={() => setEditing(null)}><Plus size={16} /> Add plan</button>}
      />

      <section className="card">
        <div className="toolbar">
          <div className="search-input">
            <Search size={16} />
            <input placeholder="Search plans" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
            <option value="">All statuses</option>
            <option>Active</option>
            <option>Inactive</option>
          </select>
        </div>

        {error && !plans ? (
          <ErrorState message={error} onRetry={reload} />
        ) : !plans ? (
          <PageLoader label="Loading plans..." />
        ) : plans.length === 0 ? (
          <EmptyState icon={Layers} title="No plans found" text="Try a different search, or add a new plan." />
        ) : (
          <div className="plan-grid">
            {plans.map((p) => (
              <article key={p._id} className={`plan-card${p.status === 'Inactive' ? ' is-inactive' : ''}`}>
                <div className="plan-head">
                  <h3>{p.name}</h3>
                  <StatusBadge status={p.status} />
                </div>
                <p className="plan-price">{formatCurrency(p.price)} <span>/ {durationLabel(p.durationMonths)}</span></p>
                {p.description && <p className="muted">{p.description}</p>}
                {p.benefits.length > 0 && (
                  <ul className="benefits">
                    {p.benefits.map((b) => <li key={b}><Check size={15} /> {b}</li>)}
                  </ul>
                )}
                <p className="plan-members"><Users size={15} /> {p.memberCount} member{p.memberCount === 1 ? '' : 's'}</p>
                <div className="plan-actions">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(p)}><Pencil size={15} /> Edit</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleStatus(p)}>
                    <Power size={15} /> {p.status === 'Active' ? 'Deactivate' : 'Activate'}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm danger-text" onClick={() => setToDelete(p)}><Trash2 size={15} /> Delete</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {editing !== undefined && (
        <PlanFormModal
          plan={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => { setEditing(undefined); reload(); }}
        />
      )}
      {toDelete && (
        <ConfirmDialog
          title="Delete plan"
          message={`Delete the "${toDelete.name}" plan? Plans that still have members assigned cannot be deleted.`}
          loading={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </>
  );
}
