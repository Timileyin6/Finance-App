function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}. Run \`npm run setup\` or see server/.env.example.`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT) || 4000,
  isProduction: process.env.NODE_ENV === 'production',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  currency: (process.env.CURRENCY || 'NGN').toUpperCase(),
  locale: process.env.LOCALE || 'en-NG',
  mono: {
    publicKey: process.env.MONO_PUBLIC_KEY || '',
    secretKey: process.env.MONO_SECRET_KEY || '',
    webhookSecret: process.env.MONO_WEBHOOK_SECRET || '',
    // Ask Mono to fetch live from the bank on each sync (slower; may be billed separately)
    realtime: process.env.MONO_REALTIME === 'true',
    syncIntervalMinutes: Number(process.env.MONO_SYNC_INTERVAL_MINUTES) || 360,
  },
};

config.mono.enabled = Boolean(config.mono.publicKey && config.mono.secretKey);
config.mono.testMode = config.mono.secretKey.startsWith('test_');
// Postgres needs an explicit flag for case-insensitive search; SQLite's LIKE already is.
config.isPostgres = /^postgres(ql)?:/.test(config.databaseUrl);
