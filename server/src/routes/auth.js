import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../db.js';
import { HttpError } from '../lib/errors.js';
import { SESSION_COOKIE, clearSessionCookie, requireAuth, setSessionCookie } from '../middleware/auth.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again in a few minutes' },
});

const email = z.string().trim().toLowerCase().email('Enter a valid email address');
const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  email,
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
});
const loginSchema = z.object({ email, password: z.string().min(1, 'Password is required').max(200) });

// Compared against when the email doesn't exist, so response time doesn't reveal which emails are registered.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

const publicUser = ({ id, name, email }) => ({ id, name, email });

router.post('/register', authLimiter, async (req, res) => {
  const data = registerSchema.parse(req.body);
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new HttpError(409, 'An account with that email already exists');

  const user = await prisma.user.create({
    data: { name: data.name, email: data.email, passwordHash: await bcrypt.hash(data.password, 12) },
  });
  setSessionCookie(res, user.id);
  res.status(201).json({ user: publicUser(user) });
});

router.post('/login', authLimiter, async (req, res) => {
  const data = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  const valid = await bcrypt.compare(data.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) throw new HttpError(401, 'Incorrect email or password');

  setSessionCookie(res, user.id);
  res.json({ user: publicUser(user) });
});

router.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

// Returns { user: null } (not 401) when signed out: "who am I?" isn't an error.
router.get('/me', (req, res, next) => {
  if (!req.cookies?.[SESSION_COOKIE]) return res.json({ user: null });
  requireAuth(req, res, async (err) => {
    if (err) {
      clearSessionCookie(res);
      return res.json({ user: null });
    }
    try {
      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      if (!user) clearSessionCookie(res);
      res.json({ user: user ? publicUser(user) : null });
    } catch (e) {
      next(e);
    }
  });
});

export default router;
