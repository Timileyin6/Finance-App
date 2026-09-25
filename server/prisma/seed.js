// Creates a demo account with realistic Nigerian data (amounts in naira), dated relative to today so the
// "this month" figures are never empty. Re-running resets the demo account.
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_EMAIL = 'demo@finance.app';
const DEMO_PASSWORD = 'password123';

const today = new Date();
const dayInMonth = (monthsAgo, day) => {
  const d = new Date(today.getFullYear(), today.getMonth() - monthsAgo, 1, 12);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return d;
};
const daysAgo = (n) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - n, 12);

const recurringBills = [
  { name: 'IKEDC Prepaid Electricity', category: 'Bills', amount: 25000, day: 2 },
  { name: 'Fitness Hub Lekki', category: 'Personal Care', amount: 15000, day: 3 },
  { name: 'Coursera Plus', category: 'Education', amount: 12000, day: 4 },
  { name: 'Netflix', category: 'Entertainment', amount: 7000, day: 11 },
  { name: 'MTN Data Bundle', category: 'Bills', amount: 10000, day: 21 },
  { name: 'DSTV Compact', category: 'Bills', amount: 19000, day: 23 },
  { name: 'Spectranet Internet', category: 'Bills', amount: 20000, day: 29 },
  { name: 'LAWMA Waste', category: 'Bills', amount: 3000, day: 30 },
];

const oneOffs = [
  { name: 'Transfer from Adaeze Okafor', category: 'Transfer', amount: 35000, daysAgo: 0, counterparty: 'Adaeze Okafor' },
  { name: 'Chicken Republic Yaba', category: 'Dining Out', amount: -6500, daysAgo: 0 },
  { name: 'Bolt Ride', category: 'Transportation', amount: -4200, daysAgo: 1 },
  { name: 'Freelance Payment', category: 'Income', amount: 120000, daysAgo: 2 },
  { name: 'Shoprite Lekki', category: 'Groceries', amount: -38500, daysAgo: 2 },
  { name: 'Jumia Order', category: 'Shopping', amount: -27900, daysAgo: 3 },
  { name: 'Transfer from Tunde Bakare', category: 'Transfer', amount: 20000, daysAgo: 4, counterparty: 'Tunde Bakare' },
  { name: 'Rent share', category: 'Transfer', amount: -150000, daysAgo: 6, counterparty: 'Chidi Eze' },
  { name: 'Chowdeck Order', category: 'Dining Out', amount: -9800, daysAgo: 5 },
  { name: 'Filmhouse Cinemas', category: 'Entertainment', amount: -8000, daysAgo: 6 },
  { name: 'Mile 12 Market', category: 'Groceries', amount: -22000, daysAgo: 7, isCash: true },
  { name: 'Airtime Top-up', category: 'Bills', amount: -2000, daysAgo: 8 },
  { name: 'Uber Trip', category: 'Transportation', amount: -5600, daysAgo: 9 },
  { name: 'Salon Visit', category: 'Personal Care', amount: -12000, daysAgo: 10 },
  { name: 'Konga Purchase', category: 'Shopping', amount: -45000, daysAgo: 12 },
  { name: 'Suya Spot', category: 'Dining Out', amount: -4500, daysAgo: 14, isCash: true },
  { name: 'Lunch', category: 'Dining Out', amount: -3200, daysAgo: 3 },
  { name: 'Okada to work', category: 'Transportation', amount: -1500, daysAgo: 4, isCash: true },
  { name: 'NNPC Filling Station', category: 'Transportation', amount: -30000, daysAgo: 16 },
  { name: 'MedPlus Pharmacy', category: 'Personal Care', amount: -8700, daysAgo: 20 },
  { name: 'Justrite Supermarket', category: 'Groceries', amount: -26400, daysAgo: 24 },
  { name: 'Spotify', category: 'Entertainment', amount: -1300, daysAgo: 30 },
  { name: 'Ikeja City Mall', category: 'Shopping', amount: -31000, daysAgo: 38 },
];

const cents = (n) => Math.round(n * 100);

async function main() {
  await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });
  const user = await prisma.user.create({
    data: { email: DEMO_EMAIL, name: 'Demo User', passwordHash: await bcrypt.hash(DEMO_PASSWORD, 12) },
  });

  const transactions = [
    { name: 'Opening balance', category: 'General', amountCents: cents(600000), date: dayInMonth(3, 1) },
  ];
  for (let monthsAgo = 2; monthsAgo >= 0; monthsAgo--) {
    transactions.push({ name: 'Main Salary', category: 'Income', amountCents: cents(450000), date: dayInMonth(monthsAgo, 1), recurring: false });
    for (const bill of recurringBills) {
      const date = dayInMonth(monthsAgo, bill.day);
      if (date > today) continue; // this month's later bills aren't paid yet
      transactions.push({ name: bill.name, category: bill.category, amountCents: -cents(bill.amount), date, recurring: true });
    }
  }
  for (const t of oneOffs) {
    transactions.push({ name: t.name, category: t.category, amountCents: cents(t.amount), date: daysAgo(t.daysAgo), isCash: Boolean(t.isCash), counterparty: t.counterparty ?? null });
  }
  await prisma.transaction.createMany({ data: transactions.map((t) => ({ ...t, userId: user.id, source: 'manual' })) });

  await prisma.budget.createMany({
    data: [
      { category: 'Entertainment', maximumCents: cents(25000), theme: '#277C78' },
      { category: 'Bills', maximumCents: cents(120000), theme: '#82C9D7' },
      { category: 'Dining Out', maximumCents: cents(20000), theme: '#F2CDAC' },
      { category: 'Personal Care', maximumCents: cents(40000), theme: '#626070' },
    ].map((b) => ({ ...b, userId: user.id })),
  });

  await prisma.pot.createMany({
    data: [
      { name: 'Emergency Fund', targetCents: cents(1000000), totalCents: cents(250000), theme: '#277C78' },
      { name: 'Detty December', targetCents: cents(300000), totalCents: cents(180000), theme: '#626070' },
      { name: 'Rent', targetCents: cents(1500000), totalCents: cents(600000), theme: '#82C9D7' },
      { name: 'New Laptop', targetCents: cents(900000), totalCents: cents(120000), theme: '#F2CDAC' },
      { name: 'Wedding Aso-ebi', targetCents: cents(150000), totalCents: cents(45000), theme: '#826CB0' },
    ].map((p) => ({ ...p, userId: user.id })),
  });

  console.log(`Seeded demo account → ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
