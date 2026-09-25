import { Router } from 'express';
import { getRecurringBills, summarizeBills } from '../services/finance.js';

const router = Router();

router.get('/', async (req, res) => {
  const bills = await getRecurringBills(req.userId);
  res.json({ bills, summary: summarizeBills(bills) });
});

export default router;
