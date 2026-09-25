# finance — setup guide

A personal finance dashboard: track transactions (typed in by hand or imported automatically from your bank), set monthly budgets, save into pots, and see recurring bills.

```
client/   React 19 + Vite + React Router + Recharts (the UI)
server/   Node + Express 5 + Prisma (the API, auth, bank sync)
```

## Run it locally

Requires Node 20+.

```bash
# 1. Backend — creates server/.env with generated secrets, a SQLite database, and a demo account (Nigerian data, ₦)
cd server
npm install
npm run setup
npm run dev            # API on http://localhost:4000

# 2. Frontend — in a second terminal
cd client
npm install
npm run dev            # open http://localhost:5173
```

Sign in with **demo@finance.app / password123**, or create your own account.
`npm run db:seed` resets the demo account at any time.

## Database

Local development uses **SQLite** (a single file, `server/prisma/dev.db`) so it runs with zero setup.
For anything real, use **PostgreSQL**. Money is stored as integer cents, so nothing else changes.

Hosted Postgres with a free tier: [Neon](https://neon.tech) or [Supabase](https://supabase.com) (either works; Neon is the simplest).

To switch:

1. Create a database and copy its connection string.
2. In `server/prisma/schema.prisma`, change `provider = "sqlite"` to `provider = "postgresql"`.
3. In `server/.env`, set
   `DATABASE_URL="postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require"`
4. Create and apply the first migration:
   ```bash
   cd server
   npx prisma migrate dev --name init   # creates prisma/migrations/, commit this folder
   npm run db:seed                      # optional demo data
   ```
5. In production, apply migrations on deploy with `npx prisma migrate deploy`.

`npm run db:studio` opens a browser UI to look at the data.

## Monthly Report (bank statement uploads)

The free alternative to Mono: once a month, upload your bank statements on **Monthly Report**, one per bank,
as PDF, CSV, XLS or XLSX (up to 10 files, 10 MB each).

- **Any bank's layout.** The parser looks for the header row (Date / Narration / Debit / Credit / Amount / Balance) instead
  of using per-bank templates. PDFs are rebuilt into a table from the text positions. If a PDF has no header row,
  the running balance decides whether each line is money in or out. Password-protected PDFs work: enter the password
  in the upload form. Scanned (image-only) PDFs can't be read, so download a CSV/Excel statement instead.
- **Only the selected month is imported.** Re-uploading a statement, or overlapping statements, doesn't double-count:
  each row gets a fingerprint (bank + date + amount + description).
- **Removing a statement** removes every transaction it imported.

What the report shows:
- **Inflow vs outflow:** whether you spent more than you earned, and by what percentage. Money moved between your
  own banks (e.g. GTBank → Kuda) is detected and left out.
- **Subscriptions & fixed costs:** known services (Netflix, DStv, Spotify…), anything marked recurring, or a charge of the
  same amount as in the last 3 months, shown with their yearly cost.
- **Where your money leaks:** merchants you paid most often ("You paid Chowdeck 9 times").
- **Budget vs actual** for your current budgets.
- **"Are these the same?"** prompts: a manual entry and a statement row with the same amount within 3 days. "Yes" keeps the
  bank's record under your name and category and removes the manual copy. Entries marked **Cash** are never matched, because
  cash never shows up on a statement.

Try it with sample files: `cd server && npm run samples` writes `samples/gtbank-statement.csv` and
`samples/kuda-statement.xlsx` for the current month. Upload both while signed in as the demo account.

## Automatic transactions (Mono, Nigeria)

Bank transactions are imported through [Mono](https://mono.co), which connects Nigerian banks and fintechs
(GTBank, Access, Zenith, UBA, First Bank, Fidelity, Stanbic, Kuda, Opay, Moniepoint and more).
Without Mono keys the app still works; you just add transactions by hand.

1. Sign up at https://app.mono.co, create an app, and copy its **public key** and **secret key**
   (test keys start with `test_`).
2. In `server/.env`:
   ```
   MONO_PUBLIC_KEY=test_pk_...
   MONO_SECRET_KEY=test_sk_...
   ```
3. Restart the server, open **Accounts → Connect a Bank**, pick a bank in the Mono widget and use the test
   login details the widget shows.
4. Webhooks (recommended once deployed): in the Mono dashboard set the webhook URL to
   `https://your-app.com/api/bank/webhook` and the secret to the `MONO_WEBHOOK_SECRET` value in `server/.env`
   (`npm run setup` generates one). Requests without the matching `mono-webhook-secret` header are rejected.

How syncing works:
- The widget returns a one-time code. The server exchanges it for a permanent Mono account id
  (`POST /v2/accounts/auth`), fetches the account details, then imports the last 90 days of transactions.
- Later syncs fetch from a week before the last sync, so late-posted transactions aren't missed, and skip
  anything already imported (by Mono's transaction id).
- Syncs run when Mono sends `mono.events.account_updated`, every `MONO_SYNC_INTERVAL_MINUTES` in the background,
  and on "Sync now". `MONO_REALTIME=true` asks Mono to pull live from the bank on each sync (slower and may be billed).
- Mono amounts are already in kobo, which is how the app stores money, so no conversion is needed.
- Nigerian bank narrations are free text, so imported transactions are categorised by keyword
  (e.g. "IKEDC", "MTN AIRTIME" → Bills, "BOLT" → Transportation, "SHOPRITE" → Groceries).
  Users can recategorise any transaction, and the rules are in `server/src/lib/categories.js`.
- Imported transactions can be recategorised or marked recurring, but not edited or deleted: they mirror the bank.

Going live: complete Mono's business verification (KYB) on the dashboard, then swap in your live keys.
Mono charges per connected account and API call, so check their pricing page.

Currency defaults to naira (`CURRENCY=NGN`, `LOCALE=en-NG`). Change these to show amounts in another currency.

## Authentication & security

- Email + password, hashed with bcrypt (cost 12). Sessions are a signed JWT in an **httpOnly, SameSite=Lax** cookie
  (7 days), which JavaScript can't read.
- Login/register are rate limited (20 attempts / 15 min per IP).
- Every mutating request must carry an `X-Requested-With: fetch` header (CSRF protection).
- Every query is scoped to the signed-in user; other users' records return 404.
- Secrets live in `server/.env`, which is git-ignored. Never commit it.

## Deploying

The server serves the built client, so it deploys as one service (Render, Railway, Fly.io…):

```bash
cd client && npm install && npm run build
cd ../server && npm install && npx prisma migrate deploy && npm start
```

Set these environment variables on the host: `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET`,
and the `MONO_*` values. Generate secrets with
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

## Tests

```bash
cd server && npm test     # recurring-bill logic, Mono mapping, Nigerian categorisation
cd client && npm run lint
```
