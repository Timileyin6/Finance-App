import { Router } from 'express';
import { prisma } from '../db.js';
import {
  getBalanceCents,
  getBudgetsWithSpending,
  getMonthTotals,
  getRecurringBills,
  summarizeBills,
} from '../services/finance.js';

const router = Router();

router.get('/', async (req, res) => {
  const userId = req.userId;
  const [balanceCents, month, pots, budgets, bills, latestTransactions] = await Promise.all([
    getBalanceCents(userId),
    getMonthTotals(userId),
    prisma.pot.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    getBudgetsWithSpending(userId),
    getRecurringBills(userId),
    prisma.transaction.findMany({ where: { userId }, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], take: 5 }),
  ]);

  res.json({
    balanceCents,
    ...month,
    pots: { totalSavedCents: pots.reduce((s, p) => s + p.totalCents, 0), items: pots.slice(0, 4) },
    budgets: budgets.map(({ latestSpending: _unused, ...b }) => b),
    recurring: summarizeBills(bills),
    latestTransactions,
  });
});

export default router;
