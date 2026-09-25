import { config } from './config.js';
import { createApp } from './app.js';
import { prisma } from './db.js';
import { syncAllConnections } from './services/mono.js';

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
  console.log(
    config.mono.enabled
      ? `Mono bank sync enabled (${config.mono.testMode ? 'test' : 'live'} keys)`
      : 'Mono not configured — manual transactions only',
  );
});

// Background bank sync, in addition to Mono's webhook, so data stays fresh
// even when the server isn't reachable from the internet (e.g. local dev).
let syncTimer;
if (config.mono.enabled) {
  syncTimer = setInterval(() => {
    syncAllConnections().catch((err) => console.error('[mono] scheduled sync failed:', err));
  }, config.mono.syncIntervalMinutes * 60 * 1000);
}

async function shutdown() {
  clearInterval(syncTimer);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
