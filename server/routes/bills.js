import { Router } from 'express';
import { getBills, getBillById, getStats, getRecentSyncs } from '../db.js';

const router = Router();

router.get('/bills', (req, res) => {
  try {
    const result = getBills(req.query);
    // Parse JSON columns before sending
    result.bills = result.bills.map(parseBill);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/bills/:id', (req, res) => {
  const bill = getBillById(req.params.id);
  if (!bill) return res.status(404).json({ error: 'Not found' });
  res.json(parseBill(bill));
});

router.get('/stats', (req, res) => {
  res.json(getStats());
});

router.get('/syncs', (req, res) => {
  res.json(getRecentSyncs());
});

function parseBill(b) {
  return {
    ...b,
    ai_sectors:   tryParse(b.ai_sectors,  []),
    ai_carveouts: tryParse(b.ai_carveouts, []),
    bipartisan: !!b.bipartisan,
    ai_enriched: !!b.ai_enriched,
  };
}

function tryParse(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

export default router;
