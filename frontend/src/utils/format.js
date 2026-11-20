const CURRENCY = import.meta.env.VITE_CURRENCY || 'INR';
const LOCALE = CURRENCY === 'INR' ? 'en-IN' : 'en-US';

export function formatCurrency(value) {
  const n = Number(value) || 0;
  const digits = Number.isInteger(n) ? 0 : 2;
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: CURRENCY,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

/** Dates from the API are UTC midnight; format in UTC so they never shift a day. */
export function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export const toInputDate = (iso) => (iso ? String(iso).slice(0, 10) : '');

export function todayInput() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Same month arithmetic as the backend (clamps 31 Jan + 1 month to 28/29 Feb). Returns 'YYYY-MM-DD' or ''. */
export function addMonthsISO(isoDate, months) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate || '');
  if (!m || !Number.isInteger(months)) return '';
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const target = new Date(Date.UTC(y, mo + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

export function daysUntil(isoExpiry) {
  if (!isoExpiry) return null;
  const [y, m, d] = todayInput().split('-').map(Number);
  const todayMs = Date.UTC(y, m - 1, d);
  const expiry = new Date(isoExpiry);
  const expiryMs = Date.UTC(expiry.getUTCFullYear(), expiry.getUTCMonth(), expiry.getUTCDate());
  return Math.round((expiryMs - todayMs) / 86400000);
}

export function durationLabel(months) {
  if (!months) return '-';
  if (months % 12 === 0) {
    const y = months / 12;
    return `${y} year${y === 1 ? '' : 's'}`;
  }
  return `${months} month${months === 1 ? '' : 's'}`;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_RE = /^[+()\d\s-]{7,20}$/;

export const PAYMENT_METHODS = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Other'];

/** Short one-line summary of method-specific payment details (safe identifiers only). */
export function paymentDetailsSummary(payment) {
  const d = payment?.paymentDetails;
  if (!d) return '';
  switch (payment.method) {
    case 'UPI': return d.upiId || '';
    case 'Card': return [d.cardType, d.cardLast4 && `•••• ${d.cardLast4}`].filter(Boolean).join(' ');
    case 'Bank Transfer': return [d.bankName, d.accountLast4 && `A/c •••• ${d.accountLast4}`].filter(Boolean).join(' · ');
    case 'Other': return d.otherMethod || '';
    default: return '';
  }
}

/** Labelled rows for the method-specific details, for detail views. */
export function paymentDetailRows(payment) {
  const d = payment?.paymentDetails || {};
  switch (payment?.method) {
    case 'UPI': return [['UPI ID', d.upiId]];
    case 'Card': return [['Card type', d.cardType], ['Name on card', d.cardHolderName], ['Card number', d.cardLast4 && `•••• •••• •••• ${d.cardLast4}`]];
    case 'Bank Transfer': return [['Bank name', d.bankName], ['Account holder', d.accountHolderName], ['Account number', d.accountLast4 && `•••• ${d.accountLast4}`]];
    case 'Other': return [['Method description', d.otherMethod]];
    default: return [];
  }
}
