import React from 'react';
import LikelihoodBar from './LikelihoodBar.jsx';

const STAGE_LABELS = {
  introduced: 'Introduced', in_committee: 'In Committee', reported: 'Reported',
  floor_vote: 'Floor Vote', passed_chamber: 'Passed Chamber', conference: 'Conference',
  signed: 'Signed', vetoed: 'Vetoed', failed: 'Failed',
};
const PARTY_COLOR = { R: '#ef4444', D: '#4493f8', I: '#a855f7' };

export default function BillDetail({ bill, onClose }) {
  if (!bill) return null;
  const sectors   = Array.isArray(bill.ai_sectors)   ? bill.ai_sectors   : [];
  const carveouts = Array.isArray(bill.ai_carveouts)  ? bill.ai_carveouts : [];

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', overflowY: 'auto' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, width: '100%', maxWidth: 700, padding: 28, position: 'relative' }}>
        {/* Close */}
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, fontSize: 18, lineHeight: 1, padding: '4px 10px' }}>×</button>

        {/* ID + chamber */}
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
          <span style={{ fontWeight: 700, color: 'var(--text)' }}>{bill.bill_type?.toUpperCase()} {bill.bill_number}</span>
          {' · '}
          <span style={{ textTransform: 'capitalize' }}>{bill.chamber} · 119th Congress</span>
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.3, marginBottom: 14, paddingRight: 40 }}>{bill.title}</h2>

        {/* Score */}
        <div style={{ marginBottom: 16 }}>
          <LikelihoodBar score={bill.passage_score || 0} />
        </div>

        {/* Meta grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', marginBottom: 18, fontSize: 13 }}>
          <Meta label="Stage" value={STAGE_LABELS[bill.stage] || bill.stage} />
          <Meta label="Introduced" value={bill.introduced_date || '—'} />
          <Meta label="Last Action" value={bill.last_action_date || '—'} />
          <Meta label="Timeline" value={bill.ai_timeline || '—'} />
          <Meta label="Sponsor" value={
            bill.sponsor_name
              ? <span>{bill.sponsor_name} <span style={{ color: PARTY_COLOR[bill.sponsor_party] || 'var(--muted)', fontWeight: 700 }}>({bill.sponsor_party}, {bill.sponsor_state})</span></span>
              : '—'
          } />
          <Meta label="Co-sponsors" value={bill.cosponsor_count || 0} />
        </div>

        {/* Latest action */}
        {bill.latest_action && (
          <Section title="Latest Action">
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>{bill.latest_action}</p>
          </Section>
        )}

        {/* AI summary */}
        {bill.ai_summary && (
          <Section title="What This Bill Does">
            <p style={{ fontSize: 14, lineHeight: 1.6 }}>{bill.ai_summary}</p>
          </Section>
        )}

        {/* Sectors */}
        {sectors.length > 0 && (
          <Section title="Impact Sectors">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {sectors.map(s => (
                <span key={s} style={{
                  fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20,
                  background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)',
                  textTransform: 'capitalize',
                }}>
                  {s.replace('_', ' ')}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* Carve-outs */}
        {carveouts.length > 0 && (
          <Section title="Key Carve-outs & Exemptions">
            <ul style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {carveouts.map((c, i) => (
                <li key={i} style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{c}</li>
              ))}
            </ul>
          </Section>
        )}

        {/* CRS summary */}
        {bill.crs_summary && (
          <Section title="Official CRS Summary">
            <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>{bill.crs_summary.slice(0, 800)}{bill.crs_summary.length > 800 ? '…' : ''}</p>
          </Section>
        )}

        {/* Links */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 12 }}>
          {bill.congress_url && (
            <a href={bill.congress_url} target="_blank" rel="noreferrer"
              style={{ fontSize: 13, padding: '6px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6 }}>
              View on Congress.gov ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function Meta({ label, value }) {
  return (
    <div>
      <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 2 }}>{label}</span>
      <span style={{ fontSize: 13 }}>{value}</span>
    </div>
  );
}
