// Creates server/.env from .env.example with freshly generated secrets.
// Safe to re-run: an existing .env is never overwritten.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');

if (fs.existsSync(envPath)) {
  console.log('server/.env already exists — leaving it alone.');
} else {
  const env = fs
    .readFileSync(path.join(root, '.env.example'), 'utf8')
    .replace(/^JWT_SECRET=$/m, `JWT_SECRET=${crypto.randomBytes(48).toString('hex')}`)
    .replace(/^MONO_WEBHOOK_SECRET=$/m, `MONO_WEBHOOK_SECRET=${crypto.randomBytes(24).toString('hex')}`);
  fs.writeFileSync(envPath, env, { mode: 0o600 });
  console.log('Created server/.env with generated secrets.');
}
