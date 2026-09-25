export const CATEGORIES = [
  'Entertainment',
  'Bills',
  'Groceries',
  'Dining Out',
  'Transportation',
  'Personal Care',
  'Education',
  'Lifestyle',
  'Shopping',
  'Income',
  'Transfer',
  'General',
];

export const THEMES = [
  { name: 'Green', color: '#277C78' },
  { name: 'Yellow', color: '#F2CDAC' },
  { name: 'Cyan', color: '#82C9D7' },
  { name: 'Navy', color: '#626070' },
  { name: 'Red', color: '#C94736' },
  { name: 'Purple', color: '#826CB0' },
  { name: 'Turquoise', color: '#597C7C' },
  { name: 'Brown', color: '#93674F' },
  { name: 'Magenta', color: '#934F6F' },
  { name: 'Blue', color: '#3F82B2' },
  { name: 'Navy Grey', color: '#97A0AC' },
  { name: 'Army Green', color: '#7F9161' },
  { name: 'Gold', color: '#CAB361' },
  { name: 'Orange', color: '#BE6C49' },
];

export const THEME_COLORS = THEMES.map((t) => t.color);

// Nigerian bank narrations are free text ("POS PURCHASE @ SHOPRITE LEKKI", "TRF FROM ADA OKAFOR"),
// so imported transactions are categorised by keyword. Order matters: first match wins.
// Anything miscategorised can be fixed by the user on the Transactions page.
const KEYWORD_RULES = [
  ['Income', /\b(salary|payroll|wages|dividend|interest earned|refund|reversal)\b/],
  ['Bills', /\b(airtime|data bundle|recharge|mtn|glo|airtel|9mobile|electricity|ikedc|ekedc|aedc|phed|ibedc|eedc|kedco|prepaid meter|dstv|gotv|startimes|showmax|multichoice|internet|spectranet|smile|lawma|water|rent|bank charges?|sms alert|stamp duty|maintenance fee|vat|loan|repayment|insurance)\b/],
  ['Transportation', /\b(uber|bolt|taxify|indrive|rida|lag ride|brt|fuel|petrol|filling station|nnpc|total ?energies|mobil|conoil|ardova|transport|parking|toll|air peace|arik|ibom air|flight)\b/],
  ['Groceries', /\b(shoprite|spar|justrite|market square|ebeano|prince ebeano|supermarket|grocer(y|ies)|foodstuff|market)\b/],
  ['Dining Out', /\b(restaurant|eatery|chicken republic|kfc|domino'?s|dominos|mr bigg'?s|tantalizers|sweet sensation|coldstone|cafe|bukka|suya|chowdeck|glovo|food)\b/],
  ['Entertainment', /\b(netflix|spotify|apple music|audiomack|youtube|cinema|filmhouse|genesis|silverbird|bet9ja|sportybet|betking|1xbet|nairabet|playstation|steam|game)\b/],
  ['Education', /\b(school|tuition|university|college|waec|jamb|neco|course|udemy|coursera|books?)\b/],
  ['Personal Care', /\b(pharmacy|pharma|hospital|clinic|medical|lab|salon|barb(er|ing)|spa|gym|fitness|hmo)\b/],
  ['Shopping', /\b(jumia|konga|temu|aliexpress|amazon|mall|boutique|store|shop|pos purchase|pos pur|posweb|web purchase|online purchase)\b/],
  ['Transfer', /\b(trf|transfer|nip|ussd|mobile trf|payment outward|payment inward|instant payment|between customers|opay|palmpay|moniepoint|kuda)\b/],
];

/**
 * @param monoCategory Mono's own category label, if any (e.g. "bank_charges")
 * @param narration    the bank's description text
 * @param isCredit     money coming in
 */
export function categorize(monoCategory, narration, isCredit) {
  const text = `${monoCategory ?? ''} ${narration ?? ''}`.toLowerCase().replace(/[_-]/g, ' ');
  for (const [category, pattern] of KEYWORD_RULES) {
    if (pattern.test(text)) return category;
  }
  return isCredit ? 'Income' : 'General';
}
