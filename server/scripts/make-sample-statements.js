// Writes two example statements for the current month into server/samples/ so the
// Monthly Report can be tried without a real bank statement:
//   gtbank-statement.csv  (Trans. Date / Narration / Debit / Credit / Balance layout)
//   kuda-statement.xlsx   (Date/Time / Money In / Money Out / Description / Balance layout)
// They include a transfer between the two banks, a charge matching the demo "Lunch" entry,
// frequent Chowdeck/Bolt orders and subscriptions.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../samples');
fs.mkdirSync(outDir, { recursive: true });

const today = new Date();
const year = today.getFullYear();
const month = today.getMonth();
const monthName = today.toLocaleString('en-GB', { month: 'short' });
const pad = (n) => String(n).padStart(2, '0');
const dayOf = (d) => new Date(year, month, Math.min(d, today.getDate()));
const daysAgo = (n) => new Date(year, month, today.getDate() - n);
const gtDate = (d) => `${pad(d.getDate())}-${monthName}-${d.getFullYear()}`;
const money = (n) => n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// [date, narration, debit, credit]
const gtRows = [
  [dayOf(1), 'SALARY SEP ACME TECHNOLOGIES LTD', 0, 450000],
  [dayOf(2), 'IKEDC PREPAID TOKEN 04513320', 25000, 0],
  [dayOf(3), 'POS PURCHASE @ FITNESS HUB LEKKI', 15000, 0],
  [dayOf(4), 'WEB PURCHASE CHOWDECK TECHNOLOGIES LAGOS', 7800, 0],
  [dayOf(5), 'NIP TRF TO TIMI ADE KUDA MFB SAVINGS', 100000, 0],
  [dayOf(5), 'NIP CHARGE + VAT', 53.75, 0],
  [dayOf(6), 'WEB PURCHASE CHOWDECK TECHNOLOGIES LAGOS', 6400, 0],
  [dayOf(7), 'POS PURCHASE @ SHOPRITE LEKKI', 38500, 0],
  [dayOf(8), 'WEB PURCHASE CHOWDECK TECHNOLOGIES LAGOS', 9100, 0],
  [dayOf(9), 'BOLT.EU RIDE LAGOS', 4200, 0],
  [dayOf(11), 'WEB PURCHASE NETFLIX.COM', 7000, 0],
  [dayOf(11), 'SMS ALERT CHARGES', 40, 0],
  [dayOf(12), 'WEB PURCHASE CHOWDECK TECHNOLOGIES LAGOS', 5300, 0],
  [dayOf(14), 'BOLT.EU RIDE LAGOS', 3900, 0],
  [dayOf(15), 'WEB PURCHASE CHOWDECK TECHNOLOGIES LAGOS', 12000, 0],
  [dayOf(17), 'MTN AIRTIME VTU 08031234567', 5000, 0],
  [dayOf(18), 'BOLT.EU RIDE LAGOS', 5600, 0],
  [dayOf(19), 'WEB PURCHASE CHOWDECK TECHNOLOGIES LAGOS', 8700, 0],
  [dayOf(21), 'MTN DATA BUNDLE 08031234567', 10000, 0],
  [dayOf(21), 'SMS ALERT CHARGES', 40, 0],
  [dayOf(23), 'DSTV COMPACT SUBSCRIPTION', 19000, 0],
  [daysAgo(3), 'POS PURCHASE @ MAMA CASS RESTAURANT IKEJA', 3200, 0],
  [daysAgo(1), 'WEB PURCHASE CHOWDECK TECHNOLOGIES LAGOS', 6900, 0],
].sort((a, b) => a[0] - b[0]);

let balance = 212450.3;
const csv = [
  'Guaranty Trust Bank Plc',
  'Customer Statement',
  `Account Name,TIMI ADE`,
  `Period,01-${monthName}-${year} to ${gtDate(today)}`,
  '',
  'Trans. Date,Value Date,Reference,Narration,Debit,Credit,Balance',
  `${gtDate(dayOf(1))},${gtDate(dayOf(1))},,OPENING BALANCE,,,"${money(balance)}"`,
];
gtRows.forEach(([date, narration, debit, credit], i) => {
  balance += credit - debit;
  csv.push(
    [gtDate(date), gtDate(date), `FT${year}${pad(month + 1)}${String(i).padStart(5, '0')}`, `"${narration}"`,
      debit ? `"${money(debit)}"` : '', credit ? `"${money(credit)}"` : '', `"${money(balance)}"`].join(','),
  );
});
fs.writeFileSync(path.join(outDir, 'gtbank-statement.csv'), `${csv.join('\n')}\n`);

// Kuda: money moved in from GTBank (internal transfer), plus its own spending
const kudaRows = [
  [dayOf(5), 100000, 0, 'Transfer from TIMI ADE / GTBANK'],
  [dayOf(6), 0, 1300, 'Spotify subscription'],
  [dayOf(10), 0, 4800, 'Chowdeck order'],
  [dayOf(16), 0, 27900, 'Jumia order payment'],
  [dayOf(20), 0, 3500, 'Bolt ride'],
  [dayOf(22), 35000, 0, 'Transfer from ADAEZE OKAFOR'],
].sort((a, b) => a[0] - b[0]);
let kudaBalance = 5000;
const sheet = [
  ['Kuda Microfinance Bank'],
  ['Account Statement'],
  ['Name', 'TIMI ADE'],
  [],
  ['Date/Time', 'Money In', 'Money out', 'Category', 'To / From', 'Description', 'Balance'],
];
for (const [date, moneyIn, moneyOut, description] of kudaRows) {
  kudaBalance += moneyIn - moneyOut;
  sheet.push([`${pad(date.getDate())}/${pad(month + 1)}/${String(year).slice(2)} 10:14:00`, moneyIn || null, moneyOut || null, moneyIn ? 'inward_transfer' : 'spend', '', description, kudaBalance]);
}
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheet), 'Statement');
fs.writeFileSync(path.join(outDir, 'kuda-statement.xlsx'), XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));

console.log(`Wrote sample statements for ${today.toLocaleString('en-GB', { month: 'long', year: 'numeric' })} to ${outDir}`);
