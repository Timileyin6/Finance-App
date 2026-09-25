import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { HttpError } from '../lib/errors.js';
import { toDateKey } from '../lib/money.js';
import { buildMonthlyReport } from '../services/report.js';
import { monthSchema } from './statements.js';

const router = Router();

const pairSchema = z.object({ manualId: z.string().min(1), importedId: z.string().min(1) });

async function loadPair(userId, body) {
  const { manualId, importedId } = pairSchema.parse(body);
  const [manual, imported] = await Promise.all([
    prisma.transaction.findFirst({ where: { id: manualId, userId, source: 'manual' } }),
    prisma.transaction.findFirst({ where: { id: importedId, userId, source: { in: ['statement', 'bank'] } } }),
  ]);
  if (!manual || !imported) throw new HttpError(404, 'One of those transactions no longer exists');
  return { manual, imported };
}

router.get('/monthly', async (req, res) => {
  const month = req.query.month ? monthSchema.parse(req.query.month) : toDateKey(new Date()).slice(0, 7);
  res.json(await buildMonthlyReport(req.userId, month));
});

// "Yes, same payment": keep the bank's record (it's the source of truth for amount and date)
// but give it the user's name and category, then remove the manual duplicate.
router.post('/matches/merge', async (req, res) => {
  const { manual, imported } = await loadPair(req.userId, req.body);
  const [merged] = await prisma.$transaction([
    prisma.transaction.update({
      where: { id: imported.id },
      data: {
        name: manual.name,
        category: manual.category,
        recurring: manual.recurring || imported.recurring,
        counterparty: manual.counterparty ?? imported.counterparty,
        bankNarration: imported.bankNarration ?? imported.name,
      },
    }),
    prisma.transaction.delete({ where: { id: manual.id } }),
  ]);
  res.json(merged);
});

// "No, they're different": stop suggesting this pair.
router.post('/matches/dismiss', async (req, res) => {
  const { manual, imported } = await loadPair(req.userId, req.body);
  await prisma.dismissedMatch.upsert({
    where: { manualId_importedId: { manualId: manual.id, importedId: imported.id } },
    create: { userId: req.userId, manualId: manual.id, importedId: imported.id },
    update: {},
  });
  res.status(204).end();
});

export default router;
