import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as XLSX from 'xlsx';
import { detectBank, parseAmount, parseDate, parseStatementFile, parseTable } from '../src/services/statements.js';

const ymd = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

test('dates are read day-first, in the formats Nigerian banks use', () => {
  assert.equal(ymd(parseDate('03/09/2026')), '2026-9-3');
  assert.equal(ymd(parseDate('03-Sep-2026')), '2026-9-3');
  assert.equal(ymd(parseDate('03-Sept-2026')), '2026-9-3');
  assert.equal(ymd(parseDate('3 September 2026 10:22:01')), '2026-9-3');
  assert.equal(ymd(parseDate('2026-09-03T10:00:00')), '2026-9-3');
  assert.equal(ymd(parseDate('Sep 3, 2026')), '2026-9-3');
  assert.equal(ymd(parseDate('03/09/26 10:14:00')), '2026-9-3');
  assert.equal(ymd(parseDate(46268)), '2026-9-3'); // Excel serial
  assert.equal(parseDate('31/02/2026'), null);
  assert.equal(parseDate('OPENING BALANCE'), null);
});

test('amounts handle naira signs, commas, brackets and DR/CR suffixes', () => {
  assert.equal(parseAmount('₦1,234.50').minor, 123450);
  assert.equal(parseAmount('(500.00)').minor, -50000);
  assert.equal(parseAmount('2,000.00 DR').minor, -200000);
  assert.equal(parseAmount('2,000.00 CR').minor, 200000);
  assert.equal(parseAmount(1234.5).minor, 123450);
  assert.equal(parseAmount(''), null);
  assert.equal(parseAmount('-'), null);
});

test('separate Debit / Credit columns, with title rows and a wrapped narration', () => {
  const result = parseTable([
    ['Zenith Bank Plc'],
    [],
    ['Date Posted', 'Value Date', 'Description', 'Debit', 'Credit', 'Balance'],
    ['01/09/2026', '01/09/2026', 'Opening Balance', '', '', '10,000.00'],
    ['02/09/2026', '02/09/2026', 'POS PURCHASE @ SPAR', '2,500.00', '', '7,500.00'],
    ['', '', 'LEKKI PHASE 1', '', '', ''],
    ['03/09/2026', '03/09/2026', 'TRF FROM JOHN', '', '5,000.00', '12,500.00'],
  ]);
  // "Date Posted" isn't a known header, so Value Date is used
  assert.equal(result.transactions.length, 2);
  assert.equal(result.transactions[0].amountMinor, -250000);
  assert.equal(result.transactions[0].description, 'POS PURCHASE @ SPAR LEKKI PHASE 1');
  assert.equal(result.transactions[1].amountMinor, 500000);
  assert.equal(result.skipped, 0);
});

test('single Amount column with a DR/CR type column', () => {
  const result = parseTable([
    ['Txn Date', 'Narration', 'Type', 'Amount', 'Balance'],
    ['05-Sep-2026', 'NETFLIX.COM', 'DR', '7,000.00', '1.00'],
    ['06-Sep-2026', 'SALARY', 'CR', '450,000.00', '2.00'],
  ]);
  assert.deepEqual(result.transactions.map((t) => t.amountMinor), [-700000, 45000000]);
});

test('returns null when there is no recognisable header', () => {
  assert.equal(parseTable([['hello', 'world'], ['1', '2']]), null);
});

test('reads an Excel (Kuda-style) statement end to end', async () => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['Kuda Microfinance Bank'],
      ['Date/Time', 'Money In', 'Money out', 'Category', 'To / From', 'Description', 'Balance'],
      ['05/09/26 10:14:00', 100000, null, 'inward_transfer', '', 'Transfer from TIMI / GTBANK', 105000],
      ['06/09/26 09:00:00', null, 1300, 'spend', '', 'Spotify subscription', 103700],
    ]),
    'Statement',
  );
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const result = await parseStatementFile({ buffer, fileName: 'statement.xlsx' });
  assert.equal(result.bankName, 'Kuda');
  assert.deepEqual(result.transactions.map((t) => t.amountMinor), [10000000, -130000]);
});

