import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save } from 'lucide-react';
import * as planService from '../services/planService';
import { getErrorMessage, getFieldErrors } from '../services/api';
import { useToast } from '../context/ToastContext.jsx';
import { EMAIL_RE, PHONE_RE, addMonthsISO, durationLabel, formatCurrency, formatDate, todayInput, toInputDate } from '../utils/format';
import { PageLoader, Spinner } from './Feedback.jsx';

function initialState(member) {
  if (!member) {
    const today = todayInput();
    return {
      fullName: '', email: '', phone: '', gender: '', dateOfBirth: '', address: '',
      joiningDate: today, plan: '', startDate: today, status: 'Active',
    };
  }
  return {
    fullName: member.fullName,
    email: member.email,
    phone: member.phone,
    gender: member.gender,
    dateOfBirth: toInputDate(member.dateOfBirth),
    address: member.address,
    joiningDate: toInputDate(member.joiningDate),
    plan: member.plan?._id || '',
    startDate: toInputDate(member.startDate),
    status: member.status === 'Inactive' ? 'Inactive' : 'Active',
  };
}

function validate(f) {
  const e = {};
  if (f.fullName.trim().length < 2) e.fullName = 'Full name must be at least 2 characters';
  if (!EMAIL_RE.test(f.email.trim())) e.email = 'Enter a valid email address';
  if (!PHONE_RE.test(f.phone.trim()) || f.phone.replace(/\D/g, '').length < 7) e.phone = 'Enter a valid phone number';
  if (!f.gender) e.gender = 'Select a gender';
  if (!f.dateOfBirth) e.dateOfBirth = 'Date of birth is required';
  else if (f.dateOfBirth > todayInput()) e.dateOfBirth = 'Date of birth cannot be in the future';
  if (f.address.trim().length < 5) e.address = 'Address must be at least 5 characters';
  if (!f.joiningDate) e.joiningDate = 'Joining date is required';
  if (!f.plan) e.plan = 'Select a membership plan';
  if (!f.startDate) e.startDate = 'Start date is required';
  return e;
}

/** Shared by Add Member and Edit Member. `onSubmit(payload)` must call the API and throw on failure. */
export default function MemberForm({ member, onSubmit, submitLabel }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState(() => initialState(member));
  const [errors, setErrors] = useState({});
  const [plans, setPlans] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    planService
      .listPlans()
      .then(setPlans)
      .catch((err) => {
        toast.error(getErrorMessage(err));
        setPlans([]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Only active plans can be newly assigned; keep the member's current plan selectable even if inactive.
  const selectablePlans = useMemo(
    () => (plans || []).filter((p) => p.status === 'Active' || p._id === member?.plan?._id),
    [plans, member]
  );
  const selectedPlan = (plans || []).find((p) => p._id === form.plan);
  const calculatedExpiry = selectedPlan ? addMonthsISO(form.startDate, selectedPlan.durationMonths) : '';

  const set = (name) => (e) => {
    setForm((f) => ({ ...f, [name]: e.target.value }));
    setErrors((er) => ({ ...er, [name]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) {
      toast.error('Please correct the highlighted fields.');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        ...form,
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
      });
    } catch (err) {
      setErrors((er) => ({ ...er, ...getFieldErrors(err) }));
      toast.error(getErrorMessage(err));
      setSaving(false);
    }
  };

  if (!plans) return <PageLoader label="Loading plans..." />;

  const field = (name, label, input) => (
    <div className={`field${errors[name] ? ' has-error' : ''}`}>
      <label htmlFor={name}>{label}</label>
      {input}
      {errors[name] && <span className="field-error">{errors[name]}</span>}
    </div>
  );

  return (
    <form className="card form-card" onSubmit={handleSubmit} noValidate>
      <h3 className="form-section">Personal details</h3>
      <div className="form-grid">
        {field('fullName', 'Full name *', <input id="fullName" value={form.fullName} onChange={set('fullName')} maxLength={100} />)}
        {field('email', 'Email *', <input id="email" type="email" value={form.email} onChange={set('email')} />)}
        {field('phone', 'Phone number *', <input id="phone" value={form.phone} onChange={set('phone')} maxLength={20} />)}
        {field(
          'gender',
          'Gender *',
          <select id="gender" value={form.gender} onChange={set('gender')}>
            <option value="">Select gender</option>
            <option>Male</option>
            <option>Female</option>
            <option>Other</option>
          </select>
        )}
        {field('dateOfBirth', 'Date of birth *', <input id="dateOfBirth" type="date" max={todayInput()} value={form.dateOfBirth} onChange={set('dateOfBirth')} />)}
        {field('joiningDate', 'Joining date *', <input id="joiningDate" type="date" value={form.joiningDate} onChange={set('joiningDate')} />)}
      </div>
      {field('address', 'Address *', <textarea id="address" rows={3} value={form.address} onChange={set('address')} maxLength={300} />)}

      <h3 className="form-section">Membership</h3>
      <div className="form-grid">
        {field(
          'plan',
          'Membership plan *',
          <select id="plan" value={form.plan} onChange={set('plan')}>
            <option value="">Select a plan</option>
            {selectablePlans.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name} - {durationLabel(p.durationMonths)} - {formatCurrency(p.price)}
                {p.status === 'Inactive' ? ' (inactive)' : ''}
              </option>
            ))}
          </select>
        )}
        {field('startDate', 'Membership start date *', <input id="startDate" type="date" value={form.startDate} onChange={set('startDate')} />)}
        <div className="field">
          <label htmlFor="expiry">Membership expiry date (calculated)</label>
          <input id="expiry" value={calculatedExpiry ? formatDate(calculatedExpiry) : 'Select a plan and start date'} readOnly disabled />
          <span className="field-hint">Set automatically from the plan duration.</span>
        </div>
        {field(
          'status',
          'Account status',
          <select id="status" value={form.status} onChange={set('status')}>
            <option value="Active">Active (expires automatically)</option>
            <option value="Inactive">Inactive (suspended)</option>
          </select>
        )}
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={() => navigate('/members')} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? <Spinner small /> : <Save size={16} />} {submitLabel}
        </button>
      </div>
    </form>
  );
}
