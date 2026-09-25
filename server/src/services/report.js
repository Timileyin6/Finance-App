// Monthly report maths. The pure functions (no DB) are exported for unit tests.
import { prisma } from '../db.js';
import { looksLikeSubscription, looksLikeTransfer, merchantName } from '../lib/merchants.js';

const DAY = 24 * 60 * 60 * 1000;
const TRANSFER_WINDOW_DAYS = 2;
const MATCH_WINDOW_DAYS = 3;
const SUBSCRIPTION_LOOKBACK_MONTHS = 3;
const SAME_AMOUNT_TOLERANCE = 0.1;

export function monthRange(month) {
  const [y, m] = month.split('-').map(Number);
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
}

const isImported = (t) => t.source === 'statement' || t.source === 'bank';
// Which account a transaction came from: each uploaded bank, or each Mono connection
const accountKey = (t) =>
  t.source === 'statement' ? `stmt:${t.statement?.bankName ?? t.statementId}` : t.source === 'bank' ? `mono:${t.connectionId}` : 'manual';
const daysApart = (a, b) => Math.abs(new Date(a).getTime() - new Date(b).getTime()) / DAY;

/**
 * Money moved between the user's own accounts (out of GTBank, into Kuda) is neither spending nor income.
 * Pairs an outflow with an equal inflow at a different bank within 2 days, where one side looks like a transfer.
 */
export function findInternalTransfers(transactions) {
  const outs = transactions.filter((t) => isImported(t) && t.amountCents < 0);
  const ins = transactions.filter((t) => isImported(t) && t.amountCents > 0);
  const paired = new Set();
  const pairs = [];
  for (const out of outs) {
    const match = ins
      .filter(
        (i) =>
          !paired.has(i.id) &&
          i.amountCents === -out.amountCents &&
          accountKey(i) !== accountKey(out) &&
          daysApart(i.date, out.date) <= TRANSFER_WINDOW_DAYS &&
          (looksLikeTransfer(out.bankNarration ?? out.name) || looksLikeTransfer(i.bankNarration ?? i.name)),
      )
      .sort((a, b) => daysApart(a.date, out.date) - daysApart(b.date, out.date))[0];
    if (match) {
      paired.add(match.id);
      paired.add(out.id);
      pairs.push({ out, in: match });
    }
  }
  return { ids: paired, pairs, totalCents: pairs.reduce((s, p) => s + p.in.amountCents, 0) };
}

export function cashFlow(transactions) {
  const inflowCents = transactions.filter((t) => t.amountCents > 0).reduce((s, t) => s + t.amountCents, 0);
  const outflowCents = transactions.filter((t) => t.amountCents < 0).reduce((s, t) => s - t.amountCents, 0);
  const netCents = inflowCents - outflowCents;
  return {
    inflowCents,
    outflowCents,
    netCents,
    overspent: netCents < 0,
    // "You spent 12.4% more than you earned" / "You kept 23% of what you earned"
    percent: inflowCents > 0 ? Math.round((Math.abs(netCents) / inflowCents) * 1000) / 10 : null,
  };
}

/** "You ordered from Chowdeck 14 times this month": outflows grouped by merchant, most frequent first. */
export function findTriggers(transactions, limit = 8) {
  const groups = new Map();
  for (const t of transactions) {
    if (t.amountCents >= 0) continue;
    // Transfers group by the person they went to ("You sent Tunde money 6 times")
    const merchant = t.counterparty ?? merchantName(t.name);
    const g = groups.get(merchant) ?? { merchant, count: 0, totalCents: 0, categories: {} };
    g.count++;
    g.totalCents -= t.amountCents;
    g.categories[t.category] = (g.categories[t.category] ?? 0) + 1;
    groups.set(merchant, g);
  }
  return [...groups.values()]
    .filter((g) => g.count >= 2 && g.merchant !== 'Other')
    .sort((a, b) => b.count - a.count || b.totalCents - a.totalCents)
    .slice(0, limit)
    .map(({ categories, ...g }) => ({
      ...g,
      averageCents: Math.round(g.totalCents / g.count),
      category: Object.entries(categories).sort((a, b) => b[1] - a[1])[0][0],
    }));
}

/**
 * Recurring fixed costs: a known subscription (Netflix, DStv…), something the user marked recurring,
 * or a merchant charged a similar amount in an earlier month but only once or twice this month.
 * @param history outflows from the previous few months
 */
