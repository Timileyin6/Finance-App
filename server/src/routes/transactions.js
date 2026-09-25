import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { CATEGORIES } from '../lib/categories.js';
import { HttpError, notFound } from '../lib/errors.js';
import { startOfMonth, startOfNextMonth, toCents } from '../lib/money.js';

const router = Router();

const SORTS = {
  latest: [{ date: 'desc' }, { createdAt: 'desc' }],
  oldest: [{ date: 'asc' }, { createdAt: 'asc' }],
  'a-z': [{ name: 'asc' }],
  'z-a': [{ name: 'desc' }],
  highest: [{ amountCents: 'desc' }],
  lowest: [{ amountCents: 'asc' }],
};

const listSchema = z.object({
  search: z.string().trim().max(100).default(''),
  category: z.enum(['all', ...CATEGORIES]).default('all'),
  sort: z.enum(Object.keys(SORTS)).default('latest'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

const counterparty = z
  .string()
  .trim()
  .max(120)
  .nullish()
  .transform((v) => v || null);

// Every transfer must say who it went to (or came from)
const requireTransferParty = (schema) =>
  schema.refine((t) => t.category !== 'Transfer' || t.counterparty, {
    message: 'Say who this transfer is to (or from)',
    path: ['counterparty'],
  });

const manualSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  category: z.enum(CATEGORIES, { error: 'Pick a category' }),
  type: z.enum(['income', 'expense']),
  amount: z.coerce.number({ error: 'Enter an amount' }).positive('Amount must be more than 0').max(1_000_000_000),
  // A bare YYYY-MM-DD is pinned to midday so it shows as the same day in every timezone
  date: z.preprocess(
    (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T12:00:00` : v),
    z.coerce.date({ error: 'Enter a valid date' }),
  ),
  recurring: z.boolean().default(false),
  isCash: z.boolean().default(false),
  counterparty,
});

// Imported transactions (bank statement / Mono) mirror the bank; only these fields are user-editable.
const importedSchema = z.object({
  category: z.enum(CATEGORIES),
  recurring: z.boolean(),
  counterparty,
});

const toRecord = ({ type, amount, ...rest }) => ({
  ...rest,
  amountCents: type === 'expense' ? -toCents(amount) : toCents(amount),
});

async function findOwned(userId, id) {
  const tx = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!tx) throw notFound('Transaction');
  return tx;
}

router.get('/', async (req, res) => {
  const q = listSchema.parse(req.query);
  const where = {
    userId: req.userId,
    ...(q.category !== 'all' && { category: q.category }),
    ...(q.search && {
      OR: ['name', 'counterparty', 'bankNarration'].map((field) => ({
        [field]: { contains: q.search, ...(config.isPostgres && { mode: 'insensitive' }) },
      })),
    }),
  };
  const [items, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: SORTS[q.sort],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: { connection: { select: { institutionName: true } }, statement: { select: { bankName: true } } },
    }),
    prisma.transaction.count({ where }),
  ]);
  res.json({ items, total, page: q.page, pageSize: q.pageSize, pageCount: Math.max(1, Math.ceil(total / q.pageSize)) });
});

// This month's money in/out, broken down by category (for the charts).
router.get('/stats', async (req, res) => {
  const where = { userId: req.userId, date: { gte: startOfMonth(), lt: startOfNextMonth() } };
  const [received, spent] = await Promise.all([
    prisma.transaction.groupBy({ by: ['category'], where: { ...where, amountCents: { gt: 0 } }, _sum: { amountCents: true } }),
    prisma.transaction.groupBy({ by: ['category'], where: { ...where, amountCents: { lt: 0 } }, _sum: { amountCents: true } }),
  ]);
  const shape = (groups) =>
    groups
      .map((g) => ({ category: g.category, amountCents: Math.abs(g._sum.amountCents ?? 0) }))
      .sort((a, b) => b.amountCents - a.amountCents);
  const receivedByCategory = shape(received);
  const spentByCategory = shape(spent);
  const total = (list) => list.reduce((s, c) => s + c.amountCents, 0);
  res.json({
    receivedCents: total(receivedByCategory),
    spentCents: total(spentByCategory),
    receivedByCategory,
    spentByCategory,
  });
});

router.post('/', async (req, res) => {
  const data = toRecord(requireTransferParty(manualSchema).parse(req.body));
  const tx = await prisma.transaction.create({ data: { ...data, userId: req.userId, source: 'manual' } });
  res.status(201).json(tx);
});

router.put('/:id', async (req, res) => {
  const existing = await findOwned(req.userId, req.params.id);
  const data =
    existing.source === 'manual'
      ? toRecord(requireTransferParty(manualSchema).parse(req.body))
      : requireTransferParty(importedSchema).parse(req.body);
  res.json(await prisma.transaction.update({ where: { id: existing.id }, data }));
});

router.delete('/:id', async (req, res) => {
  const existing = await findOwned(req.userId, req.params.id);
  if (existing.source !== 'manual') {
    throw new HttpError(
      400,
      existing.source === 'statement'
        ? 'Statement transactions can’t be deleted one by one. Remove the whole statement on the Monthly Report page.'
        : 'Bank-imported transactions can’t be deleted: they mirror your bank statement',
    );
  }
  await prisma.transaction.delete({ where: { id: existing.id } });
  res.status(204).end();
});

export default router;
