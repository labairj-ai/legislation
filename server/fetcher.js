import fetch from 'node-fetch';
import { detectStage, scorePassage } from './scorer.js';

const BASE = 'https://api.congress.gov/v3';
const CONGRESS = 119;

async function get(path, params = {}) {
  // Build query string manually to avoid URLSearchParams percent-encoding '+' in sort values
  const pairs = [
    `api_key=${process.env.CONGRESS_API_KEY}`,
    'format=json',
    ...Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%2B/g, '+')}`),
  ];
  const url = `${BASE}${path}?${pairs.join('&')}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`Congress API ${r.status} ${path}`);
  return r.json();
}

const BILL_TYPE_PATH = {
  hr: 'house-bill', s: 'senate-bill',
  hjres: 'house-joint-resolution', sjres: 'senate-joint-resolution',
  hres: 'house-resolution', sres: 'senate-resolution',
  hconres: 'house-concurrent-resolution', sconres: 'senate-concurrent-resolution',
};

function congressSuffix(n) {
  const d = n % 100;
  if (d >= 11 && d <= 13) return 'th';
  return ['th','st','nd','rd','th','th','th','th','th','th'][d % 10];
}

function buildUrl(congress, type, number) {
  const typePath = BILL_TYPE_PATH[type.toLowerCase()] || 'bill';
  return `https://www.congress.gov/bill/${congress}${congressSuffix(congress)}-congress/${typePath}/${number}`;
}

async function fetchDetail(congress, type, number) {
  try {
    const [detailRes, summaryRes] = await Promise.allSettled([
      get(`/bill/${congress}/${type.toLowerCase()}/${number}`),
      get(`/bill/${congress}/${type.toLowerCase()}/${number}/summaries`),
    ]);
    const detail    = detailRes.status === 'fulfilled'  ? detailRes.value?.bill    : null;
    const summaries = summaryRes.status === 'fulfilled' ? summaryRes.value?.summaries : [];
    const latest = (summaries || []).sort((a, b) => new Date(b.updateDate) - new Date(a.updateDate))[0];
    const crsSummary = (latest?.text || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    return { detail, crsSummary };
  } catch { return { detail: null, crsSummary: '' }; }
}

export async function fetchRecentBills({ daysBack = 2, maxBills = 500 } = {}) {
  const from = new Date(Date.now() - daysBack * 86400000).toISOString().split('.')[0] + 'Z';
  const bills = [];
  let offset = 0;

  while (bills.length < maxBills) {
    const data = await get(`/bill/${CONGRESS}`, {
      fromDateTime: from,
      sort: 'updateDate+desc',
      limit: 250,
      offset,
    });
    const page = data.bills || [];
    if (!page.length) break;
    bills.push(...page);
    if (page.length < 250) break;
    offset += 250;
    await new Promise(r => setTimeout(r, 600)); // stay under rate limit
  }

  return bills.slice(0, maxBills);
}

// Enrich a raw bill list entry into a normalized record, fetching CRS summary
export async function normalizeBill(raw) {
  const type   = (raw.type || '').toLowerCase();
  const number = String(raw.number || '');
  const congress = raw.congress || CONGRESS;
  const id = `${congress}-${type}-${number}`;

  const latestAction = raw.latestAction?.text || '';
  const stage = detectStage(latestAction);

  // Fetch detail + CRS summary for bills past introduction
  let crsSummary = '', detailSponsor = null, cosponsors = 0;
  if (stage !== 'introduced') {
    const { detail, crsSummary: crs } = await fetchDetail(congress, type, number);
    crsSummary = crs;
    detailSponsor = detail?.sponsors?.[0] || null;
    cosponsors = detail?.cosponsors?.count || 0;
  }

  const sponsor = detailSponsor || raw.sponsors?.[0] || raw.sponsor || {};
  const sponsorParty = sponsor.party || '';
  const bipartisan = false; // conservative default; would need cosponsor party breakdown to set true

  const chamber = (raw.originChamber || '').toLowerCase() === 'house' ? 'house'
    : (raw.originChamber || '').toLowerCase() === 'senate' ? 'senate'
    : type.startsWith('h') ? 'house' : 'senate';

  const bill = {
    id,
    congress,
    bill_type: type,
    bill_number: number,
    title: (raw.title || '').trim(),
    sponsor_name: [sponsor.firstName, sponsor.lastName].filter(Boolean).join(' ') || sponsor.fullName || '',
    sponsor_party: sponsorParty,
    sponsor_state: sponsor.state || '',
    chamber,
    stage,
    latest_action: latestAction,
    introduced_date: raw.introducedDate || '',
    last_action_date: raw.latestAction?.actionDate || '',
    congress_url: buildUrl(congress, type, number),
    crs_summary: crsSummary,
    cosponsor_count: cosponsors || 0,
    bipartisan,
  };

  bill.passage_score = scorePassage(bill);
  return bill;
}
