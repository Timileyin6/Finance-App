import { Router } from 'express';
import crypto from 'node:crypto';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../db.js';
import { categorize } from '../lib/categories.js';
import { extractCounterparty, tidyNarration } from '../lib/merchants.js';
import { HttpError, notFound } from '../lib/errors.js';
import { toDateKey } from '../lib/money.js';
import { monthRange } from '../services/report.js';
import { parseStatementFile } from '../services/statements.js';

const router = Router();

const MAX_FILES = 10;
const upload = multer({
  storage: multer.memoryStorage(), // parsed in memory, never written to disk
  limits: { fileSize: 10 * 1024 * 1024, files: MAX_FILES },
});

export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must look like 2026-09');
const uploadSchema = z.object({
  month: monthSchema,
  bankName: z.string().trim().max(60).optional().default(''),
  password: z.string().max(100).optional().default(''),
});

// Same statement uploaded twice (or overlapping statements) must not double-count.
// A row's identity: bank + day + amount + description, plus how many identical rows came before it.
function fingerprint(bank, t, occurrence) {
  const description = t.description.toLowerCase().replace(/[^a-z0-9]/g, '');
  const key = `${bank.toLowerCase()}|${toDateKey(t.date)}|${t.amountMinor}|${description}|${occurrence}`;
  return `stmt:${crypto.createHash('sha256').update(key).digest('hex').slice(0, 40)}`;
}

router.get('/', async (req, res) => {
  const month = monthSchema.parse(req.query.month);
  res.json(await prisma.statementUpload.findMany({ where: { userId: req.userId, month }, orderBy: { createdAt: 'asc' } }));
});

router.post('/', upload.array('files', MAX_FILES), async (req, res) => {
  const { month, bankName, password } = uploadSchema.parse(req.body);
  if (!req.files?.length) throw new HttpError(400, 'Choose at least one statement file');
  const { start, end } = monthRange(month);

  const results = [];
  for (const file of req.files) {
    const fileName = Buffer.from(file.originalname, 'latin1').toString('utf8').slice(0, 200);
    try {
      const parsed = await parseStatementFile({ buffer: file.buffer, fileName, password });
      const bank = bankName || parsed.bankName || 'Bank';
      const inMonth = parsed.transactions.filter((t) => t.date >= start && t.date < end);

      const occurrences = new Map();
      const rows = inMonth.map((t) => {
        const base = `${toDateKey(t.date)}|${t.amountMinor}|${t.description}`;
        const n = (occurrences.get(base) ?? 0) + 1;
        occurrences.set(base, n);
        return { ...t, externalId: fingerprint(bank, t, n) };
      });
      const existing = await prisma.transaction.findMany({
        where: { userId: req.userId, externalId: { in: rows.map((r) => r.externalId) } },
        select: { externalId: true },
      });
      const known = new Set(existing.map((e) => e.externalId));
      const fresh = rows.filter((r) => !known.has(r.externalId));

      const summary = {
        fileName,
        ok: true,
        bankName: bank,
        imported: fresh.length,
        duplicates: rows.length - fresh.length,
        outsideMonth: parsed.transactions.length - inMonth.length,
        skipped: parsed.skipped,
      };
      if (fresh.length > 0) {
        const statement = await prisma.$transaction(async (tx) => {
          const created = await tx.statementUpload.create({
            data: { userId: req.userId, month, bankName: bank, fileName, rowsImported: fresh.length, rowsSkipped: parsed.skipped },
          });
          await tx.transaction.createMany({
            data: fresh.map((t) => {
              const isCredit = t.amountMinor > 0;
              const category = categorize(null, t.description, isCredit);
              return {
                userId: req.userId,
                statementId: created.id,
                source: 'statement',
                externalId: t.externalId,
                name: (tidyNarration(t.description) || t.description).slice(0, 120),
                bankNarration: t.description.slice(0, 500),
                category,
                counterparty: category === 'Transfer' ? extractCounterparty(t.description, isCredit) : null,
                amountCents: t.amountMinor,
                date: t.date,
              };
            }),
          });
          return created;
        });
        summary.statementId = statement.id;
      }
      results.push(summary);
    } catch (err) {
      if (!(err instanceof HttpError)) console.error(`[statements] failed to parse ${fileName}:`, err);
      results.push({
        fileName,
        ok: false,
        error: err instanceof HttpError ? err.message : `${fileName}: something went wrong reading this file`,
        needsPassword: Boolean(err.details?.needsPassword),
      });
    }
  }
  res.status(results.some((r) => r.ok) ? 201 : 400).json({ results });
});

// Removes the upload and every transaction it imported.
router.delete('/:id', async (req, res) => {
  const statement = await prisma.statementUpload.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!statement) throw notFound('Statement');
  await prisma.statementUpload.delete({ where: { id: statement.id } });
  res.status(204).end();
});

export default router;
