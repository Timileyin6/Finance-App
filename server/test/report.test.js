import { test } from 'node:test';
import assert from 'node:assert/strict';
import { merchantName } from '../src/lib/merchants.js';
import { cashFlow, detectSubscriptions, findInternalTransfers, findMatches, findTriggers } from '../src/services/report.js';

let n = 0;
const tx = (name, naira, day, extra = {}) => ({
  id: `t${++n}`,
  name,
  amountCents: Math.round(naira * 100),
  date: new Date(2026, 8, day, 12),
  category: 'General',
  source: 'statement',
  statementId: 's1',
  statement: { bankName: 'GTBank' },
  recurring: false,
  isCash: false,
  ...extra,
});

test('merchant names are cleaned up so they can be grouped', () => {
  assert.equal(merchantName('WEB PURCHASE CHOWDECK TECHNOLOGIES LAGOS'), 'Chowdeck');
  assert.equal(merchantName('BOLT.EU RIDE LAGOS'), 'Bolt');
  assert.equal(merchantName('POS PURCHASE @ MAMA CASS RESTAURANT IKEJA 2291'), 'Mama Cass Restaurant');
  assert.equal(merchantName('NIP TRF TO ADAEZE OKAFOR 0012345'), 'Adaeze Okafor');
  assert.equal(merchantName('12345 99'), 'Other');
});

test('inflow vs outflow delta', () => {
  assert.deepEqual(cashFlow([tx('in', 100000, 1), tx('out', -112400, 2)]), {
    inflowCents: 10000000, outflowCents: 11240000, netCents: -1240000, overspent: true, percent: 12.4,
  });
  const saved = cashFlow([tx('in', 100000, 1), tx('out', -77000, 2)]);
  assert.equal(saved.overspent, false);
  assert.equal(saved.percent, 23);
  assert.equal(cashFlow([tx('out', -5000, 2)]).percent, null);
});

test('transfers between the user’s own banks are paired up and excluded', () => {
  const out = tx('NIP TRF TO TIMI ADE KUDA MFB', -100000, 5);
  const inKuda = tx('Transfer from TIMI / GTBANK', 100000, 5, { statementId: 's2', statement: { bankName: 'Kuda' } });
  const sameBankIn = tx('TRF FROM JOHN', 100000, 5); // same bank → not internal
  const result = findInternalTransfers([out, inKuda, sameBankIn]);
  assert.equal(result.pairs.length, 1);
  assert.ok(result.ids.has(out.id) && result.ids.has(inKuda.id) && !result.ids.has(sameBankIn.id));
  assert.equal(result.totalCents, 10000000);
});

test('"triggers": most frequent merchants first', () => {
  const txs = [
    ...[7800, 6400, 9100, 5300].map((a, i) => tx('WEB PURCHASE CHOWDECK TECHNOLOGIES', -a, i + 1, { category: 'Dining Out' })),
    tx('BOLT.EU RIDE', -4200, 3), tx('BOLT.EU RIDE', -3900, 4),
    tx('SHOPRITE LEKKI', -38500, 5),
  ];
  const triggers = findTriggers(txs);
  assert.deepEqual(triggers.map((t) => [t.merchant, t.count]), [['Chowdeck', 4], ['Bolt', 2]]);
  assert.equal(triggers[0].totalCents, 2860000);
  assert.equal(triggers[0].category, 'Dining Out');
});

test('subscriptions: known services, marked recurring, and same amount seen last month', () => {
  const month = [
    tx('WEB PURCHASE NETFLIX.COM', -7000, 11),
    tx('POS PURCHASE @ LEKKI ESTATE LEVY', -15000, 3),
    tx('Rent contribution', -50000, 1, { source: 'manual', recurring: true }),
    tx('BOLT.EU RIDE', -4200, 3), tx('BOLT.EU RIDE', -3900, 4), tx('BOLT.EU RIDE', -5000, 6),
    tx('SHOPRITE LEKKI', -38500, 5),
  ];
  const history = [{ name: 'POS PURCHASE @ LEKKI ESTATE LEVY', amountCents: -1500000 }, { name: 'BOLT.EU RIDE', amountCents: -420000 }];
  const subs = detectSubscriptions(month, history);
  assert.deepEqual(subs.items.map((s) => [s.merchant, s.reason]).sort(), [
    ['Lekki Estate Levy', 'repeats'], ['Netflix', 'known'], ['Rent Contribution', 'marked'],
  ]);
  assert.equal(subs.totalMonthlyCents, 7200000);
  assert.equal(subs.totalAnnualCents, 7200000 * 12);
});

