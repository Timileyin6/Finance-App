// Turns messy bank narrations into a merchant name that can be grouped and counted,
// e.g. "POS PURCHASE @ CHOWDECK TECH LAGOS 29381" and "WEB PMT CHOWDECK" → "Chowdeck".

// [display name, pattern]. Checked first, so well-known merchants always group together.
const KNOWN_MERCHANTS = [
  ['Chowdeck', /chowdeck/],
  ['Glovo', /glovo/],
  ['Bolt', /\bbolt\b|taxify/],
  ['Uber', /\buber\b/],
  ['inDrive', /indrive/],
  ['Shoprite', /shoprite/],
  ['Spar', /\bspar\b/],
  ['Justrite', /justrite/],
  ['Ebeano', /ebeano/],
  ['Jumia', /jumia/],
  ['Konga', /konga/],
  ['Temu', /\btemu\b/],
  ['Chicken Republic', /chicken republic/],
  ['KFC', /\bkfc\b/],
  ["Domino's", /domino/],
  ['Cold Stone', /cold ?stone/],
  ['Netflix', /netflix/],
  ['Spotify', /spotify/],
  ['Apple', /apple\.com|itunes|icloud|apple music/],
  ['YouTube Premium', /youtube/],
  ['Google', /google/],
  ['Showmax', /showmax/],
  ['DStv', /\bdstv\b/],
  ['GOtv', /\bgotv\b/],
  ['StarTimes', /startimes/],
  ['Amazon Prime', /prime video|amazon prime/],
  ['ChatGPT', /openai|chatgpt/],
  ['Canva', /canva/],
  ['Audiomack', /audiomack/],
  ['Boomplay', /boomplay/],
  ['MTN', /\bmtn\b/],
  ['Airtel', /airtel/],
  ['Glo', /\bglo\b/],
  ['9mobile', /9mobile|etisalat/],
  ['IKEDC', /ikedc|ikeja electric/],
  ['EKEDC', /ekedc|eko electric/],
  ['AEDC', /aedc|abuja electric/],
  ['Spectranet', /spectranet/],
  ['Bet9ja', /bet9ja/],
  ['SportyBet', /sportybet/],
  ['BetKing', /betking/],
  ['SMS Alert Charges', /sms alert|sms charge/],
  ['Stamp Duty', /stamp duty/],
  ['Bank Charges', /maintenance fee|account maint|cot charge|transfer fee|nip charge|vat on/],
];

// Things that are fixed monthly costs by nature, even if seen only once.
const SUBSCRIPTION_MERCHANTS = new Set([
  'Netflix', 'Spotify', 'Apple', 'YouTube Premium', 'Showmax', 'DStv', 'GOtv', 'StarTimes',
  'Amazon Prime', 'ChatGPT', 'Canva', 'Audiomack', 'Boomplay', 'Spectranet',
]);
const SUBSCRIPTION_WORDS = /\b(subscription|membership|monthly plan|gym|fitness|premium|recurring)\b/;

// Leading noise banks put before the merchant or person
const PREFIXES = [
  /^posweb\b/,
  /^(purchase\s+)?transaction\b/,
  /^pos\s*pur(chase)?\b/,
  /^(opay|paystack|flutterwave|flw|interswitch|remita|quickteller|paga)\b/,
  /^(pos|web|online|card|atm)\s*(purchase|pmt|payment|tran|trans|txn|wdl|withdrawal)?\b/,
  /^(nip|nibss|mobile|ussd|fip|instant)\s*(trf|transfer|tfr)?\s*(to|from|frm)?\b/,
  /^(trf|tfr|transfer|trsf)\s*(to|from|frm)?\b/,
  /^(payment|pmt|bill ?payment|airtime|debit|credit|reversal)\s*(to|for|from)?\b/,
];

const titleCase = (text) => text.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

