import { ApiError } from './ApiError.js';
import { ageFrom, parseDateOnly, round2, todayUTC } from './dates.js';
import {
  GENDERS,
  CARD_TYPES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PLAN_STATUSES,
} from './constants.js';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+()\d\s-]{7,20}$/;
const OBJECT_ID_RE = /^[a-f\d]{24}$/i;
const MAX_AMOUNT = 10000000;

const isStr = (v) => typeof v === 'string';
const clean = (v) => (isStr(v) ? v.trim() : '');

// NOTE: mongoose.isValidObjectId accepts any 12-char string, so use a strict regex.
export const isObjectId = (v) => isStr(v) && OBJECT_ID_RE.test(v);

export const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Query-string values can be arrays/objects; only accept plain strings. */
export const queryString = (v) => (isStr(v) ? v.trim() : '');

export function parsePagination(query, defaultLimit = 10) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
}

export function throwIfErrors(errors) {
  if (Object.keys(errors).length) {
    throw new ApiError(400, 'Please correct the highlighted fields', errors);
  }
}

export function validateMember(body = {}) {
  const errors = {};
  const value = {};

  value.fullName = clean(body.fullName);
  if (value.fullName.length < 2 || value.fullName.length > 100) {
    errors.fullName = 'Full name must be 2-100 characters';
  }

  value.email = clean(body.email).toLowerCase();
  if (!EMAIL_RE.test(value.email)) errors.email = 'Enter a valid email address';

  value.phone = clean(body.phone);
  if (!PHONE_RE.test(value.phone) || value.phone.replace(/\D/g, '').length < 7) {
    errors.phone = 'Enter a valid phone number';
  }

  value.gender = clean(body.gender);
  if (!GENDERS.includes(value.gender)) errors.gender = 'Select a gender';

  value.dateOfBirth = parseDateOnly(body.dateOfBirth);
  if (!value.dateOfBirth) errors.dateOfBirth = 'Enter a valid date of birth';
  else if (value.dateOfBirth > todayUTC()) errors.dateOfBirth = 'Date of birth cannot be in the future';
  else if (ageFrom(value.dateOfBirth) > 100) errors.dateOfBirth = 'Enter a valid date of birth';

  value.address = clean(body.address);
  if (value.address.length < 5 || value.address.length > 300) {
    errors.address = 'Address must be 5-300 characters';
  }

  value.joiningDate = parseDateOnly(body.joiningDate);
  if (!value.joiningDate) errors.joiningDate = 'Enter a valid joining date';

  value.startDate = parseDateOnly(body.startDate);
  if (!value.startDate) errors.startDate = 'Enter a valid membership start date';

  value.plan = clean(body.plan);
  if (!isObjectId(value.plan)) errors.plan = 'Select a membership plan';

  // Admin can only request Active or Inactive; "Expired" is always derived from the expiry date.
  value.status = body.status === 'Inactive' ? 'Inactive' : 'Active';

  return { errors, value };
}

export function validateUserRegistration(body = {}) {
  const errors = {};
  const value = {};

  value.fullName = clean(body.fullName);
  if (value.fullName.length < 2 || value.fullName.length > 100) {
    errors.fullName = 'Full name must be 2-100 characters';
  }

  value.email = clean(body.email).toLowerCase();
  if (!EMAIL_RE.test(value.email)) errors.email = 'Enter a valid email address';

  value.phone = clean(body.phone);
  if (!PHONE_RE.test(value.phone) || value.phone.replace(/\D/g, '').length < 7) {
    errors.phone = 'Enter a valid phone number';
  }

  value.password = isStr(body.password) ? body.password : '';
  if (value.password.length < 8 || value.password.length > 128) {
    errors.password = 'Password must be 8-128 characters';
  } else if (!/[a-z]/.test(value.password) || !/[A-Z]/.test(value.password) || !/\d/.test(value.password)) {
    errors.password = 'Password must include uppercase and lowercase letters and a number';
  }

  return { errors, value };
}

