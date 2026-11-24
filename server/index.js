import 'node:process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cron from 'node-cron';
import billsRouter from './routes/bills.js';
import chatRouter from './routes/chat.js';
import syncRouter  from './routes/sync.js';
import { runSync } from './sync.js';

// Load .env from project root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const [k, ...rest] = line.split('=');
    if (k?.trim() && !process.env[k.trim()]) process.env[k.trim()] = rest.join('=').trim();
  }
}

const PORT = process.env.PORT || 5200;
const CLIENT_DIST = path.join(__dirname, '..', 'client', 'dist');

const app = express();
app.use(express.json());

app.use('/api', billsRouter);
app.use('/api', chatRouter);
app.use('/api', syncRouter);

app.use(express.static(CLIENT_DIST));
app.get('*', (_, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`legislation running on port ${PORT}`);
});

// Daily sync at 11:40 PM ET
cron.schedule('40 23 * * *', () => {
  console.log('[cron] Nightly sync triggered');
  runSync({ daysBack: 2 }).catch(e => console.error('[cron] Error:', e.message));
}, { timezone: 'America/New_York' });

// Initial sync on first startup if DB is empty
import db from './db.js';
const count = db.prepare('SELECT COUNT(*) as n FROM bills').get().n;
if (count === 0) {
  console.log('[startup] No bills found — running initial sync (90 days)...');
  runSync({ daysBack: 90 }).catch(e => console.error('[startup] Error:', e.message));
}
