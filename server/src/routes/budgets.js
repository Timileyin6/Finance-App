import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { CATEGORIES, THEME_COLORS } from '../lib/categories.js';
import { HttpError, notFound } from '../lib/errors.js';
import { toCents } from '../lib/money.js';
import { getBudgetsWithSpending } from '../services/finance.js';

const router = Router();

const budgetSchema = z.object({
  category: z.enum(CATEGORIES, { error: 'Pick a category' }),
  maximum: z.coerce.number({ error: 'Enter a maximum spend' }).positive('Maximum must be more than 0').max(1_000_000_000),
  theme: z.enum(THEME_COLORS, { error: 'Pick a theme colour' }),
});

const toRecord = ({ maximum, ...rest }) => ({ ...rest, maximumCents: toCents(maximum) });

async function assertCategoryFree(userId, category, exceptId) {
  const clash = await prisma.budget.findFirst({ where: { userId, category, ...(exceptId && { NOT: { id: exceptId } }) } });
  if (clash) throw new HttpError(409, `You already have a budget for ${category}`);
}

async function findOwned(userId, id) {
  const budget = await prisma.budget.findFirst({ where: { id, userId } });
  if (!budget) throw notFound('Budget');
  return budget;
}

router.get('/', async (req, res) => {
  res.json(await getBudgetsWithSpending(req.userId));
});

router.post('/', async (req, res) => {
  const data = toRecord(budgetSchema.parse(req.body));
  await assertCategoryFree(req.userId, data.category);
  res.status(201).json(await prisma.budget.create({ data: { ...data, userId: req.userId } }));
});

router.put('/:id', async (req, res) => {
  const budget = await findOwned(req.userId, req.params.id);
  const data = toRecord(budgetSchema.parse(req.body));
  await assertCategoryFree(req.userId, data.category, budget.id);
  res.json(await prisma.budget.update({ where: { id: budget.id }, data }));
});

router.delete('/:id', async (req, res) => {
  const budget = await findOwned(req.userId, req.params.id);
  await prisma.budget.delete({ where: { id: budget.id } });
  res.status(204).end();
});

export default router;
