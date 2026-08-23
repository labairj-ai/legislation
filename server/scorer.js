const STAGE_SCORES = {
  introduced:      3,
  in_committee:    8,
  reported:       28,
  floor_vote:     48,
  passed_chamber: 68,
  conference:     82,
  signed:        100,
  vetoed:          0,
  failed:          0,
};

const MUST_PASS = [
  /national defense authorization/i,
  /appropriations act/i,
  /continuing resolution/i,
  /debt (ceiling|limit)/i,
  /omnibus/i,
  /farm bill/i,
];

export function detectStage(actionText = '') {
  const a = actionText.toLowerCase();
  if (/became public law|signed by president|signed into law|enacted/.test(a))  return 'signed';
  if (/vetoed/.test(a))                                                           return 'vetoed';
  if (/motion to recommit agreed|failed|tabled/.test(a))                         return 'failed';
  if (/passed (house|senate)|agreed to in (house|senate)|cleared for white house/.test(a)) return 'passed_chamber';
  if (/conference report|sent to conference/.test(a))                            return 'conference';
  if (/cloture (motion|vote)|placed on .*(calendar|agenda)|scheduled for (floor|consideration)|motion to proceed/.test(a)) return 'floor_vote';
  if (/ordered to be reported|committee discharged|reported by|favorably reported/.test(a)) return 'reported';
  if (/referred to|committee on|subcommittee|held at desk/.test(a))              return 'in_committee';
  return 'introduced';
}

export function scorePassage(bill) {
  const stage = bill.stage || 'introduced';
  if (stage === 'signed') return 100;
  if (stage === 'vetoed' || stage === 'failed') return 0;

  let score = STAGE_SCORES[stage] ?? 5;
  if (bill.bipartisan)  score = Math.min(score + 15, 95);
  if (MUST_PASS.some(p => p.test(bill.title))) score = Math.min(score + 20, 95);
  const num = parseInt(bill.bill_number);
  if (num && num <= 100) score = Math.min(score + 5, 95);
  return Math.round(score);
}

export const LIKELIHOOD_BAND = (score) =>
  score >= 85 ? { label: 'Near certain', color: '#22c55e' } :
  score >= 60 ? { label: 'Likely',       color: '#84cc16' } :
  score >= 35 ? { label: 'Possible',     color: '#eab308' } :
  score >= 15 ? { label: 'Long shot',    color: '#f97316' } :
                { label: 'Pipedream',    color: '#ef4444' };

export const STAGE_LABELS = {
  introduced:      'Introduced',
  in_committee:    'In Committee',
  reported:        'Reported',
  floor_vote:      'Floor Vote',
  passed_chamber:  'Passed Chamber',
  conference:      'Conference',
  signed:          'Signed',
  vetoed:          'Vetoed',
  failed:          'Failed',
};
