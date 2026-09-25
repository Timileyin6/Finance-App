// Reads bank statements (CSV, XLS, XLSX, PDF) into transactions.
// Every Nigerian bank lays statements out differently, so instead of per-bank templates
// this finds the header row (Date / Narration / Debit / Credit / Balance …) and maps columns by name.
import * as XLSX from 'xlsx';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { HttpError } from '../lib/errors.js';

const MAX_ROWS = 5000;

const BANKS = [
  ['GTBank', /guaranty trust|gtbank|gtco/i],
  ['Access Bank', /access bank|accessbank/i],
  ['Zenith Bank', /zenith/i],
  ['UBA', /united bank for africa|\buba\b/i],
  ['First Bank', /first ?bank/i],
  ['Fidelity Bank', /fidelity/i],
  ['Stanbic IBTC', /stanbic/i],
  ['Sterling Bank', /sterling/i],
  ['Wema Bank', /wema|alat/i],
  ['FCMB', /fcmb|first city monument/i],
  ['Union Bank', /union bank/i],
  ['Polaris Bank', /polaris/i],
  ['Ecobank', /ecobank/i],
  ['Keystone Bank', /keystone/i],
  ['Kuda', /kuda/i],
  ['Opay', /\bopay\b/i],
  ['Moniepoint', /moniepoint/i],
  ['PalmPay', /palmpay/i],
  ['Carbon', /\bcarbon\b/i],
  ['VFD / V Bank', /vfd|vbank/i],
];

/** The bank named earliest (file name, then the statement's title) wins over banks named in transactions. */
export function detectBank(...texts) {
  const haystack = texts.join(' \n ');
  let best = null;
  for (const [name, pattern] of BANKS) {
    const index = haystack.search(pattern);
    if (index !== -1 && (!best || index < best.index)) best = { name, index };
  }
  return best?.name ?? null;
}

// ── Value parsing ─────────────────────────────────────────

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

function makeDate(y, m, d) {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  const date = new Date(y, m - 1, d, 12); // midday: same calendar day in every timezone
  return date.getMonth() === m - 1 ? date : null;
}

/** Nigerian statements are day-first: 03/09/2026 is 3 September. */
export function parseDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : makeDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
  if (typeof value === 'number') {
    // Excel serial date
    if (value < 20000 || value > 80000) return null;
    const p = XLSX.SSF.parse_date_code(value);
    return p ? makeDate(p.y, p.m, p.d) : null;
  }
  const text = String(value ?? '').trim();
  let m;
  if ((m = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) return makeDate(+m[1], +m[2], +m[3]);
  if ((m = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/))) return makeDate(+m[3], +m[2], +m[1]);
  if ((m = text.match(/^(\d{1,2})(?:st|nd|rd|th)?[-/ ]?([A-Za-z]{3,9})[-/ ,]+(\d{2,4})\b/))) {
    const month = MONTHS[m[2].slice(0, 4).toLowerCase()] ?? MONTHS[m[2].slice(0, 3).toLowerCase()];
    return month ? makeDate(+m[3], month, +m[1]) : null;
  }
  if ((m = text.match(/^([A-Za-z]{3,9})[-/ ](\d{1,2}),?[-/ ](\d{2,4})\b/))) {
    const month = MONTHS[m[1].slice(0, 4).toLowerCase()] ?? MONTHS[m[1].slice(0, 3).toLowerCase()];
    return month ? makeDate(+m[3], month, +m[2]) : null;
  }
  return null;
}

/** "₦1,234.50", "(500.00)", "2,000.00 DR", 1234.5 → { minor: kobo (signed if the value says so), explicitSign } */
export function parseAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? { minor: Math.round(value * 100), explicitSign: value < 0 } : null;
  const text = String(value ?? '').trim();
  if (!text || !/\d/.test(text)) return null;
  const negative = /^\(.*\)$/.test(text) || /^-|-$/.test(text) || /\bdr\.?$/i.test(text);
  const positive = /\bcr\.?$/i.test(text) || /^\+/.test(text);
  const digits = text.replace(/[^\d.]/g, '');
  if (!/^\d*\.?\d+$/.test(digits)) return null;
  const minor = Math.round(parseFloat(digits) * 100);
  return { minor: negative ? -minor : minor, explicitSign: negative || positive };
}

// ── Table → transactions ─────────────────────────────────

