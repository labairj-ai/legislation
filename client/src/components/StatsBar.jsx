import React from 'react';

export default function StatsBar({ stats, syncing, onSync }) {
  if (!stats) return null;
  const lastSync = stats.lastSync?.completed_at ? new Date(stats.lastSync.completed_at).toLocaleString() : 'Never';

  return (
    <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
      <Stat label="Tracked" value={stats.total} />
      <Stat label="Floor Vote" value={stats.floorVote} accent="var(--warn)" />
      <Stat label="High Likelihood" value={stats.highScore} accent="var(--ok)" />
      <div style={{ display: 'flex', gap: 12, marginLeft: 'auto', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>Last sync: {lastSync}</span>
        <button onClick={onSync} disabled={syncing} style={{ fontSize: 12, padding: '4px 12px' }}>
          {syncing ? 'Syncing…' : 'Sync Now'}
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 60 }}>
      <span style={{ fontSize: 20, fontWeight: 800, color: accent || 'var(--text)', lineHeight: 1 }}>{value ?? '—'}</span>
      <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 2 }}>{label}</span>
    </div>
  );
}
