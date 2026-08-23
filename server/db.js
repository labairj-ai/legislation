import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', '..', 'legislation.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS bills (
    id TEXT PRIMARY KEY,
    congress INTEGER NOT NULL DEFAULT 119,
    bill_type TEXT,
    bill_number TEXT,
    title TEXT NOT NULL,
    sponsor_name TEXT,
    sponsor_party TEXT,
    sponsor_state TEXT,
    chamber TEXT,
    stage TEXT DEFAULT 'introduced',
    latest_action TEXT,
    introduced_date TEXT,
    last_action_date TEXT,
    congress_url TEXT,
    crs_summary TEXT,
    cosponsor_count INTEGER DEFAULT 0,
    bipartisan INTEGER DEFAULT 0,
    passage_score INTEGER DEFAULT 0,
    ai_summary TEXT,
    ai_sectors TEXT DEFAULT '[]',
    ai_carveouts TEXT DEFAULT '[]',
    ai_timeline TEXT,
    ai_enriched INTEGER DEFAULT 0,
    ai_enriched_at TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_stage    ON bills(stage);
  CREATE INDEX IF NOT EXISTS idx_score    ON bills(passage_score DESC);
  CREATE INDEX IF NOT EXISTS idx_chamber  ON bills(chamber);
  CREATE INDEX IF NOT EXISTS idx_action   ON bills(last_action_date DESC);
  CREATE INDEX IF NOT EXISTS idx_enriched ON bills(ai_enriched, passage_score DESC);

  CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT,
    completed_at TEXT,
    bills_fetched INTEGER DEFAULT 0,
    bills_new INTEGER DEFAULT 0,
    bills_enriched INTEGER DEFAULT 0,
    status TEXT DEFAULT 'running',
    error TEXT
  );
`);

export function upsertBill(bill) {
  db.prepare(`
    INSERT INTO bills (
      id, congress, bill_type, bill_number, title,
      sponsor_name, sponsor_party, sponsor_state,
      chamber, stage, latest_action, introduced_date, last_action_date,
      congress_url, crs_summary, cosponsor_count, bipartisan, passage_score, updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      stage            = excluded.stage,
      latest_action    = excluded.latest_action,
      last_action_date = excluded.last_action_date,
      crs_summary      = COALESCE(excluded.crs_summary, bills.crs_summary),
      cosponsor_count  = excluded.cosponsor_count,
      bipartisan       = excluded.bipartisan,
      passage_score    = excluded.passage_score,
      updated_at       = excluded.updated_at
  `).run(
    bill.id, bill.congress, bill.bill_type, bill.bill_number, bill.title,
    bill.sponsor_name, bill.sponsor_party, bill.sponsor_state,
    bill.chamber, bill.stage, bill.latest_action,
    bill.introduced_date, bill.last_action_date,
    bill.congress_url, bill.crs_summary || '',
    bill.cosponsor_count || 0, bill.bipartisan ? 1 : 0,
    bill.passage_score || 0, new Date().toISOString()
  );
}

export function updateBillAI(id, ai) {
  db.prepare(`
    UPDATE bills
    SET ai_summary=?, ai_sectors=?, ai_carveouts=?, ai_timeline=?,
        ai_enriched=1, ai_enriched_at=?
    WHERE id=?
  `).run(
    ai.summary, JSON.stringify(ai.sectors || []),
    JSON.stringify(ai.carveouts || []), ai.timeline || '',
    new Date().toISOString(), id
  );
}

export function getBills({ chamber, stage, sector, min_score, max_score, search, sort, limit, offset } = {}) {
  const conds = [];
  const params = [];

  if (chamber && chamber !== 'all') { conds.push('chamber=?'); params.push(chamber); }
  if (stage   && stage   !== 'all') { conds.push('stage=?');   params.push(stage); }
  if (min_score != null) { conds.push('passage_score >= ?'); params.push(+min_score); }
  if (max_score != null) { conds.push('passage_score <= ?'); params.push(+max_score); }
  if (search)  { conds.push('(title LIKE ? OR ai_summary LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  if (sector && sector !== 'all') { conds.push('ai_sectors LIKE ?'); params.push(`%"${sector}"%`); }

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const order = sort === 'score' ? 'passage_score DESC, last_action_date DESC'
              : sort === 'stage' ? 'passage_score DESC, last_action_date DESC'
              : 'last_action_date DESC, passage_score DESC';

  const lim = Math.min(parseInt(limit) || 50, 200);
  const off = parseInt(offset) || 0;

  const bills = db.prepare(`SELECT * FROM bills ${where} ORDER BY ${order} LIMIT ? OFFSET ?`)
                  .all(...params, lim, off);
  const [{ total }] = db.prepare(`SELECT COUNT(*) as total FROM bills ${where}`).all(...params);
  return { bills, total };
}

export function getBillById(id) {
  return db.prepare('SELECT * FROM bills WHERE id=?').get(id);
}

export function getStats() {
  const total      = db.prepare('SELECT COUNT(*) as n FROM bills').get().n;
  const byStage    = db.prepare('SELECT stage, COUNT(*) as n FROM bills GROUP BY stage ORDER BY passage_score DESC').all();
  const byChamber  = db.prepare('SELECT chamber, COUNT(*) as n FROM bills GROUP BY chamber').all();
  const floorVote  = db.prepare("SELECT COUNT(*) as n FROM bills WHERE stage='floor_vote'").get().n;
  const highScore  = db.prepare('SELECT COUNT(*) as n FROM bills WHERE passage_score >= 60').get().n;
  const lastSync   = db.prepare("SELECT completed_at, bills_fetched, bills_new FROM sync_log WHERE status='done' ORDER BY id DESC LIMIT 1").get();
  return { total, byStage, byChamber, floorVote, highScore, lastSync };
}

export function getUnenrichedBills(limit = 30) {
  return db.prepare(`
    SELECT * FROM bills
    WHERE ai_enriched=0 AND stage != 'introduced'
    ORDER BY passage_score DESC LIMIT ?
  `).all(limit);
}

export function startSync() {
  return db.prepare("INSERT INTO sync_log (started_at, status) VALUES (?, 'running')")
           .run(new Date().toISOString()).lastInsertRowid;
}

export function finishSync(id, { bills_fetched = 0, bills_new = 0, bills_enriched = 0, error = null } = {}) {
  db.prepare(`
    UPDATE sync_log SET completed_at=?, status=?, bills_fetched=?, bills_new=?, bills_enriched=?, error=?
    WHERE id=?
  `).run(new Date().toISOString(), error ? 'error' : 'done', bills_fetched, bills_new, bills_enriched, error, id);
}

export function getRecentSyncs(limit = 10) {
  return db.prepare('SELECT * FROM sync_log ORDER BY id DESC LIMIT ?').all(limit);
}

export default db;
