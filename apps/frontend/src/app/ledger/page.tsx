'use client';
import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import Navbar from '@/components/Navbar';
import { ShieldCheck, Database, AlertCircle, Loader2, RefreshCw } from 'lucide-react';

interface LedgerLog {
  id: string;
  transaction_type: string;
  immutable_hash: string;
  payload?: Record<string, any>;
  created_at: string;
}

export default function TransparencyLayer() {
  const [logs, setLogs] = useState<LedgerLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const fetchLedger = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await api.get('/api/ledger');
      setLogs(res.data.logs ?? []);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to connect to ledger.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    fetchLedger(false);
    const interval = setInterval(() => fetchLedger(true), 10000);
    return () => clearInterval(interval);
  }, [fetchLedger]);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <main className="max-w-7xl mx-auto p-8">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4">
            <Database className="text-teal-500" />
            <h1 className="text-2xl font-bold uppercase tracking-tighter">Global Ledger (Live)</h1>
          </div>
          <div className="flex items-center gap-4">
            {lastUpdated && <span className="text-[10px] text-zinc-600 font-mono italic">Verified: {lastUpdated}</span>}
            <button onClick={() => fetchLedger(false)} disabled={loading} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-800 text-zinc-400 hover:border-teal-500/50 hover:text-teal-500 transition-all text-[10px] uppercase font-bold">
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Sync
            </button>
          </div>
        </div>

        {loading && logs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="animate-spin text-teal-500" size={28} />
            <p className="text-zinc-500 text-xs uppercase tracking-widest font-bold">Querying Truth Layer...</p>
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <AlertCircle className="text-red-500" size={28} />
            <p className="text-red-400 text-xs font-mono">{error}</p>
            <button onClick={() => fetchLedger(false)} className="text-teal-500 text-xs underline">Retry</button>
          </div>
        )}

        {!loading && !error && logs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Database className="text-zinc-700" size={28} />
            <p className="text-zinc-600 text-xs uppercase tracking-widest font-bold">No ledger entries yet</p>
            <p className="text-zinc-700 text-[10px] font-mono">Events will appear here as actions occur.</p>
          </div>
        )}

        {logs.length > 0 && (
          <div className="space-y-2 font-mono text-[11px]">
            {logs.map((log) => (
              <div key={log.id} className="grid grid-cols-4 gap-4 p-4 border border-zinc-800 bg-zinc-900/20 rounded-lg hover:border-teal-500/50 transition-all">
                <span className="text-zinc-500 truncate">{new Date(log.created_at).toLocaleString()}</span>
                <span className="text-teal-500 font-bold uppercase truncate">{log.transaction_type.replace(/_/g, ' ')}</span>
                <span className="text-zinc-400 truncate" title={log.immutable_hash}>
                  {log.immutable_hash ? `${log.immutable_hash.slice(0, 8)}…${log.immutable_hash.slice(-8)}` : '—'}
                </span>
                <span className="text-right text-white flex items-center justify-end gap-1">SECURE <ShieldCheck size={12} className="text-teal-500" /></span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