test('reads a PDF statement by column position', async () => {
  const buffer = fs.readFileSync(new URL('./fixtures/access-statement.pdf', import.meta.url));
  const result = await parseStatementFile({ buffer, fileName: 'statement.pdf' });
  assert.equal(result.bankName, 'Access Bank');
  assert.deepEqual(
    result.transactions.map((t) => [ymd(t.date), t.amountMinor]),
    [['2026-9-3', -650000], ['2026-9-5', 3500000], ['2026-9-6', -980000], ['2026-9-9', -4000]],
  );
  assert.deepEqual(result.transactions.map((t) => t.description), [
    'POS PURCHASE @ CHICKEN REPUBLIC IKEJA',
    'TRANSFER FROM ADAEZE OKAFOR REF 88213 BEING PAYMENT FOR GOODS',
    'WEB PURCHASE CHOWDECK TECHNOLOGIES',
    'SMS ALERT CHARGES',
  ]);
});

test('rejects unsupported and unreadable files with a clear message', async () => {
  await assert.rejects(parseStatementFile({ buffer: Buffer.from('x'), fileName: 'photo.jpg' }), /unsupported file type/);
  await assert.rejects(parseStatementFile({ buffer: Buffer.from('a,b\n1,2'), fileName: 'x.csv' }), /couldn't find any transactions/);
  await assert.rejects(parseStatementFile({ buffer: Buffer.from('not a pdf'), fileName: 'x.pdf' }), /Could not read this PDF/);
});

test('detects the bank from the file name or contents', () => {
  assert.equal(detectBank('GTBank_Statement.pdf'), 'GTBank');
  assert.equal(detectBank('statement.pdf', 'Guaranty Trust Bank Plc Customer Statement'), 'GTBank');
  assert.equal(detectBank('x.csv', 'nothing here'), null);
});

test('PDF without a header row falls back to the running balance to get signs right', async () => {
  const buffer = fs.readFileSync(new URL('./fixtures/opay-no-header.pdf', import.meta.url));
  const result = await parseStatementFile({ buffer, fileName: 'statement.pdf' });
  assert.equal(result.bankName, 'Opay');
  assert.deepEqual(
    result.transactions.map((t) => [ymd(t.date), t.amountMinor, t.description]),
    [['2026-9-1', -250000, 'POS SPAR LEKKI'], ['2026-9-3', 500000, 'TRANSFER FROM JOHN DOE'], ['2026-9-4', -80000, 'BOLT RIDE']],
  );
});

test('GTBank PDF: 3-line remarks (top- and middle-aligned), wrapped references, header repeated on page 2', async () => {
  const buffer = fs.readFileSync(new URL('./fixtures/gtbank-statement.pdf', import.meta.url));
  const result = await parseStatementFile({ buffer, fileName: 'statement.pdf' });
  assert.equal(result.bankName, 'GTBank');
  assert.equal(result.transactions.length, 33);
  assert.equal(result.skipped, 0);
  const [first, tithe, credit] = result.transactions;
  assert.equal(first.amountMinor, -100000);
  assert.equal(first.description, 'Instant Payment Outward 000013260801160808000109424586 NIP TRANSFER TO OPAY - AMINAT BOLA LAWAL');
  assert.equal(tithe.description, 'Instant Payment Outward 000013260802102556000110986449 TITHE TO ACCESS - GRACE CHAPEL IKEJA');
  // The wrapped Reference ("'085794686202278512" / "40GTW") must not leak into the description
  assert.equal(credit.description, 'TRANSFER BETWEEN CUSTOMERS VIA GTWORLD FROM ADEBAYO KEMI FOLA TO OKAFOR CHIDI DAN');
  assert.equal(credit.amountMinor, 1500000);
  assert.equal(result.transactions.at(-1).description, 'Instant Payment Outward 0000132608025000 NIP TRANSFER TO OPAY - FRIDAY OSHABA');
});
