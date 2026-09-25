import express from 'express';
import cookieParser from 'cookie-parser';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { CATEGORIES, THEMES } from './lib/categories.js';
import { HttpError } from './lib/errors.js';
import { requireAjaxHeader, requireAuth } from './middleware/auth.js';
import { errorHandler } from './middleware/errors.js';
import authRoutes from './routes/auth.js';
import bankRoutes from './routes/bank.js';
import budgetRoutes from './routes/budgets.js';
import overviewRoutes from './routes/overview.js';
import potRoutes from './routes/pots.js';
import recurringRoutes from './routes/recurring.js';
import reportRoutes from './routes/reports.js';
import statementRoutes from './routes/statements.js';
import transactionRoutes from './routes/transactions.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (config.isProduction) app.set('trust proxy', 1); // correct client IPs for rate limiting behind a host's proxy

  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  const api = express.Router();
  // Mono's webhook comes from Mono's servers, not our browser app, so it skips the CSRF header check.
  api.use((req, res, next) => (req.path === '/bank/webhook' ? next() : requireAjaxHeader(req, res, next)));

  api.get('/health', (_req, res) => res.json({ ok: true }));
  api.get('/meta', (_req, res) =>
    res.json({
      categories: CATEGORIES,
      themes: THEMES,
      currency: config.currency,
      locale: config.locale,
      bank: { provider: 'mono', enabled: config.mono.enabled, publicKey: config.mono.publicKey, testMode: config.mono.testMode },
    }),
  );
  api.use('/auth', authRoutes);
  api.use('/bank', bankRoutes);
  api.use('/overview', requireAuth, overviewRoutes);
  api.use('/transactions', requireAuth, transactionRoutes);
  api.use('/budgets', requireAuth, budgetRoutes);
  api.use('/pots', requireAuth, potRoutes);
  api.use('/recurring', requireAuth, recurringRoutes);
  api.use('/statements', requireAuth, statementRoutes);
  api.use('/reports', requireAuth, reportRoutes);
  api.use((req, _res, next) => next(new HttpError(404, `No API route for ${req.method} ${req.originalUrl}`)));

  app.use('/api', api);

  // In production the server also serves the built React app (client/dist).
  const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
