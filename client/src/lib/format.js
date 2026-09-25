let currency = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' });

/** Set once from the server's config (CURRENCY / LOCALE), before any amounts render. */
export function setCurrency(code, locale) {
  try {
    currency = new Intl.NumberFormat(locale, { style: 'currency', currency: code });
  } catch {
    // Unknown code/locale: keep the default
  }
}

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** Amounts are in minor units (kobo/cents): 750000 → "₦7,500.00". With signed: true, income gets "+" and expenses "-". */
export function formatMoney(cents, { signed = false } = {}) {
  const text = currency.format(Math.abs(cents) / 100);
  if (!signed) return cents < 0 ? `-${text}` : text;
  return cents > 0 ? `+${text}` : cents < 0 ? `-${text}` : text;
}

export const currencySymbol = () => currency.formatToParts(0).find((p) => p.type === 'currency')?.value ?? ''

export const formatDate = (value) => dateFormat.format(new Date(value));

export function ordinal(n) {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th';
  return `${n}${suffix}`;
}

/** For <input type="date">: a Date/ISO string → "YYYY-MM-DD" in local time. */
export function toDateInput(value = new Date()) {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const centsToInput = (cents) => (Math.abs(cents) / 100).toFixed(2);

export const percent = (part, whole) => (whole > 0 ? Math.min(100, (part / whole) * 100) : 0);
