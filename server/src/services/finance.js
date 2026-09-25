import { prisma } from '../db.js';
import { startOfMonth, startOfNextMonth } from '../lib/money.js';

const DUE_SOON_DAYS = 5;

/**
 * Turns recurring transactions into one bill per payee.
 * Pure function (no DB) so it can be unit-tested.
 * @param transactions recurring expense transactions, newest first
 */
export function buildRecurringBills(transactions, today = new Date()) {
  const monthStart = startOfMonth(today);
  const nextMonth = startOfNextMonth(today);
  const byName = new Map();

  for (const t of transactions) {
    if (t.amountCents >= 0) continue;
    const key = t.name.trim().toLowerCase();
    if (!byName.has(key)) byName.set(key, { latest: t, paidThisMonth: false });
    if (t.date >= monthStart && t.date < nextMonth) byName.get(key).paidThisMonth = true;
  }

  return [...byName.values()].map(({ latest, paidThisMonth }) => {
    const dueDay = latest.date.getDate();
    const daysUntilDue = dueDay - today.getDate();
    let status = 'upcoming';
    if (paidThisMonth) status = 'paid';
    else if (daysUntilDue < 0) status = 'overdue';
    else if (daysUntilDue <= DUE_SOON_DAYS) status = 'dueSoon';

    return {
      id: latest.id,
      name: latest.name,
      category: latest.category,
      amountCents: -latest.amountCents,
      dueDay,
      lastPaid: latest.date,
      status,
    };
  });
}

export function summarizeBills(bills) {
  const sum = (list) => ({ count: list.length, totalCents: list.reduce((s, b) => s + b.amountCents, 0) });
  return {
    totalCents: sum(bills).totalCents,
    paid: sum(bills.filter((b) => b.status === 'paid')),
    // Everything not yet paid this month, including due-soon and overdue bills
    upcoming: sum(bills.filter((b) => b.status !== 'paid')),
    dueSoon: sum(bills.filter((b) => b.status === 'dueSoon')),
    overdue: sum(bills.filter((b) => b.status === 'overdue')),
  };
}

export async function getRecurringBills(userId) {
  const transactions = await prisma.transaction.findMany({
    where: { userId, recurring: true, amountCents: { lt: 0 } },
    orderBy: { date: 'desc' },
  });
  return buildRecurringBills(transactions);
}

// Money in pots is set aside, so it's excluded from the spendable balance.
export async function getBalanceCents(userId) {
  const [tx, pots] = await Promise.all([
    prisma.transaction.aggregate({ where: { userId, pending: false }, _sum: { amountCents: true } }),
    prisma.pot.aggregate({ where: { userId }, _sum: { totalCents: true } }),
  ]);
  return (tx._sum.amountCents ?? 0) - (pots._sum.totalCents ?? 0);
}

export async function getMonthTotals(userId, date = new Date()) {
  const where = { userId, date: { gte: startOfMonth(date), lt: startOfNextMonth(date) } };
  const [income, expenses] = await Promise.all([
    prisma.transaction.aggregate({ where: { ...where, amountCents: { gt: 0 } }, _sum: { amountCents: true } }),
    prisma.transaction.aggregate({ where: { ...where, amountCents: { lt: 0 } }, _sum: { amountCents: true } }),
  ]);
  return { incomeCents: income._sum.amountCents ?? 0, expensesCents: -(expenses._sum.amountCents ?? 0) };
}

// This month's spending per category, as positive cents: { Bills: 75000, ... }
export async function getMonthSpendingByCategory(userId, date = new Date()) {
  const groups = await prisma.transaction.groupBy({
    by: ['category'],
    where: { userId, amountCents: { lt: 0 }, date: { gte: startOfMonth(date), lt: startOfNextMonth(date) } },
    _sum: { amountCents: true },
  });
  return Object.fromEntries(groups.map((g) => [g.category, -(g._sum.amountCents ?? 0)]));
}

export async function getBudgetsWithSpending(userId) {
  const [budgets, spending] = await Promise.all([
    prisma.budget.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    getMonthSpendingByCategory(userId),
  ]);
  return Promise.all(
    budgets.map(async (b) => ({
      ...b,
      spentCents: spending[b.category] ?? 0,
      latestSpending: await prisma.transaction.findMany({
        where: { userId, category: b.category, amountCents: { lt: 0 } },
        orderBy: { date: 'desc' },
        take: 3,
      }),
    })),
  );
}
