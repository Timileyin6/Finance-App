// Empties an account's transactions so you can test statement uploads from a clean slate.
// Keeps the account, budgets and pots (pot balances are reset to ₦0, since the money in them
// came from the deleted transactions).
//   npm run db:clear                     → demo@finance.app
//   npm run db:clear -- you@example.com  → another account
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const email = (process.argv[2] || 'demo@finance.app').toLowerCase();

const user = await prisma.user.findUnique({ where: { email } });
if (!user) {
  console.error(`No account with email ${email}`);
  process.exitCode = 1;
} else {
  const [transactions, statements] = await prisma.$transaction([
    prisma.transaction.deleteMany({ where: { userId: user.id } }),
    prisma.statementUpload.deleteMany({ where: { userId: user.id } }),
    prisma.dismissedMatch.deleteMany({ where: { userId: user.id } }),
    prisma.pot.updateMany({ where: { userId: user.id }, data: { totalCents: 0 } }),
  ]);
  console.log(`${email}: deleted ${transactions.count} transactions and ${statements.count} statements; pot balances reset to 0.`);
}
await prisma.$disconnect();