const HEADER_PATTERNS = {
  date: /^(trans(action)?\.?\s*date|txn\.?\s*date|tran\.?\s*date|posting date|post date|booking date|date|trans\.?\s*time|date\s*\/\s*time|transaction time)$/,
  valueDate: /^value\.?\s*date$/,
  description: /(narration|description|details|remark|particular|memo|beneficiary|transaction details|trans\.?\s*details)/,
  debit: /^(debit|debits|withdrawals?|money out|paid out|outflow|dr|debit amount|debit\s*\(.*\)|withdrawal\s*\(.*\))$/,
  credit: /^(credit|credits|deposits?|lodgements?|money in|paid in|inflow|cr|credit amount|credit\s*\(.*\)|deposit\s*\(.*\))$/,
  amount: /^(amount|amount\s*\(.*\)|transaction amount|txn amount)$/,
  type: /^(type|dr\s*\/\s*cr|cr\s*\/\s*dr|d\s*\/\s*c|txn type|transaction type|debit\s*\/\s*credit)$/,
  balance: /balance/,
};

const norm = (v) => String(v ?? '').toLowerCase().replace(/[₦:]/g, '').replace(/\s+/g, ' ').trim();

/** Finds the header row and which column holds what. */
export function findHeader(rows) {
  for (let r = 0; r < Math.min(rows.length, 60); r++) {
    const cells = rows[r].map(norm);
    const col = {};
    cells.forEach((cell, i) => {
      if (!cell) return;
      for (const [key, pattern] of Object.entries(HEADER_PATTERNS)) {
        if (col[key] === undefined && pattern.test(cell)) {
          col[key] = i;
          break;
        }
      }
    });
    if (col.date === undefined && col.valueDate !== undefined) col.date = col.valueDate;
    const hasMoney = (col.debit !== undefined && col.credit !== undefined) || col.amount !== undefined;
    if (col.date !== undefined && hasMoney) return { row: r, col };
  }
  return null;
}

/**
 * rows: 2-D array of cell values. Returns { transactions: [{ date, description, amountMinor }], skipped }.
 * Throws if no recognisable header row exists.
 */
export function parseTable(rows) {
  const header = findHeader(rows);
  if (!header) return null;
  const { col } = header;
  const transactions = [];
  let skipped = 0;
  const cell = (row, key) => (col[key] === undefined ? undefined : row[col[key]]);

  for (const row of rows.slice(header.row + 1)) {
    if (!row || row.every((c) => c === null || c === undefined || String(c).trim() === '')) continue;
    const date = parseDate(cell(row, 'date'));
    const description = String(cell(row, 'description') ?? '').replace(/\s+/g, ' ').trim();

    let amount = null;
    if (col.debit !== undefined && col.credit !== undefined) {
      const debit = parseAmount(cell(row, 'debit'));
      const credit = parseAmount(cell(row, 'credit'));
      if (debit || credit) amount = Math.abs(credit?.minor ?? 0) - Math.abs(debit?.minor ?? 0);
    } else {
      const parsed = parseAmount(cell(row, 'amount'));
      if (parsed) {
        const type = norm(cell(row, 'type'));
        if (/^(dr|d|debit|withdrawal|out)/.test(type)) amount = -Math.abs(parsed.minor);
        else if (/^(cr|c|credit|deposit|in)/.test(type)) amount = Math.abs(parsed.minor);
        else amount = parsed.minor; // sign as written (negative = money out)
      }
    }

    if (!date) {
      // A wrapped description line belongs to the row above
      if (!amount && description && transactions.length) {
        transactions.at(-1).description = `${transactions.at(-1).description} ${description}`.slice(0, 300);
      } else if (amount) skipped++;
      continue;
    }
    if (!amount) {
      if (!/opening|closing|brought forward|balance b\/f|carried forward/i.test(description)) skipped++;
      continue;
    }
    transactions.push({ date, description: description || 'Bank transaction', amountMinor: amount });
    if (transactions.length >= MAX_ROWS) break;
  }
  return { transactions, skipped };
}

// ── Spreadsheets & CSV ─────────────────────────────────────

function parseSpreadsheet(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false, raw: false, dense: true });
  let text = '';
  for (const name of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: true, defval: null, blankrows: false });
    text += rows.slice(0, 15).flat().filter(Boolean).join(' ');
    const result = parseTable(rows);
    if (result) return { ...result, text };
  }
  return { transactions: null, text };
}

// ── PDF ────────────────────────────────────────────────────

/** PDF text comes as positioned fragments; rebuild visual lines (top to bottom, then left to right). */
async function pdfLines(buffer, password) {
  let doc;
  let loadingTask;
  try {
    loadingTask = getDocument({
      data: new Uint8Array(buffer),
      password: password || undefined,
      isEvalSupported: false,
      disableFontFace: true,
      useSystemFonts: false,
      verbosity: 0,
    });
    doc = await loadingTask.promise;
  } catch (err) {
    await loadingTask?.destroy();
    if (err?.name === 'PasswordException') {
      throw new HttpError(400, password ? 'That PDF password is incorrect' : 'This PDF is password-protected. Enter its password and upload again.', { needsPassword: true });
    }
    throw new HttpError(400, 'Could not read this PDF. If it’s a scanned image, download a CSV or Excel statement instead.');
  }

  const lines = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const { items } = await page.getTextContent();
    const rows = [];
    for (const item of items) {
      const str = item.str?.trim();
      if (!str) continue;
      const x = item.transform[4];
      const y = item.transform[5];
      const row = rows.find((r) => Math.abs(r.y - y) < 3);
      const fragment = { x, end: x + (item.width || str.length * 4), str };
      if (row) row.items.push(fragment);
      else rows.push({ y, items: [fragment] });
    }
    rows.sort((a, b) => b.y - a.y);
    for (const row of rows) lines.push({ page: p, y: row.y, items: row.items.sort((a, b) => a.x - b.x) });
  }
  await loadingTask.destroy();
  return lines;
}

