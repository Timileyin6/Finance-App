import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapMonoTransaction } from '../src/services/mono.js';
import { categorize } from '../src/lib/categories.js';

test('Mono debits become negative kobo, credits positive', () => {
  const debit = mapMonoTransaction({ id: 'tx1', narration: 'POS PURCHASE  @ SHOPRITE LEKKI', amount: 1250000, type: 'debit', date: '2026-09-01T10:00:00.000Z' });
  assert.equal(debit.amountCents, -1250000);
  assert.equal(debit.name, 'POS PURCHASE @ SHOPRITE LEKKI');
  assert.equal(debit.category, 'Groceries');
  assert.equal(debit.externalId, 'tx1');

  const credit = mapMonoTransaction({ _id: 'tx2', narration: 'SALARY SEPT ACME LTD', amount: 45000000, type: 'credit', date: '2026-09-01' });
  assert.equal(credit.amountCents, 45000000);
  assert.equal(credit.category, 'Income');
  assert.equal(credit.externalId, 'tx2');
});

test('Nigerian narrations map to sensible categories', () => {
  assert.equal(categorize(null, 'MTN AIRTIME VTU 08031234567', false), 'Bills');
  assert.equal(categorize(null, 'IKEDC PREPAID TOKEN', false), 'Bills');
  assert.equal(categorize('bank_charges', 'SMS ALERT CHARGES', false), 'Bills');
  assert.equal(categorize(null, 'BOLT RIDE LAGOS', false), 'Transportation');
  assert.equal(categorize(null, 'CHICKEN REPUBLIC IKEJA', false), 'Dining Out');
  assert.equal(categorize(null, 'NETFLIX.COM', false), 'Entertainment');
  assert.equal(categorize(null, 'NIP TRF FROM ADA OKAFOR', true), 'Transfer');
  assert.equal(categorize(null, 'SOMETHING UNKNOWN', false), 'General');
  assert.equal(categorize(null, 'SOMETHING UNKNOWN', true), 'Income');
});