export function detectSubscriptions(transactions, history) {
  const monthOuts = transactions.filter((t) => t.amountCents < 0);
  const byMerchant = new Map();
  for (const t of monthOuts) {
    const merchant = merchantName(t.name);
    if (!byMerchant.has(merchant)) byMerchant.set(merchant, []);
    byMerchant.get(merchant).push(t);
  }

  const items = [];
  for (const [merchant, charges] of byMerchant) {
    if (merchant === 'Other') continue;
    const latest = charges.reduce((a, b) => (new Date(a.date) > new Date(b.date) ? a : b));
    const amount = -latest.amountCents;
    const known = charges.some((t) => looksLikeSubscription(t.name) || looksLikeSubscription(t.bankNarration));
    const marked = charges.some((t) => t.recurring);
    const repeats =
      charges.length <= 2 &&
      history.some(
        (h) => h.amountCents < 0 && merchantName(h.name) === merchant && Math.abs(-h.amountCents - amount) <= amount * SAME_AMOUNT_TOLERANCE,
      );
    if (!known && !marked && !repeats) continue;
    // Frequent variable spending (e.g. Bolt 9×) isn't a fixed cost unless the user says so
    if (charges.length > 2 && !marked) continue;
    items.push({
      merchant,
      category: latest.category,
      monthlyCents: amount,
      annualCents: amount * 12,
      lastCharged: latest.date,
      reason: marked ? 'marked' : known ? 'known' : 'repeats',
    });
  }
  items.sort((a, b) => b.annualCents - a.annualCents);
  return {
    items,
    totalMonthlyCents: items.reduce((s, i) => s + i.monthlyCents, 0),
    totalAnnualCents: items.reduce((s, i) => s + i.annualCents, 0),
  };
}

/**
 * "We found a bank charge matching your manual ₦3,200 'Lunch' log. Are these the same?"
 * Manual, non-cash entries vs imported ones: same amount and direction, within 3 days.
 * Cash payments are skipped: they never show up on a bank statement.
 */
export function findMatches(transactions, dismissed = new Set()) {
  const manual = transactions.filter((t) => t.source === 'manual' && !t.isCash);
  const imported = transactions.filter(isImported);
  const used = new Set();
  const matches = [];
  for (const m of manual) {
    const candidate = imported
      .filter(
        (i) =>
          !used.has(i.id) &&
          i.amountCents === m.amountCents &&
          daysApart(i.date, m.date) <= MATCH_WINDOW_DAYS &&
          !dismissed.has(`${m.id}:${i.id}`),
      )
      .sort((a, b) => daysApart(a.date, m.date) - daysApart(b.date, m.date))[0];
    if (candidate) {
      used.add(candidate.id);
      matches.push({ manual: m, imported: candidate });
    }
  }
  return matches;
}

function spendingByCategory(transactions) {
  const totals = {};
  for (const t of transactions) {
    if (t.amountCents < 0) totals[t.category] = (totals[t.category] ?? 0) - t.amountCents;
  }
  return totals;
}

export async function buildMonthlyReport(userId, month) {
  const { start, end } = monthRange(month);
  const lookbackStart = new Date(start.getFullYear(), start.getMonth() - SUBSCRIPTION_LOOKBACK_MONTHS, 1);
  const include = { statement: { select: { bankName: true } }, connection: { select: { institutionName: true } } };

  const [all, history, budgets, statements, dismissedRows] = await Promise.all([
    // Match window reaches a few days either side of the month
    prisma.transaction.findMany({
      where: { userId, pending: false, date: { gte: new Date(start.getTime() - MATCH_WINDOW_DAYS * DAY), lt: new Date(end.getTime() + MATCH_WINDOW_DAYS * DAY) } },
      include,
      orderBy: { date: 'asc' },
    }),
    prisma.transaction.findMany({
      where: { userId, pending: false, amountCents: { lt: 0 }, date: { gte: lookbackStart, lt: start } },
      select: { name: true, amountCents: true },
    }),
    prisma.budget.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.statementUpload.findMany({ where: { userId, month }, orderBy: { createdAt: 'asc' } }),
    prisma.dismissedMatch.findMany({ where: { userId }, select: { manualId: true, importedId: true } }),
  ]);

  const inMonth = all.filter((t) => t.date >= start && t.date < end);
  const internal = findInternalTransfers(inMonth);
  const counted = inMonth.filter((t) => !internal.ids.has(t.id));
  const spending = spendingByCategory(counted);
  const dismissed = new Set(dismissedRows.map((d) => `${d.manualId}:${d.importedId}`));
  const cashOuts = counted.filter((t) => t.isCash && t.amountCents < 0);

  const matches = findMatches(all, dismissed).filter(
    ({ manual, imported }) => (manual.date >= start && manual.date < end) || (imported.date >= start && imported.date < end),
  );

  return {
    month,
    transactionCount: inMonth.length,
    statements,
    cashFlow: cashFlow(counted),
    internalTransfers: { count: internal.pairs.length, totalCents: internal.totalCents },
    cash: { count: cashOuts.length, totalCents: cashOuts.reduce((s, t) => s - t.amountCents, 0) },
    categories: Object.entries(spending)
      .map(([category, amountCents]) => ({ category, amountCents }))
      .sort((a, b) => b.amountCents - a.amountCents),
    triggers: findTriggers(counted),
    subscriptions: detectSubscriptions(counted, history),
    budgets: budgets.map((b) => ({
      id: b.id,
      category: b.category,
      theme: b.theme,
      maximumCents: b.maximumCents,
      spentCents: spending[b.category] ?? 0,
    })),
    matches: matches.map(({ manual, imported }) => ({ manual, imported })),
  };
}
