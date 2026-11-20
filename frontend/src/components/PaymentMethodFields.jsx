import { Banknote, CreditCard, Landmark, Smartphone, Wallet } from 'lucide-react';
import { PAYMENT_METHODS } from '../utils/format';

const ICONS = { Cash: Banknote, UPI: Smartphone, Card: CreditCard, 'Bank Transfer': Landmark, Other: Wallet };
const HINTS = {
  Cash: 'Pay in cash at the gym front desk.',
  UPI: 'Pay with any UPI app (GPay, PhonePe, Paytm, BHIM...).',
  Card: 'Credit or debit card.',
  'Bank Transfer': 'NEFT / IMPS / RTGS / net banking.',
  Other: 'Cheque, wallet or any other method.',
};

export const emptyPaymentDetails = () => ({
  upiId: '', cardType: 'Debit Card', cardHolderName: '', cardLast4: '',
  bankName: '', accountHolderName: '', accountLast4: '', otherMethod: '',
});

/** Build the paymentDetails payload for the chosen method (only the relevant fields). */
export function buildPaymentDetails(method, d) {
  const t = (v) => String(v || '').trim();
  switch (method) {
    case 'UPI': return { upiId: t(d.upiId) };
    case 'Card': return { cardType: d.cardType, cardHolderName: t(d.cardHolderName), cardLast4: t(d.cardLast4) };
    case 'Bank Transfer': return { bankName: t(d.bankName), accountHolderName: t(d.accountHolderName), accountLast4: t(d.accountLast4) };
    case 'Other': return { otherMethod: t(d.otherMethod) };
    default: return undefined;
  }
}

/** Client-side validation mirroring the server. Returns { 'paymentDetails.x': message }. */
export function validatePaymentDetails(method, d) {
  const e = {};
  const t = (v) => String(v || '').trim();
  if (method === 'UPI' && !/^[a-zA-Z0-9._-]{2,64}@[a-zA-Z][a-zA-Z0-9.-]{1,30}$/.test(t(d.upiId))) e['paymentDetails.upiId'] = 'Enter a valid UPI ID (e.g. name@bank)';
  if (method === 'Card') {
    if (t(d.cardHolderName).length < 2) e['paymentDetails.cardHolderName'] = 'Enter the name on the card';
    if (!/^\d{4}$/.test(t(d.cardLast4))) e['paymentDetails.cardLast4'] = 'Enter the last 4 digits of the card';
  }
  if (method === 'Bank Transfer') {
    if (t(d.bankName).length < 2) e['paymentDetails.bankName'] = 'Enter the bank name';
    if (t(d.accountHolderName).length < 2) e['paymentDetails.accountHolderName'] = 'Enter the account holder name';
    if (!/^\d{4}$/.test(t(d.accountLast4))) e['paymentDetails.accountLast4'] = 'Enter the last 4 digits of the account number';
  }
  if (method === 'Other' && !t(d.otherMethod)) e['paymentDetails.otherMethod'] = 'Describe the payment method';
  return e;
}

/**
 * Payment method picker + method-specific detail fields.
 * `variant="tiles"` shows selectable tiles (member dashboard); `variant="select"` a dropdown (admin form).
 */
export default function PaymentMethodFields({ method, details, errors = {}, onMethodChange, onDetailChange, variant = 'select', idPrefix = 'pm' }) {
  const err = (k) => (errors[`paymentDetails.${k}`] ? <span className="field-error">{errors[`paymentDetails.${k}`]}</span> : null);
  const cls = (k) => `field${errors[`paymentDetails.${k}`] ? ' has-error' : ''}`;
  const input = (k, label, props = {}) => (
    <div className={cls(k)}>
      <label htmlFor={`${idPrefix}-${k}`}>{label} *</label>
      <input id={`${idPrefix}-${k}`} value={details[k] || ''} onChange={(e) => onDetailChange(k, e.target.value)} {...props} />
      {err(k)}
    </div>
  );

  return (
    <div className="pm-fields">
      {variant === 'tiles' ? (
        <div className="pm-tiles" role="radiogroup" aria-label="Payment method">
          {PAYMENT_METHODS.map((m) => {
            const Icon = ICONS[m];
            return (
              <button type="button" key={m} role="radio" aria-checked={method === m}
                className={`pm-tile${method === m ? ' is-selected' : ''}`} onClick={() => onMethodChange(m)}>
                <Icon size={20} /><strong>{m}</strong><span>{HINTS[m]}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="field">
          <label htmlFor={`${idPrefix}-method`}>Payment method *</label>
          <select id={`${idPrefix}-method`} value={method} onChange={(e) => onMethodChange(e.target.value)}>
            {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
      )}

      {method === 'Cash' && <p className="field-hint pm-cash-note">No extra details needed for cash payments.</p>}

      {method !== 'Cash' && (
        <div className="form-grid pm-detail-grid">
          {method === 'UPI' && input('upiId', 'UPI ID', { placeholder: 'name@bank', maxLength: 80, autoComplete: 'off' })}
          {method === 'Card' && (
            <>
              <div className="field">
                <label htmlFor={`${idPrefix}-cardType`}>Card type *</label>
                <select id={`${idPrefix}-cardType`} value={details.cardType} onChange={(e) => onDetailChange('cardType', e.target.value)}>
                  <option>Debit Card</option><option>Credit Card</option>
                </select>
              </div>
              {input('cardHolderName', 'Name on card', { maxLength: 100, autoComplete: 'off' })}
              {input('cardLast4', 'Last 4 digits of card', { inputMode: 'numeric', maxLength: 4, placeholder: '1234', autoComplete: 'off' })}
            </>
          )}
          {method === 'Bank Transfer' && (
            <>
              {input('bankName', 'Bank name', { maxLength: 100 })}
              {input('accountHolderName', 'Account holder name', { maxLength: 100 })}
              {input('accountLast4', 'Last 4 digits of account no.', { inputMode: 'numeric', maxLength: 4, placeholder: '1234', autoComplete: 'off' })}
            </>
          )}
          {method === 'Other' && input('otherMethod', 'Describe method', { maxLength: 100, placeholder: 'e.g. Cheque, Paytm wallet' })}
        </div>
      )}
      {(method === 'Card' || method === 'Bank Transfer') && (
        <p className="field-hint">For your security, ForgeFit never asks for full card/account numbers, CVV, expiry or PIN - only the last 4 digits.</p>
      )}
    </div>
  );
}