export function validatePlan(body = {}) {
  const errors = {};
  const value = {};

  value.name = clean(body.name);
  if (value.name.length < 2 || value.name.length > 60) errors.name = 'Plan name must be 2-60 characters';

  value.description = clean(body.description);
  if (value.description.length > 500) errors.description = 'Description must be at most 500 characters';

  const months = Number(body.durationMonths);
  if (body.durationMonths === '' || body.durationMonths == null || !Number.isInteger(months) || months < 1 || months > 60) {
    errors.durationMonths = 'Duration must be a whole number of months (1-60)';
  }
  value.durationMonths = months;

  const price = Number(body.price);
  if (body.price === '' || body.price == null || !Number.isFinite(price) || price < 0 || price > MAX_AMOUNT) {
    errors.price = 'Enter a valid price';
  }
  value.price = round2(price);

  let benefits = body.benefits;
  if (isStr(benefits)) benefits = benefits.split('\n');
  if (!Array.isArray(benefits)) benefits = [];
  value.benefits = benefits.map(clean).filter(Boolean);
  if (value.benefits.length > 15 || value.benefits.some((b) => b.length > 100)) {
    errors.benefits = 'Up to 15 benefits, each at most 100 characters';
  }

  value.status = body.status == null || body.status === '' ? 'Active' : clean(body.status);
  if (!PLAN_STATUSES.includes(value.status)) errors.status = 'Invalid status';

  return { errors, value };
}


const UPI_RE = /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z][a-zA-Z0-9.-]{1,30}$/;
const NAME_RE = /^[\p{L}][\p{L} .'-]{1,99}$/u;

/** Validate and normalise the method-specific payment details. Never accepts full card numbers/CVV. */
export function validatePaymentDetails(method, raw, errors) {
  const d = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = {};
  const need = (key, msg) => { errors[`paymentDetails.${key}`] = msg; };
  const last4 = (v) => clean(v).replace(/\s/g, '');

  if (method === 'UPI') {
    out.upiId = clean(d.upiId).toLowerCase();
    if (!UPI_RE.test(out.upiId)) need('upiId', 'Enter a valid UPI ID (e.g. name@bank)');
  } else if (method === 'Card') {
    out.cardType = clean(d.cardType);
    if (!CARD_TYPES.includes(out.cardType)) need('cardType', 'Select credit or debit card');
    out.cardHolderName = clean(d.cardHolderName);
    if (!NAME_RE.test(out.cardHolderName)) need('cardHolderName', 'Enter the name on the card');
    out.cardLast4 = last4(d.cardLast4);
    if (!/^\d{4}$/.test(out.cardLast4)) need('cardLast4', 'Enter the last 4 digits of the card');
  } else if (method === 'Bank Transfer') {
    out.bankName = clean(d.bankName);
    if (out.bankName.length < 2 || out.bankName.length > 100) need('bankName', 'Enter the bank name');
    out.accountHolderName = clean(d.accountHolderName);
    if (!NAME_RE.test(out.accountHolderName)) need('accountHolderName', 'Enter the account holder name');
    out.accountLast4 = last4(d.accountLast4);
    if (!/^\d{4}$/.test(out.accountLast4)) need('accountLast4', 'Enter the last 4 digits of the account number');
  } else if (method === 'Other') {
    out.otherMethod = clean(d.otherMethod);
    if (!out.otherMethod || out.otherMethod.length > 100) need('otherMethod', 'Describe the payment method (max 100 characters)');
  } else {
    return undefined; // Cash: no extra details
  }
  return out;
}

export function validatePayment(body = {}, { requireMember = true } = {}) {
  const errors = {};
  const value = {};

  if (requireMember) {
    value.member = clean(body.member);
    if (!isObjectId(value.member)) errors.member = 'Select a member';
    value.plan = clean(body.plan);
    if (value.plan && !isObjectId(value.plan)) errors.plan = 'Invalid plan';
  }

  const amount = Number(body.amount);
  if (body.amount === '' || body.amount == null || !Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) {
    errors.amount = 'Enter an amount greater than 0';
  }
  value.amount = round2(amount);

  value.paymentDate = body.paymentDate ? parseDateOnly(body.paymentDate) : todayUTC();
  if (!value.paymentDate) errors.paymentDate = 'Enter a valid payment date';
  else if (value.paymentDate > todayUTC()) errors.paymentDate = 'Payment date cannot be in the future';

  value.method = clean(body.method);
  if (!PAYMENT_METHODS.includes(value.method)) errors.method = 'Select a payment method';

  value.status = body.status == null || body.status === '' ? 'Paid' : clean(body.status);
  if (!PAYMENT_STATUSES.includes(value.status)) errors.status = 'Select a payment status';

  value.paymentDetails = validatePaymentDetails(value.method, body.paymentDetails, errors);

  value.transactionRef = clean(body.transactionRef) || undefined;
  if (value.transactionRef && value.transactionRef.length > 100) {
    errors.transactionRef = 'Reference must be at most 100 characters';
  }

  value.notes = clean(body.notes) || undefined;
  if (value.notes && value.notes.length > 300) errors.notes = 'Notes must be at most 300 characters';

  return { errors, value };
}
