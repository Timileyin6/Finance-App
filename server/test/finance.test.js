import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRecurringBills, summarizeBills } from '../src/services/finance.js';

const today = new Date(2026, 8, 10, 12); // 10 Sep 2026
const tx = (name, amount, y, m, d) => ({ id: `${name}-${m}-${d}`, name, category: 'Bills', amountCents: amount, date: new Date(y, m, d, 12) });

test('recurring bills get one entry per payee with the right status', () => {
  const bills = buildRecurringBills(
    [
      tx('Paid Co', -1000, 2026, 8, 2), // paid this month
      tx('Paid Co', -1000, 2026, 7, 2),
      tx('Soon Co', -2000, 2026, 7, 13), // due in 3 days
      tx('Later Co', -3000, 2026, 7, 25), // due in 15 days
      tx('Late Co', -4000, 2026, 7, 5), // due day passed, unpaid
      tx('Refund', 500, 2026, 7, 5), // income is ignored
    ],
    today,
  );
  const byName = Object.fromEntries(bills.map((b) => [b.name, b]));
  assert.equal(bills.length, 4);
  assert.equal(byName['Paid Co'].status, 'paid');
  assert.equal(byName['Soon Co'].status, 'dueSoon');
  assert.equal(byName['Later Co'].status, 'upcoming');
  assert.equal(byName['Late Co'].status, 'overdue');
  assert.equal(byName['Soon Co'].amountCents, 2000);
  assert.equal(byName['Soon Co'].dueDay, 13);

  const summary = summarizeBills(bills);
  assert.deepEqual(summary.paid, { count: 1, totalCents: 1000 });
  assert.deepEqual(summary.upcoming, { count: 3, totalCents: 9000 });
  assert.deepEqual(summary.dueSoon, { count: 1, totalCents: 2000 });
  assert.equal(summary.totalCents, 10000);
});

test('payee names are matched case-insensitively', () => {
  const bills = buildRecurringBills([tx('Netflix', -1500, 2026, 8, 1), tx('NETFLIX ', -1500, 2026, 7, 1)], today);
  assert.equal(bills.length, 1);
});