export function merchantName(narration) {
  const lower = String(narration ?? '').toLowerCase();
  for (const [name, pattern] of KNOWN_MERCHANTS) {
    if (pattern.test(lower)) return name;
  }

  let text = lower.replace(/[@|*#_]/g, ' ').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 3; i++) {
    const before = text;
    for (const prefix of PREFIXES) text = text.replace(prefix, '').replace(/^[\s:/-]+/, '');
    if (text === before) break;
  }
  const words = text
    .split(/[\s/,-]+/)
    .filter((w) => w.length > 1 && !/\d/.test(w) && !/^(ref|ng|ngn|lagos|lang|abuja|lg|nga|via|the|ltd|limited|plc)$/.test(w));
  return words.length ? titleCase(words.slice(0, 3).join(' ')) : 'Other';
}

export function looksLikeSubscription(narration) {
  const lower = String(narration ?? '').toLowerCase();
  return SUBSCRIPTION_MERCHANTS.has(merchantName(narration)) || SUBSCRIPTION_WORDS.test(lower);
}

export function looksLikeTransfer(narration) {
  return /\b(trf|tfr|transfer|nip|ussd|fip|mobile trf|own account|payment outward|payment inward)\b/i.test(String(narration ?? ''));
}

// Where the person's name ends: the receiving bank, a reference, or a separator
const NAME_STOPS =
  /\s*(?:\/|\||\s-\s|-(?=[a-z]{2,}\b)|\b(?:ref|reference|narration|being|for|via|kuda|mfb|gtb|gtbank|gtco|access|zenith|uba|first ?bank|fbn|opay|palmpay|moniepoint|fidelity|stanbic|sterling|wema|alat|fcmb|union|polaris|ecobank|keystone|providus|carbon|vfd|bank|savings|current|account|acct)\b).*$/i;

const TRANSFERISH = /\b(trf|tfr|trsf|transfer|nip|ussd|fip|mobile trf|payment outward|payment inward|instant payment|between customers)\b/i;

function cleanParty(raw) {
  if (!raw) return null;
  let text = raw.trim();
  // GTBank & co. write "<receiving bank> - <name>", e.g. "OPAY - IDIYAT RAMONI", "ACCESS - NEW HERITAGE CHURCH"
  const bankDash = text.match(/^([a-z0-9&.]+(?:\s[a-z0-9&.]+)?)\s+-\s+(.+)$/i);
  if (bankDash) text = bankDash[2];
  const words = text
    .replace(NAME_STOPS, '')
    .split(/[\s,]+/)
    .filter((w) => w && !/\d/.test(w) && !/^[^a-z]+$/i.test(w));
  // A name cut by a PDF line break: "ADETIMEHI N" → "ADETIMEHIN"
  if (words.length >= 2 && words.at(-1).length === 1 && words.at(-2).length >= 4) {
    const letter = words.pop();
    words.push(words.pop() + letter);
  }
  const name = words.slice(0, 4).join(' ');
  return name ? titleCase(name) : null;
}

/**
 * Pulls the person or business out of a transfer narration:
 *   "NIP TRF TO ADAEZE OKAFOR 0012345"                  → "Adaeze Okafor"
 *   "NIP TRANSFER TO OPAY - IDIYAT MOJISOLA RAMONI"     → "Idiyat Mojisola Ramoni"
 *   "… FROM FIFUNMI ADE TO TIMI ADE" (money in)         → "Fifunmi Ade" (money out → "Timi Ade")
 * Returns null if it isn't a transfer or no name can be found.
 */
export function extractCounterparty(narration, isCredit = false) {
  const text = String(narration ?? '').replace(/\s+/g, ' ').trim();
  if (!TRANSFERISH.test(text)) return null;
  const from = text.match(/\b(?:from|frm)\b[\s:]+(.+?)(?=\s+to\b|$)/i)?.[1];
  const to = text.match(/\bto\b[\s:]+(.+)$/i)?.[1];
  return isCredit ? cleanParty(from) ?? cleanParty(to) : cleanParty(to) ?? cleanParty(from);
}

/** Drops reference numbers and masked card numbers so the description is readable. */
export function tidyNarration(narration) {
  return String(narration ?? '')
    .split(/\s+/)
    .filter((token) => {
      const digits = (token.match(/\d/g) ?? []).length;
      return !(token.length >= 6 && digits / token.length >= 0.6) && !/\*{3,}/.test(token) && !/^'?\d{2,}[a-z]{2,4}$/i.test(token);
    })
    .join(' ')
    .replace(/\s+-\s+(?=-|$)/g, ' ')
    .trim();
}
