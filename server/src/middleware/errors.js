import { ZodError } from 'zod';
import multer from 'multer';
import { Prisma } from '@prisma/client';
import { HttpError } from '../lib/errors.js';

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: err.issues[0]?.message ?? 'Invalid input',
      details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    return res.status(409).json({ error: 'That already exists' });
  }
  if (err instanceof multer.MulterError) {
    const messages = {
      LIMIT_FILE_SIZE: 'Each statement must be under 10 MB',
      LIMIT_FILE_COUNT: 'Upload at most 10 statements at a time',
      LIMIT_UNEXPECTED_FILE: 'Upload statements using the "files" field',
    };
    return res.status(400).json({ error: messages[err.code] ?? err.message });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON body' });
  }
  console.error(`[${req.method} ${req.originalUrl}]`, err);
  res.status(500).json({ error: 'Something went wrong' });
}
