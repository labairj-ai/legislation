import React, { useState, useEffect, useCallback, useRef } from 'react';
import StatsBar from './components/StatsBar.jsx';
import FilterBar from './components/FilterBar.jsx';
import BillCard  from './components/BillCard.jsx';
import BillDetail from './components/BillDetail.jsx';

const DEFAULT_FILTERS = { chamber: 'all', stage: 'all', sector: 'all', min_score: '', max_score: '', search: '', sort: 'date', limit: 50, offset: 0 };

export default function App() {
  const [bills, setBills]       = useState([]);
  const [total, setTotal]       = useState(0);
  const [stats, setStats]       = useState(null);
  const [filters, setFilters]   = useState(DEFAULT_FILTERS);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [syncing, setSyncing]   = useState(false);
  const searchTimer = useRef(null);

  const loadStats = useCallback(async () => {
    const r = await fetch('/api/stats');
    if (r.ok) setStats(await r.json());
  }, []);

  const loadBills = useCallback(async (f) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(f)) if (v !== '' && v !== 'all') params.set(k, v);
      const r = await fetch(`/api/bills?${params}`);
      if (!r.ok) return;
      const data = await r.json();
      if (f.offset > 0) setBills(prev => [...prev, ...data.bills]);
      else setBills(data.bills);
      setTotal(data.total);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  useEffect(() => {
    // Debounce search
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadBills(filters), filters.search ? 400 : 0);
    return () => clearTimeout(searchTimer.current);
  }, [filters, loadBills]);

  function handleFiltersChange(newFilters) {
    setFilters({ ...newFilters, offset: 0 });
    setBills([]);
  }

  function loadMore() {
    const next = { ...filters, offset: (filters.offset || 0) + 50 };
    setFilters(next);
    loadBills(next);
  }

  async function triggerSync() {
    setSyncing(true);
    try {
      await fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ days_back: 3 }) });
      // Poll until done
      const poll = setInterval(async () => {
        const r = await fetch('/api/sync/status');
        const { running } = await r.json();
        if (!running) {
          clearInterval(poll);
          setSyncing(false);
          await Promise.all([loadStats(), loadBills(filters)]);
        }
      }, 3000);
    } catch { setSyncing(false); }
  }

  const hasMore = bills.length < total;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div>
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>Legislation Watchdog</span>
          <span style={{ color: 'var(--muted)', fontSize: 13, marginLeft: 10 }}>119th Congress</span>
        </div>
        {stats && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <span style={{ fontSize: 12, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 10px', color: 'var(--muted)' }}>
              House + Senate
            </span>
          </div>
        )}
      </header>

      <StatsBar stats={stats} syncing={syncing} onSync={triggerSync} />
      <FilterBar filters={filters} onChange={handleFiltersChange} />

      {/* Bill grid */}
      <main style={{ flex: 1, padding: 20, maxWidth: 1400, width: '100%', margin: '0 auto' }}>
        {bills.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
            {stats?.total === 0
              ? 'Fetching bills from Congress.gov on first startup — check back in a few minutes.'
              : 'No bills match these filters.'}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 14 }}>
          {bills.map(bill => (
            <BillCard key={bill.id} bill={bill} onClick={setSelected} />
          ))}
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Loading…</div>
        )}

        {hasMore && !loading && (
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <button onClick={loadMore} style={{ padding: '8px 24px' }}>
              Load more ({bills.length} of {total})
            </button>
          </div>
        )}
      </main>

      {selected && <BillDetail bill={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