test('manual entries are matched to a same-amount bank charge within 3 days; cash is never matched', () => {
  const lunch = tx('Lunch', -3200, 20, { source: 'manual', statementId: null });
  const cashSuya = tx('Suya', -4500, 20, { source: 'manual', statementId: null, isCash: true });
  const charge = tx('POS PURCHASE @ MAMA CASS', -3200, 22);
  const suyaLookalike = tx('POS SUYA SPOT', -4500, 20);
  const farCharge = tx('POS PURCHASE @ OTHER', -3200, 28);
  const matches = findMatches([lunch, cashSuya, charge, suyaLookalike, farCharge]);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].manual.id, lunch.id);
  assert.equal(matches[0].imported.id, charge.id);

  assert.equal(findMatches([lunch, charge], new Set([`${lunch.id}:${charge.id}`])).length, 0);
});

test('transfer recipients are pulled out of bank narrations', async () => {
  const { extractCounterparty } = await import('../src/lib/merchants.js');
  const cases = {
    'NIP TRF TO ADAEZE OKAFOR 0012345': 'Adaeze Okafor',
    'NIP TRF TO TIMI ADE KUDA MFB SAVINGS': 'Timi Ade',
    'Transfer from TIMI ADE / GTBANK': 'Timi Ade',
    'TRANSFER FROM ADAEZE OKAFOR REF 88213 BEING PAYMENT FOR GOODS': 'Adaeze Okafor',
    'TRF FRM JOHN DOE-GTB': 'John Doe',
    'MOBILE TRF TO CHIDI EZE/Rent': 'Chidi Eze',
    'USSD TRANSFER TO: BLESSING NWOSU': 'Blessing Nwosu',
    'POS PURCHASE @ SHOPRITE LEKKI': null,
    'SALARY SEP ACME TECHNOLOGIES LTD': null,
    'NIP CHARGE + VAT': null,
    // GTBank formats
    'Instant Payment Outward 000013260801160808000109424586 NIP TRANSFER TO OPAY - AMINAT BOLA LAWAL': 'Aminat Bola Lawal',
    'Instant Payment Outward 000013260802102556000110986449 TITHE TO ACCESS - GRACE CHAPEL IKEJA': 'Grace Chapel Ikeja',
    'Instant Payment Outward 0000132608 NIP TRANSFER TO OPAY - TOLU ADEBAYO ADEWAL E': 'Tolu Adebayo Adewale',
    'Instant Payment Outward 0000132608 NIP TRANSFER TO PCKAPP - PIGGYVEST/OKAFOR CHIDI': 'Piggyvest',
    'Airtime Purchase VIA GTWORLD FROM OKAFOR CHIDI TO GLO AIRTIME COLLECT': null,
  };
  for (const [narration, expected] of Object.entries(cases)) {
    assert.equal(extractCounterparty(narration), expected, narration);
  }
  // "FROM A TO B": money in came from A; money out went to B
  const both = 'TRANSFER BETWEEN CUSTOMERS VIA GTWORLD FROM ADEBAYO KEMI TO OKAFOR CHIDI DAN';
  assert.equal(extractCounterparty(both, true), 'Adebayo Kemi');
  assert.equal(extractCounterparty(both, false), 'Okafor Chidi Dan');
  assert.equal(extractCounterparty('TRANSFER BETWEEN CUSTOMERS 1000422608-TRANSFER FROM: PIGGYTECH LIMITED TO OKAFOR CHIDI DAN-PCKAPP-PIGGYTECH', true), 'Piggytech Limited');
});

test('descriptions lose reference numbers and masked cards; GTBank rows get the right category', async () => {
  const { tidyNarration } = await import('../src/lib/merchants.js');
  const { categorize } = await import('../src/lib/categories.js');
  assert.equal(
    tidyNarration('POSWEB PURCHASE TRANSACTION POS PUR OPAY The Place Lekki LANG 241075 001766879119 4001JJ3S 539983*********0162'),
    'POSWEB PURCHASE TRANSACTION POS PUR OPAY The Place Lekki LANG',
  );
  assert.equal(tidyNarration('Instant Payment Outward 000013260801160808000109424586 NIP TRANSFER TO OPAY - X'), 'Instant Payment Outward NIP TRANSFER TO OPAY - X');
  assert.equal(categorize(null, 'POSWEB PURCHASE TRANSACTION POS PUR OPAY The Place Lekki', false), 'Shopping');
  assert.equal(categorize(null, 'Instant Payment Outward 0000 TITHE TO ACCESS - GRACE CHAPEL', false), 'Transfer');
  assert.equal(categorize(null, 'Airtime Purchase VIA AIRTIME VIA GTWORLD', false), 'Bills');
  assert.equal(merchantName('POSWEB PURCHASE TRANSACTION POS PUR OPAY The Place Lekki LANG'), 'Place Lekki');
});
