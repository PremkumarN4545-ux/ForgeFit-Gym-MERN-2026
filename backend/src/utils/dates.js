// Dependency-free date helpers. All "date only" values are stored as UTC midnight
// so they never shift when the server or browser time zone differs.

/** Parse 'YYYY-MM-DD' (or an ISO string / Date) into a UTC-midnight Date, or null. */
export function parseDateOnly(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  if (typeof value !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1900 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  // Reject overflow such as 2025-02-31
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

/** Today's calendar date (server local) as UTC midnight. */
export function todayUTC() {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
}

/**
 * Add whole months, clamping the day to the target month's length
 * (31 Jan + 1 month = 28/29 Feb, not 3 Mar).
 */
export function addMonths(date, months) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  const target = new Date(Date.UTC(y, m + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target;
}

export function ageFrom(dob, now = todayUTC()) {
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < dob.getUTCMonth() ||
    (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/** Membership status from expiry; 'Inactive' (suspended by admin) always wins. */
export function deriveStatus(expiryDate, requested) {
  if (requested === 'Inactive') return 'Inactive';
  return expiryDate.getTime() >= todayUTC().getTime() ? 'Active' : 'Expired';
}

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
