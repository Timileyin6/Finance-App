import { config } from '../config.js';
import { prisma } from '../db.js';
import { categorize } from '../lib/categories.js';
import { extractCounterparty, tidyNarration } from '../lib/merchants.js';
import { HttpError } from '../lib/errors.js';

// Mono API reference: https://docs.mono.co/api
const BASE_URL = 'https://api.withmono.com/v2';
const DAY = 24 * 60 * 60 * 1000;
const FIRST_SYNC_DAYS = 90;
// Re-read a week before the last sync so transactions the bank posts late aren't missed
const SYNC_OVERLAP_DAYS = 7;
const MAX_PAGES = 50;

export function requireMono() {
  if (!config.mono.enabled) {
    throw new HttpError(503, 'Bank sync is not configured on this server (missing MONO_PUBLIC_KEY / MONO_SECRET_KEY)');
  }
}

async function monoRequest(path, { method = 'GET', body, realtime = false } = {}) {
  const res = await fetch(path.startsWith('http') ? path : `${BASE_URL}${path}`, {
    method,
    headers: {
      accept: 'application/json',
      'mono-sec-key': config.mono.secretKey,
      ...(body && { 'Content-Type': 'application/json' }),
      ...(realtime && { 'x-real-time': 'true' }),
    },
    body: body && JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error = new Error(data?.message ?? `Mono request failed (${res.status})`);
    error.status = res.status;
    throw error;
  }
  return data;
}

// Mono date filter format: dd-mm-yyyy
const monoDate = (d) =>
  `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;

/** Step 2 of linking: swap the one-time code from the Connect widget for a permanent account id. */
export async function exchangeCode(code) {
  const res = await monoRequest('/accounts/auth', { method: 'POST', body: { code } });
  const accountId = res?.data?.id ?? res?.id;
  if (!accountId) throw new Error('Mono did not return an account id');
  return accountId;
}

export async function getAccountDetails(accountId) {
  const res = await monoRequest(`/accounts/${accountId}`);
  const account = res?.data?.account ?? res?.data ?? {};
  const number = String(account.accountNumber ?? account.account_number ?? '');
  return {
    institutionName: account.institution?.name ?? null,
    accountName: account.name ?? null,
    accountMask: number ? number.slice(-4) : null,
  };
}

export async function unlinkAccount(accountId) {
  await monoRequest(`/accounts/${accountId}/unlink`, { method: 'POST' });
}

async function fetchTransactions(accountId, start, end) {
  const query = new URLSearchParams({ start: monoDate(start), end: monoDate(end), paginate: 'true', limit: '100' });
  let next = `/accounts/${accountId}/transactions?${query}`;
  const all = [];
  for (let page = 0; next && page < MAX_PAGES; page++) {
    const res = await monoRequest(next, { realtime: config.mono.realtime && page === 0 });
    const items = Array.isArray(res?.data) ? res.data : (res?.data?.transactions ?? []);
    all.push(...items);
    next = res?.meta?.next || null;
  }
  return all;
}

/** Mono transaction → our Transaction fields. Mono amounts are already in kobo (minor units). */
export function mapMonoTransaction(t) {
  const isCredit = String(t.type).toLowerCase() === 'credit';
  const minor = Math.round(Math.abs(Number(t.amount) || 0));
  const narration = String(t.narration ?? '').replace(/\s+/g, ' ').trim();
  const category = categorize(t.category, narration, isCredit);
  return {
    externalId: String(t.id ?? t._id),
    name: (tidyNarration(narration) || narration || 'Bank transaction').slice(0, 120),
    bankNarration: narration.slice(0, 500) || null,
    category,
    counterparty: category === 'Transfer' ? extractCounterparty(narration, isCredit) : null,
    amountCents: isCredit ? minor : -minor,
    date: new Date(t.date),
  };
}

/** Imports new transactions for one linked account. Returns counts. */
export async function syncConnection(connection) {
  requireMono();
  const end = new Date();
  const start = connection.lastSyncedAt
    ? new Date(connection.lastSyncedAt.getTime() - SYNC_OVERLAP_DAYS * DAY)
    : new Date(end.getTime() - FIRST_SYNC_DAYS * DAY);

  try {
    const fetched = (await fetchTransactions(connection.accountId, start, end))
      .map(mapMonoTransaction)
      .filter((t) => t.externalId !== 'undefined' && !Number.isNaN(t.date.getTime()));

    // De-duplicate within the batch and against what's already imported
    const unique = [...new Map(fetched.map((t) => [t.externalId, t])).values()];
    const existing = await prisma.transaction.findMany({
      where: { userId: connection.userId, externalId: { in: unique.map((t) => t.externalId) } },
      select: { externalId: true },
    });
    const known = new Set(existing.map((e) => e.externalId));
    const fresh = unique.filter((t) => !known.has(t.externalId));

    await prisma.$transaction([
      prisma.transaction.createMany({
        data: fresh.map((t) => ({ ...t, userId: connection.userId, source: 'bank', connectionId: connection.id })),
      }),
      prisma.bankConnection.update({
        where: { id: connection.id },
        data: { lastSyncedAt: end, lastError: null },
      }),
    ]);
    return { added: fresh.length, checked: unique.length };
  } catch (err) {
    await prisma.bankConnection.update({ where: { id: connection.id }, data: { lastError: err.message } });
    throw new HttpError(502, `Bank sync failed: ${err.message}`);
  }
}

export async function syncAllConnections() {
  const connections = await prisma.bankConnection.findMany();
  for (const connection of connections) {
    try {
      await syncConnection(connection);
    } catch (err) {
      console.error(`[mono] sync failed for connection ${connection.id}:`, err.message);
    }
  }
}
