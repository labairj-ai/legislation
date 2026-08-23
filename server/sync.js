import { fetchRecentBills, normalizeBill } from './fetcher.js';
import { enrichBill } from './enricher.js';
import { upsertBill, updateBillAI, getUnenrichedBills, startSync, finishSync } from './db.js';

export async function runSync({ daysBack = 2 } = {}) {
  const syncId = startSync();
  console.log(`[sync] Starting — daysBack=${daysBack}`);
  let bills_fetched = 0, bills_new = 0, bills_enriched = 0;

  try {
    // 1. Fetch updated bills from Congress.gov
    const rawBills = await fetchRecentBills({ daysBack, maxBills: 500 });
    bills_fetched = rawBills.length;
    console.log(`[sync] Fetched ${bills_fetched} bills from Congress.gov`);

    // 2. Normalize and upsert (fetch CRS summaries in parallel batches)
    const BATCH = 5;
    for (let i = 0; i < rawBills.length; i += BATCH) {
      const batch = rawBills.slice(i, i + BATCH);
      const normalized = await Promise.allSettled(batch.map(normalizeBill));
      for (const result of normalized) {
        if (result.status === 'fulfilled') {
          upsertBill(result.value);
          bills_new++;
        } else {
          console.warn('[sync] Normalize failed:', result.reason?.message);
        }
      }
    }
    console.log(`[sync] Upserted ${bills_new} bills`);

    // 3. AI enrich pending bills (highest score first, skip 'introduced')
    const toEnrich = getUnenrichedBills(50);
    console.log(`[sync] Enriching ${toEnrich.length} bills with 70B...`);
    for (const bill of toEnrich) {
      try {
        const ai = await enrichBill(bill);
        if (ai) { updateBillAI(bill.id, ai); bills_enriched++; }
      } catch (e) {
        console.warn(`[sync] Enrichment failed for ${bill.id}: ${e.message}`);
      }
    }
    console.log(`[sync] Enriched ${bills_enriched} bills`);

    finishSync(syncId, { bills_fetched, bills_new, bills_enriched });
    console.log('[sync] Done');
  } catch (e) {
    console.error('[sync] Fatal error:', e.message);
    finishSync(syncId, { bills_fetched, bills_new, bills_enriched, error: e.message });
  }
}
