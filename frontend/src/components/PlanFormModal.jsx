import { useState } from 'react';
import { Save } from 'lucide-react';
import Modal from './Modal.jsx';
import { Spinner } from './Feedback.jsx';
import * as planService from '../services/planService';
import { getErrorMessage, getFieldErrors } from '../services/api';
import { useToast } from '../context/ToastContext.jsx';

const PRESETS = [
  { label: 'Monthly (1 month)', value: '1' },
  { label: 'Quarterly (3 months)', value: '3' },
  { label: 'Half-yearly (6 months)', value: '6' },
  { label: 'Yearly (12 months)', value: '12' },
];

function initial(plan) {
  if (!plan) return { name: '', description: '', preset: '1', customMonths: '', price: '', benefits: '', status: 'Active' };
  const isPreset = PRESETS.some((p) => p.value === String(plan.durationMonths));
  return {
    name: plan.name,
    description: plan.description || '',
    preset: isPreset ? String(plan.durationMonths) : 'custom',
    customMonths: isPreset ? '' : String(plan.durationMonths),
    price: String(plan.price),
    benefits: (plan.benefits || []).join('\n'),
    status: plan.status,
  };
}

export default function PlanFormModal({ plan, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(() => initial(plan));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (name) => (e) => {
    setForm((f) => ({ ...f, [name]: e.target.value }));
    setErrors((er) => ({ ...er, [name]: undefined, ...(name === 'preset' || name === 'customMonths' ? { durationMonths: undefined } : {}) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const months = form.preset === 'custom' ? Number(form.customMonths) : Number(form.preset);
    const found = {};
    if (form.name.trim().length < 2) found.name = 'Plan name must be at least 2 characters';
    if (!Number.isInteger(months) || months < 1 || months > 60) found.durationMonths = 'Enter a whole number of months (1-60)';
    if (form.price === '' || Number(form.price) < 0 || Number.isNaN(Number(form.price))) found.price = 'Enter a valid price';
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        durationMonths: months,
        price: Number(form.price),
        benefits: form.benefits.split('\n').map((b) => b.trim()).filter(Boolean),
        status: form.status,
      };
      const saved = plan ? await planService.updatePlan(plan._id, payload) : await planService.createPlan(payload);
      toast.success(plan ? 'Plan updated successfully.' : 'Plan created successfully.');
      onSaved(saved);
    } catch (err) {
      setErrors((er) => ({ ...er, ...getFieldErrors(err) }));
      toast.error(getErrorMessage(err));
      setSaving(false);
    }
  };

  const err = (name) => (errors[name] ? <span className="field-error">{errors[name]}</span> : null);

  return (
    <Modal title={plan ? 'Edit plan' : 'Add membership plan'} onClose={saving ? () => {} : onClose}>
      <form onSubmit={handleSubmit} noValidate>
        <div className={`field${errors.name ? ' has-error' : ''}`}>
          <label htmlFor="plan-name">Plan name *</label>
          <input id="plan-name" value={form.name} onChange={set('name')} maxLength={60} />
          {err('name')}
        </div>
        <div className="field">
          <label htmlFor="plan-desc">Description</label>
          <textarea id="plan-desc" rows={2} value={form.description} onChange={set('description')} maxLength={500} />
        </div>
        <div className="form-grid">
          <div className={`field${errors.durationMonths ? ' has-error' : ''}`}>
            <label htmlFor="plan-duration">Duration *</label>
            <select id="plan-duration" value={form.preset} onChange={set('preset')}>
              {PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
              <option value="custom">Custom...</option>
            </select>
            {form.preset === 'custom' && (
              <input type="number" min="1" max="60" placeholder="Number of months" value={form.customMonths} onChange={set('customMonths')} style={{ marginTop: 8 }} />
            )}
            {err('durationMonths')}
          </div>
          <div className={`field${errors.price ? ' has-error' : ''}`}>
            <label htmlFor="plan-price">Price *</label>
            <input id="plan-price" type="number" min="0" step="0.01" value={form.price} onChange={set('price')} />
            {err('price')}
          </div>
        </div>
        <div className={`field${errors.benefits ? ' has-error' : ''}`}>
          <label htmlFor="plan-benefits">Benefits (one per line)</label>
          <textarea id="plan-benefits" rows={4} value={form.benefits} onChange={set('benefits')} placeholder={'Full gym access\nGroup classes'} />
          {err('benefits')}
        </div>
        <div className="field">
          <label htmlFor="plan-status">Status</label>
          <select id="plan-status" value={form.status} onChange={set('status')}>
            <option>Active</option>
            <option>Inactive</option>
          </select>
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <Spinner small /> : <Save size={16} />} {plan ? 'Save changes' : 'Create plan'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