// Joins fragments that sit right next to each other ("Trans." + "Date") into one cell.
function mergeFragments(items, gap = 6) {
  const cells = [];
  for (const item of items) {
    const last = cells.at(-1);
    if (last && item.x - last.end < gap) {
      last.str += ` ${item.str}`;
      last.end = item.end;
    } else cells.push({ ...item });
  }
  return cells;
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
};

/**
 * A table row's text can wrap over several lines, and banks align the date/amounts to the top
 * *or* the middle of the row, so wrapped lines may sit above or below the dated line.
 * Between two dated lines, the row boundary is the biggest vertical gap (rows have padding;
 * lines inside a cell don't). Above the first and below the last dated line on a page, lines are
 * attached only while they're spaced like lines of the same cell (so page titles/footers aren't).
 */
function attachWrappedLines(rows, { isDated, isContinuation }) {
  const attach = (row, anchor) => {
    if (row.absorbed || !isContinuation(row)) return;
    anchor.extra.push(row);
    row.absorbed = true;
  };
  for (const page of new Set(rows.map((r) => r.page))) {
    const lines = rows.filter((r) => r.page === page);
    const anchors = lines.flatMap((r, i) => (isDated(r) ? [i] : []));
    if (!anchors.length) continue;
    const typicalGap = median(lines.slice(1).map((r, i) => lines[i].y - r.y).filter((g) => g > 0)) || 12;
    const sameCell = (upper, lower) => upper.y - lower.y <= typicalGap * 1.5;

    for (let i = anchors[0] - 1; i >= 0 && sameCell(lines[i], lines[i + 1]); i--) attach(lines[i], lines[anchors[0]]);

    for (let k = 0; k < anchors.length - 1; k++) {
      const [a, b] = [anchors[k], anchors[k + 1]];
      if (b - a < 2) continue;
      let biggest = -1;
      let ties = [];
      for (let j = a; j < b; j++) {
        const gap = lines[j].y - lines[j + 1].y;
        if (gap > biggest + 0.5) [biggest, ties] = [gap, [j]];
        else if (Math.abs(gap - biggest) <= 0.5) ties.push(j);
      }
      const cut = ties[Math.floor((ties.length - 1) / 2)];
      for (let j = a + 1; j <= cut; j++) attach(lines[j], lines[a]);
      for (let j = cut + 1; j < b; j++) attach(lines[j], lines[b]);
    }

    const last = anchors.at(-1);
    for (let j = last + 1; j < lines.length && sameCell(lines[j - 1], lines[j]); j++) attach(lines[j], lines[last]);
  }
}

/** Uses the header line's column positions to put every fragment below it into a column. */
function pdfTable(lines) {
  for (let i = 0; i < lines.length; i++) {
    const headerCells = mergeFragments(lines[i].items);
    const header = findHeader([headerCells.map((c) => c.str)]);
    if (!header) continue;
    const { col } = header;

    const centers = headerCells.map((c) => (c.x + c.end) / 2);
    const nearest = (targets, value) => targets.reduce((best, t, c) => (Math.abs(t - value) < Math.abs(targets[best] - value) ? c : best), 0);

    // First pass: each fragment goes to the column whose heading it sits under (nearest centre)
    const rows = [];
    for (const line of lines.slice(i + 1)) {
      const frags = mergeFragments(line.items, 3).map((f) => ({ ...f, col: nearest(centers, (f.x + f.end) / 2) }));
      if (headerCells.every((_, c) => norm(frags.filter((f) => f.col === c).map((f) => f.str).join(' ')) === norm(headerCells[c].str))) {
        continue; // header repeated on a later page
      }
      rows.push({ page: line.page, y: line.y, frags, extra: [] });
    }
    const cellsOf = (row) => headerCells.map((_, c) => row.frags.filter((f) => f.col === c).map((f) => f.str).join(' ') || null);
    for (const row of rows) row.cells = cellsOf(row);

    // Wrapped lines hold short words (e.g. a surname on its own), and a heading is often centred over a wide
    // left-aligned column. So place fragments on undated lines by the column's real left edge, learned from dated rows.
    const datedRows = rows.filter((r) => parseDate(r.cells[col.date]) !== null);
    const starts = headerCells.map((h, c) => median(datedRows.flatMap((r) => r.frags.filter((f) => f.col === c).map((f) => f.x))) || h.x);
    for (const row of rows) {
      if (datedRows.includes(row)) continue;
      for (const f of row.frags) f.col = nearest(starts, f.x);
      row.cells = cellsOf(row);
    }

    const moneyCols = [col.debit, col.credit, col.amount, col.balance].filter((c) => c !== undefined);
    attachWrappedLines(rows, {
      isDated: (r) => parseDate(r.cells[col.date]) !== null,
      isContinuation: (r) => !moneyCols.some((c) => r.cells[c]),
    });
    if (col.description !== undefined) {
      for (const row of rows) {
        if (!row.extra.length) continue;
        // Only the description column is continued; wrapped text from other columns (e.g. a long Reference) is dropped
        row.cells[col.description] = [row, ...row.extra]
          .sort((a, b) => b.y - a.y)
          .map((r) => r.cells[col.description])
          .filter(Boolean)
          .join(' ');
      }
    }
    return parseTable([headerCells.map((c) => c.str), ...rows.filter((r) => !r.absorbed).map((r) => r.cells)]);
  }
  return null;
}

