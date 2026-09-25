import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { HttpError, notFound } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { exchangeCode, getAccountDetails, requireMono, syncConnection, unlinkAccount } from '../services/mono.js';

const router = Router();

const publicConnection = ({ id, institutionName, accountName, accountMask, lastSyncedAt, lastError, createdAt }) => ({
  id,
  institutionName,
  accountName,
  accountMask,
  lastSyncedAt,
  lastError,
  createdAt,
});

async function findOwned(userId, id) {
  const connection = await prisma.bankConnection.findFirst({ where: { id, userId } });
  if (!connection) throw notFound('Bank connection');
  return connection;
}

function secretMatches(received) {
  const expected = Buffer.from(config.mono.webhookSecret);
  const actual = Buffer.from(String(received ?? ''));
  return expected.length > 0 && actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

/**
 * Mono calls this when account data changes. Verified with the shared
 * `mono-webhook-secret` header (set the same secret on the Mono dashboard).
 */
router.post('/webhook', async (req, res) => {
  if (!secretMatches(req.get('mono-webhook-secret'))) return res.status(401).json({ error: 'Invalid webhook secret' });
  res.status(200).json({ received: true });

  const { event, data } = req.body ?? {};
  const accountId = data?.account?._id ?? data?.account?.id ?? data?.id;
  if (typeof accountId !== 'string') return;
  const connections = await prisma.bankConnection.findMany({ where: { accountId } });

  if (event === 'mono.events.reauthorisation_required') {
    await prisma.bankConnection.updateMany({
      where: { accountId },
      data: { lastError: 'Your bank needs you to reconnect this account' },
    });
  } else if (event === 'mono.events.account_updated' && data?.meta?.data_status === 'AVAILABLE') {
    for (const c of connections) {
      syncConnection(c).catch((err) => console.error('[mono] webhook sync failed:', err.message));
    }
  }
});

router.use(requireAuth);

router.get('/connections', async (req, res) => {
  const connections = await prisma.bankConnection.findMany({ where: { userId: req.userId }, orderBy: { createdAt: 'asc' } });
  res.json({ enabled: config.mono.enabled, testMode: config.mono.testMode, connections: connections.map(publicConnection) });
});

// Called with the one-time code the Mono Connect widget returns after the user logs in to their bank.
router.post('/connections', async (req, res) => {
  requireMono();
  const { code } = z.object({ code: z.string().min(1).max(500) }).parse(req.body);

  let accountId;
  let details = {};
  try {
    accountId = await exchangeCode(code);
    details = await getAccountDetails(accountId).catch(() => ({}));
  } catch (err) {
    throw new HttpError(502, `Could not connect bank: ${err.message}`);
  }

  const connection = await prisma.bankConnection.upsert({
    where: { userId_accountId: { userId: req.userId, accountId } },
    create: { userId: req.userId, accountId, ...details, institutionName: details.institutionName ?? 'Bank account' },
    update: { ...details, lastError: null },
  });

  // First import. Mono may still be fetching history; the webhook/scheduler picks it up later if so.
  let synced = null;
  try {
    synced = await syncConnection(connection);
  } catch (err) {
    console.warn('[mono] initial sync failed:', err.message);
  }
  const fresh = await prisma.bankConnection.findUnique({ where: { id: connection.id } });
  res.status(201).json({ connection: publicConnection(fresh), synced });
});

router.post('/connections/:id/sync', async (req, res) => {
  const connection = await findOwned(req.userId, req.params.id);
  const synced = await syncConnection(connection);
  const fresh = await prisma.bankConnection.findUnique({ where: { id: connection.id } });
  res.json({ connection: publicConnection(fresh), synced });
});

// Disconnects the account. Already-imported transactions are kept as history.
router.delete('/connections/:id', async (req, res) => {
  const connection = await findOwned(req.userId, req.params.id);
  requireMono();
  const others = await prisma.bankConnection.count({ where: { accountId: connection.accountId, NOT: { id: connection.id } } });
  if (others === 0) {
    await unlinkAccount(connection.accountId).catch((err) =>
      console.warn('[mono] unlink failed (removing locally anyway):', err.message),
    );
  }
  await prisma.bankConnection.delete({ where: { id: connection.id } });
  res.status(204).end();
});

export default router;
