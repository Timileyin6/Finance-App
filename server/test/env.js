// Minimal env so modules that read config can be imported in unit tests.
process.env.DATABASE_URL ??= 'file:./test.db';
process.env.JWT_SECRET ??= 'test-secret';