const MONEY = /-?\(?\d{1,3}(?:,\d{3})*\.\d{2}\)?|-?\d+\.\d{2}/g;
const DATE_PREFIX = /^\s*(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[-/. ](?:\d{1,2}|[A-Za-z]{3,9})[-/. ,]+\d{2,4}|[A-Za-z]{3,9} \d{1,2},? \d{2,4})(\s+\d{1,2}:\d{2}(:\d{2})?)?\s*/;

/** Fallback when there's no usable header: each dated line's last number is the running balance. */
function pdfByBalance(lines) {
  const transactions = [];
  let skipped = 0;
  let previousBalance = null;
  for (const { items } of lines) {
    const text = items.map((i) => i.str).join(' ');
    if (/opening balance|balance b\/f|brought forward/i.test(text)) {
      const numbers = text.match(MONEY);
      if (numbers) previousBalance = parseAmount(numbers.at(-1)).minor;
      continue;
    }
    const date = parseDate(text);
    if (!date) {
      if (transactions.length && !text.match(MONEY) && text.length < 120) {
        transactions.at(-1).description = `${transactions.at(-1).description} ${text}`.slice(0, 300);
      }
      continue;
    }
    const numbers = text.match(MONEY) ?? [];
    if (numbers.length < 2) {
      skipped++;
      continue;
    }
    const balance = parseAmount(numbers.at(-1)).minor;
    let amount;
    if (previousBalance !== null) amount = balance - previousBalance;
    else {
      const value = Math.abs(parseAmount(numbers.at(-2)).minor);
      amount = /\bcr\b|credit|deposit|received|from/i.test(text) ? value : -value;
    }
    previousBalance = balance;
    if (!amount) continue;
    // Drop the transaction date and value date at the start of the line, and all amounts
    const description = text
      .replace(DATE_PREFIX, '')
      .replace(DATE_PREFIX, '')
      .replace(MONEY, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    transactions.push({ date, description: description || 'Bank transaction', amountMinor: amount });
  }
  return { transactions, skipped };
}

async function parsePdf(buffer, password) {
  const lines = await pdfLines(buffer, password);
  const text = lines.slice(0, 40).map((l) => l.items.map((i) => i.str).join(' ')).join(' \n ');
  const table = pdfTable(lines);
  if (table?.transactions.length) return { ...table, text };
  const fallback = pdfByBalance(lines);
  return { ...fallback, text };
}

// ── Entry point ────────────────────────────────────────────

export const ACCEPTED_EXTENSIONS = ['.pdf', '.csv', '.xls', '.xlsx'];

/** @returns {{ bankName: string|null, transactions: {date, description, amountMinor}[], skipped: number }} */
export async function parseStatementFile({ buffer, fileName, password }) {
  const ext = fileName.toLowerCase().match(/\.[a-z]+$/)?.[0];
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    throw new HttpError(400, `${fileName}: unsupported file type. Upload a PDF, CSV, XLS or XLSX statement.`);
  }
  const result = ext === '.pdf' ? await parsePdf(buffer, password) : parseSpreadsheet(buffer);
  if (!result.transactions?.length) {
    throw new HttpError(
      400,
      `${fileName}: couldn't find any transactions. Make sure it's a bank statement with Date, Description and Debit/Credit (or Amount) columns.`,
    );
  }
  return { bankName: detectBank(fileName, result.text ?? ''), transactions: result.transactions, skipped: result.skipped };
}
