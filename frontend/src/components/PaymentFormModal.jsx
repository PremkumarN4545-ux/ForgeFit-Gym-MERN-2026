import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import Modal from './Modal.jsx';
import MemberPicker from './MemberPicker.jsx';
import { Spinner } from './Feedback.jsx';
import PaymentMethodFields, { buildPaymentDetails, emptyPaymentDetails, validatePaymentDetails } from './PaymentMethodFields.jsx';
import * as paymentService from '../services/paymentService';
import * as memberService from '../services/memberService';
import { getErrorMessage, getFieldErrors } from '../services/api';
import { useToast } from '../context/ToastContext.jsx';
import { formatCurrency, todayInput, toInputDate } from '../utils/format';

const STATUSES = ['Paid', 'Pending', 'Failed'];

/** Create (payment == null) or edit a payment. In edit mode the member and plan are fixed. */
export default function PaymentFormModal({ payment, presetMemberId, plans, onClose, onSaved }) {
  const toast = useToast();
  const editing = Boolean(payment);
  const [member, setMember] = useState(null);
  const [form, setForm] = useState({
    plan: payment?.plan || '',
    amount: payment ? String(payment.amount) : '',
    paymentDate: payment ? toInputDate(payment.paymentDate) : todayInput(),
    method: payment?.method || 'Cash',
    transactionRef: payment?.transactionRef || '',
    status: payment?.status || 'Paid',
    notes: payment?.notes || '',
  });
  const [details, setDetails] = useState({ ...emptyPaymentDetails(), ...(payment?.paymentDetails || {}) });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const pickMember = (m) => {
    setMember(m);
    setErrors((e) => ({ ...e, member: undefined }));
    // Pre-fill plan and amount from the member's plan (still editable).
    setForm((f) => ({ ...f, plan: m.plan?._id || '', amount: m.plan ? String(m.plan.price) : f.amount }));
  };

  useEffect(() => {
    if (!presetMemberId || editing) return;
    memberService.getMember(presetMemberId).then(pickMember).catch((err) => toast.error(getErrorMessage(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetMemberId]);

  const set = (name) => (e) => {
    setForm((f) => ({ ...f, [name]: e.target.value }));
    setErrors((er) => ({ ...er, [name]: undefined }));
  };

  const setDetail = (k, v) => {
    setDetails((d) => ({ ...d, [k]: v }));
    setErrors((er) => ({ ...er, [`paymentDetails.${k}`]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const found = {};
    if (!editing && !member) found.member = 'Select a member';
    if (!(Number(form.amount) > 0)) found.amount = 'Enter an amount greater than 0';
    if (!form.paymentDate) found.paymentDate = 'Select a payment date';
    else if (form.paymentDate > todayInput()) found.paymentDate = 'Payment date cannot be in the future';
    Object.assign(found, validatePaymentDetails(form.method, details));
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    try {
      const body = { ...form, amount: Number(form.amount), transactionRef: form.transactionRef.trim(), paymentDetails: buildPaymentDetails(form.method, details), notes: form.notes.trim() };
      const saved = editing
        ? await paymentService.updatePayment(payment._id, body)
        : await paymentService.createPayment({ ...body, member: member._id });
      toast.success(editing ? 'Payment updated.' : `Payment ${saved.paymentId} recorded.`);
      onSaved(saved);
    } catch (err) {
      setErrors((er) => ({ ...er, ...getFieldErrors(err) }));
      toast.error(getErrorMessage(err));
      setSaving(false);
    }
  };

  const err = (name) => (errors[name] ? <span className="field-error">{errors[name]}</span> : null);

  return (
    <Modal title={editing ? `Edit ${payment.paymentId}` : 'Record payment'} onClose={saving ? () => {} : onClose}>
      <form onSubmit={handleSubmit} noValidate>
        <p className="info-note">
          Payments are recorded manually by the admin. No online payment gateway is integrated.
        </p>

        <div className={`field${errors.member ? ' has-error' : ''}`}>
          <label>Member *</label>
          {editing ? (
            <div className="picked-member">
              <div>
                <strong>{payment.memberName}</strong>
                <span className="muted"> {payment.memberCode}</span>
              </div>
            </div>
          ) : (
            <MemberPicker value={member} onSelect={pickMember} onClear={() => setMember(null)} error={errors.member} />
          )}
          {err('member')}
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="pay-plan">Membership plan</label>
            <select id="pay-plan" value={form.plan} onChange={set('plan')} disabled={editing}>
              {editing && <option value={form.plan}>{payment.planName}</option>}
              {!editing && <option value="">Member&apos;s current plan</option>}
              {!editing && (plans || []).map((p) => (
                <option key={p._id} value={p._id}>{p.name} - {formatCurrency(p.price)}</option>
              ))}
            </select>
          </div>
          <div className={`field${errors.amount ? ' has-error' : ''}`}>
            <label htmlFor="pay-amount">Amount *</label>
            <input id="pay-amount" type="number" min="0" step="0.01" value={form.amount} onChange={set('amount')} />
            {err('amount')}
          </div>
          <div className={`field${errors.paymentDate ? ' has-error' : ''}`}>
            <label htmlFor="pay-date">Payment date *</label>
            <input id="pay-date" type="date" max={todayInput()} value={form.paymentDate} onChange={set('paymentDate')} />
            {err('paymentDate')}
          </div>
          <div className={`field${errors.transactionRef ? ' has-error' : ''}`}>
            <label htmlFor="pay-ref">Transaction reference</label>
            <input id="pay-ref" value={form.transactionRef} onChange={set('transactionRef')} maxLength={100} placeholder="Optional" />
            {err('transactionRef')}
          </div>
          <div className="field">
            <label htmlFor="pay-status">Payment status *</label>
            <select id="pay-status" value={form.status} onChange={set('status')}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
            <span className="field-hint">Only &quot;Paid&quot; payments count towards revenue.</span>
          </div>
        </div>
        <PaymentMethodFields
          idPrefix="pay"
          method={form.method}
          details={details}
          errors={errors}
          onMethodChange={(m) => { setForm((f) => ({ ...f, method: m })); setErrors((er) => ({ ...er, method: undefined })); }}
          onDetailChange={setDetail}
        />

        <div className="field">
          <label htmlFor="pay-notes">Notes</label>
          <textarea id="pay-notes" rows={2} value={form.notes} onChange={set('notes')} maxLength={300} />
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <Spinner small /> : <Save size={16} />} {editing ? 'Save changes' : 'Record payment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
