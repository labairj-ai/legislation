import React from 'react';

const STAGES = [
  { value: 'all',            label: 'All Stages' },
  { value: 'floor_vote',     label: 'Floor Vote' },
  { value: 'reported',       label: 'Reported' },
  { value: 'in_committee',   label: 'In Committee' },
  { value: 'passed_chamber', label: 'Passed Chamber' },
  { value: 'introduced',     label: 'Introduced' },
  { value: 'signed',         label: 'Signed' },
];

const SECTORS = [
  'all','healthcare','technology','defense','energy','finance','housing',
  'education','immigration','environment','taxation','agriculture',
  'labor','transportation','judiciary','foreign_policy',
];

const LIKELIHOOD = [
  { value: '',         label: 'Any Likelihood' },
  { value: '60',       label: 'Likely (60%+)' },
  { value: '35',       label: 'Possible (35%+)' },
  { value: '0|15',     label: 'Pipedream (<15%)' },
];

const SORTS = [
  { value: 'date',  label: 'Recent Activity' },
  { value: 'score', label: 'Highest Score' },
];

export default function FilterBar({ filters, onChange }) {
  const set = (key, val) => onChange({ ...filters, [key]: val, offset: 0 });

  const likelihoodValue = filters.min_score
    ? filters.max_score ? `${filters.min_score}|${filters.max_score}` : filters.min_score
    : '';

  function setLikelihood(v) {
    if (!v) return onChange({ ...filters, min_score: '', max_score: '', offset: 0 });
    const [min, max] = v.split('|');
    onChange({ ...filters, min_score: min || '', max_score: max || '', offset: 0 });
  }

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '12px 20px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
      {/* Chamber toggle */}
      {['all','house','senate'].map(c => (
        <button key={c} className={filters.chamber === c ? 'active' : ''}
          onClick={() => set('chamber', c)}
          style={{ textTransform: 'capitalize' }}>
          {c === 'all' ? 'Both Chambers' : c}
        </button>
      ))}

      <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />

      <select value={filters.stage || 'all'} onChange={e => set('stage', e.target.value)}>
        {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>

      <select value={filters.sector || 'all'} onChange={e => set('sector', e.target.value)}
        style={{ textTransform: 'capitalize' }}>
        {SECTORS.map(s => <option key={s} value={s}>{s === 'all' ? 'All Sectors' : s.replace('_', ' ')}</option>)}
      </select>

      <select value={likelihoodValue} onChange={e => setLikelihood(e.target.value)}>
        {LIKELIHOOD.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
      </select>

      <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />

      <select value={filters.sort || 'date'} onChange={e => set('sort', e.target.value)}>
        {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>

      <input
        type="search"
        placeholder="Search bills…"
        value={filters.search || ''}
        onChange={e => set('search', e.target.value)}
        style={{ flex: 1, minWidth: 160, maxWidth: 280 }}
      />
    </div>
  );
}
