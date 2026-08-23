import React from 'react';

const BANDS = [
  { max: 15,  label: 'Pipedream',    color: '#ef4444' },
  { max: 35,  label: 'Long shot',    color: '#f97316' },
  { max: 60,  label: 'Possible',     color: '#eab308' },
  { max: 85,  label: 'Likely',       color: '#84cc16' },
  { max: 101, label: 'Near certain', color: '#22c55e' },
];

export function getBand(score) {
  return BANDS.find(b => score < b.max) || BANDS[BANDS.length - 1];
}

export default function LikelihoodBar({ score, showLabel = true }) {
  const band = getBand(score);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        {showLabel && <span style={{ fontSize: 11, color: band.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{band.label}</span>}
        <span style={{ fontSize: 12, color: band.color, fontWeight: 700, marginLeft: 'auto' }}>{score}%</span>
      </div>
      <div style={{ height: 4, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score}%`, background: band.color, borderRadius: 4, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}
