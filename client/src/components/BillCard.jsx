import React from 'react';
import LikelihoodBar from './LikelihoodBar.jsx';

const STAGE_COLORS = {
  floor_vote:     { bg: '#2d2000', border: '#f97316', text: '#fb923c' },
  reported:       { bg: '#1a2500', border: '#84cc16', text: '#86efac' },
  passed_chamber: { bg: '#002020', border: '#22c55e', text: '#4ade80' },
  signed:         { bg: '#001a10', border: '#16a34a', text: '#4ade80' },
  in_committee:   { bg: '#1a1d23', border: '#4493f8', text: '#93c5fd' },
  introduced:     { bg: '#1a1d23', border: '#30363d', text: '#7d8590' },
  conference:     { bg: '#200020', border: '#a855f7', text: '#c084fc' },
  vetoed:         { bg: '#200000', border: '#ef4444', text: '#f87171' },
  failed:         { bg: '#200000', border: '#ef4444', text: '#f87171' },
};

const STAGE_LABELS = {
  introduced: 'Introduced', in_committee: 'In Committee', reported: 'Reported',
  floor_vote: 'Floor Vote', passed_chamber: 'Passed Chamber', conference: 'Conference',
  signed: 'Signed', vetoed: 'Vetoed', failed: 'Failed',
};

const PARTY_COLOR = { R: '#ef4444', D: '#4493f8', I: '#a855f7' };

const truncate = (str, max) => str && str.length > max ? str.slice(0, max).replace(/\s\S*$/, '') + '…' : str;

export default function BillCard({ bill, onClick }) {
  const stage = STAGE_COLORS[bill.stage] || STAGE_COLORS.introduced;
  const sectors = Array.isArray(bill.ai_sectors) ? bill.ai_sectors : [];

  return (
    <div
      onClick={() => onClick(bill)}
      className="card"
      style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10, transition: 'border-color 0.15s', borderColor: stage.border }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = stage.border}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, justifyContent: 'space-between' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>
              {bill.bill_type?.toUpperCase()} {bill.bill_number}
            </span>
            {' · '}
            <span style={{ textTransform: 'capitalize' }}>{bill.chamber}</span>
            {bill.sponsor_name && (
              <> · {bill.sponsor_name}
                {bill.sponsor_party && (
                  <span style={{ color: PARTY_COLOR[bill.sponsor_party] || 'var(--muted)', fontWeight: 700 }}>
                    {' '}({bill.sponsor_party})
                  </span>
                )}
              </>
            )}
          </div>
          <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.4 }}>{bill.title}</div>
        </div>
        <div style={{
          flexShrink: 0,
          fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
          background: stage.bg, border: `1px solid ${stage.border}`, color: stage.text,
          whiteSpace: 'nowrap',
        }}>
          {STAGE_LABELS[bill.stage] || bill.stage}
        </div>
      </div>

      {/* Summary — AI when enriched, CRS fallback otherwise */}
      {(bill.ai_summary || bill.crs_summary) && (
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, margin: 0 }}>
          {truncate(bill.ai_summary || bill.crs_summary, 220)}
        </p>
      )}

      {/* Sectors */}
      {sectors.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {sectors.map(s => (
            <span key={s} style={{
              fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20,
              background: 'var(--surface2)', border: '1px solid var(--border)',
              color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
              {s.replace('_', ' ')}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 'auto' }}>
        <LikelihoodBar score={bill.passage_score || 0} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
            {bill.ai_timeline || ''}
          </span>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
            {bill.last_action_date
              ? new Date(bill.last_action_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
