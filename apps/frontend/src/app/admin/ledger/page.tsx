'use client';
import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { ShieldCheck, Database, Loader2, RefreshCw, Filter } from 'lucide-react';

const EVENT_COLORS: Record<string, string> = {
  MILESTONE_ESCROW_RELEASE: 'text-emerald-400',
  ADMIN_ESCROW_RELEASE: 'text-emerald-400',
  INVESTMENT_COMMITTED: 'text-teal-400',
  BID_SUBMITTED: 'text-amber-400',
  AI_VALIDATION_PASSED: 'text-blue-400',
  ADMIN_AUDIT_APPROVED: 'text-teal-500',
  ADMIN_AUDIT_REJECTED: 'text-red-400',
  DRONE_VERIFICATION_SYNCED: 'text-purple-400',
  GOV_PROJECT_VERIFICATION: 'text-teal-500',
};

export default function AdminLedgerPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const url = typeFilter ? `/api/ledger/full?type=${typeFilter}&limit=100` : '/api/ledger/full?limit=100';
      const res = await api.get(url);
      setLogs(res.data.logs ?? []);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) { console.error(err); }
    finally { if (!silent) setLoading(false); }
  }, [typeFilter]);

  useEffect(() => { load(); const iv = setInterval(() => load(true), 10000); return () => clearInterval(iv); }, [load]);

  const eventTypes = [...new Set(logs.map(l => l.transaction_type))];

  return (
    <div className="space-y-6">
      <header className="border-l-2 border-teal-500 pl-6">
        <p className="text-[10px] text-teal-500 uppercase font-bold tracking-[0.2em] mb-1">Transparency Layer</p>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase italic">Global Ledger</h1>
            <p className="text-zinc-500 text-sm mt-1">{logs.length} immutable records · Auto-refreshes every 10s</p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && <span className="text-[10px] text-zinc-600 font-mono">Verified: {lastUpdated}</span>}
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-zinc-800 text-zinc-500">
              <Filter size={12} />
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="bg-transparent text-[10px] font-bold uppercase outline-none cursor-pointer">
                <option value="">All Events</option>
                {eventTypes.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <button onClick={() => load(false)} className="p-2 rounded-lg border border-zinc-800 text-zinc-500 hover:text-teal-500 hover:border-teal-500/50 transition-all"><RefreshCw size={14} /></button>
          </div>
        </div>
      </header>

      {loading ? <div className="py-20 text-center"><Loader2 className="animate-spin text-teal-500 mx-auto" size={24} /></div> : (
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <div className="grid grid-cols-4 gap-4 p-4 bg-zinc-900 border-b border-zinc-800">
            {['Timestamp', 'Event Type', 'Immutable Hash', 'Status'].map(h => (
              <span key={h} className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">{h}</span>
            ))}
          </div>
          <div className="divide-y divide-zinc-800/50 font-mono text-[11px]">
            {logs.map(log => (
              <div key={log.id} className="grid grid-cols-4 gap-4 p-4 hover:bg-zinc-900/30 transition-colors group">
                <span className="text-zinc-500 truncate">{new Date(log.created_at).toLocaleString()}</span>
                <span className={`font-bold uppercase truncate ${EVENT_COLORS[log.transaction_type] || 'text-zinc-400'}`}>
                  {log.transaction_type?.replace(/_/g, ' ')}
                </span>
                <span className="text-zinc-400 truncate cursor-help" title={log.immutable_hash}>
                  {log.immutable_hash ? `${log.immutable_hash.slice(0, 10)}…${log.immutable_hash.slice(-6)}` : '—'}
                </span>
                <span className="flex items-center justify-end gap-1 text-white">
                  SECURE <ShieldCheck size={11} className="text-teal-500" />
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
