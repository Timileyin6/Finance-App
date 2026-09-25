import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { THEME_COLORS } from '../lib/categories.js';
import { HttpError, notFound } from '../lib/errors.js';
import { toCents } from '../lib/money.js';
import { getBalanceCents } from '../services/finance.js';

const router = Router();

const potSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(30, 'Keep the name under 30 characters'),
  target: z.coerce.number({ error: 'Enter a target' }).positive('Target must be more than 0').max(1_000_000_000),
  theme: z.enum(THEME_COLORS, { error: 'Pick a theme colour' }),
});
const moveSchema = z.object({
  amount: z.coerce.number({ error: 'Enter an amount' }).positive('Amount must be more than 0').max(1_000_000_000),
});

async function findOwned(userId, id) {
  const pot = await prisma.pot.findFirst({ where: { id, userId } });
  if (!pot) throw notFound('Pot');
  return pot;
}

router.get('/', async (req, res) => {
  res.json(await prisma.pot.findMany({ where: { userId: req.userId }, orderBy: { createdAt: 'asc' } }));
});

router.post('/', async (req, res) => {
  const { name, target, theme } = potSchema.parse(req.body);
  const pot = await prisma.pot.create({ data: { name, theme, targetCents: toCents(target), userId: req.userId } });
  res.status(201).json(pot);
});

router.put('/:id', async (req, res) => {
  const pot = await findOwned(req.userId, req.params.id);
  const { name, target, theme } = potSchema.parse(req.body);
  res.json(await prisma.pot.update({ where: { id: pot.id }, data: { name, theme, targetCents: toCents(target) } }));
});

// Deleting a pot returns its money to the main balance (balance = transactions − pots).
router.delete('/:id', async (req, res) => {
  const pot = await findOwned(req.userId, req.params.id);
  await prisma.pot.delete({ where: { id: pot.id } });
  res.status(204).end();
});

router.post('/:id/deposit', async (req, res) => {
  const pot = await findOwned(req.userId, req.params.id);
  const cents = toCents(moveSchema.parse(req.body).amount);
  const balance = await getBalanceCents(req.userId);
  if (cents > balance) throw new HttpError(400, 'You don’t have that much available in your balance');
  res.json(await prisma.pot.update({ where: { id: pot.id }, data: { totalCents: { increment: cents } } }));
});

router.post('/:id/withdraw', async (req, res) => {
  const pot = await findOwned(req.userId, req.params.id);
  const cents = toCents(moveSchema.parse(req.body).amount);
  // Conditional update so two simultaneous withdrawals can't take the pot below zero
  const { count } = await prisma.pot.updateMany({
    where: { id: pot.id, totalCents: { gte: cents } },
    data: { totalCents: { decrement: cents } },
  });
  if (count === 0) throw new HttpError(400, 'You can’t withdraw more than is in the pot');
  res.json(await prisma.pot.findUnique({ where: { id: pot.id } }));
});

export default router;
