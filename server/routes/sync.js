import { Router } from 'express';
import { runSync } from '../sync.js';

const router = Router();
let running = false;

router.post('/sync', async (req, res) => {
  if (running) return res.status(409).json({ error: 'Sync already running' });
  const daysBack = parseInt(req.body?.days_back) || 2;
  res.json({ message: 'Sync started', daysBack });
  running = true;
  try { await runSync({ daysBack }); }
  finally { running = false; }
});

router.get('/sync/status', (req, res) => {
  res.json({ running });
});

export default router;
