'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import {
  TrendingUp, DollarSign, Building2, Loader2,
  AlertCircle, ArrowRight, Calendar, ShieldCheck
} from 'lucide-react';

// ── Defensive numeric helpers — never crash on undefined/null/NaN ──────────
const safeN = (v: any): number => { const n = Number(v); return (v == null || isNaN(n)) ? 0 : n; };
const safeF = (v: any): string => safeN(v).toLocaleString();
const safeD = (v: any, d = 2): string => safeN(v).toFixed(d);


interface Distribution {
  id: string; amount_ngn: number; share_pct: number;
  project_title: string; project_number: string; unit_name?: string;
  period_month: string; paid_at?: string; rent_total: number;
  investment_stake?: number;
}

export default function RentalPortfolioPage() {
  const { user } = useAuth();
  const [data,    setData]    = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    api.get('/api/rental/portfolio')
      .then(res => setData(res.data))
      .catch(ex => setError(ex?.response?.data?.error ?? 'Could not load rental income.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar />
      <div className="flex items-center justify-center py-40">
        <Loader2 className="animate-spin text-teal-500" size={32} />
      </div>
      <Footer />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar />
      <div className="max-w-xl mx-auto px-6 py-40 text-center space-y-4">
        <AlertCircle className="text-amber-400 mx-auto" size={36} />
        <p className="text-white font-bold">{error}</p>
        <Link href="/portfolio" className="inline-block px-6 py-3 border border-zinc-700 text-zinc-400 font-bold text-xs uppercase tracking-widest rounded-xl hover:text-white transition-all">
          Back to Portfolio
        </Link>
      </div>
      <Footer />
    </div>
  );

  const { distributions = [], projects = [], summary = {} } = data ?? {};

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar />
      <main className="max-w-5xl mx-auto px-6 py-12 space-y-10">

        {/* Header */}
        <div className="border-l-2 border-teal-500 pl-5">
          <p className="text-[9px] text-teal-500 font-mono font-black tracking-widest uppercase mb-1">Yield Engine</p>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Rental Income</h1>
          <p className="text-zinc-500 text-xs mt-1">Your automatic share of rent from operational projects</p>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              label: 'Total Received',
              value: `₦${safeF(summary.total_received_ngn ?? 0)}`,
              sub: `≈ $${safeD(summary.total_received_usd ?? 0, 2)} USD`,
              color: 'text-teal-400',
              icon: DollarSign,
            },
            {
              label: 'Distributions',
              value: summary.distribution_count ?? 0,
              sub: 'rental payments',
              color: 'text-white',
              icon: TrendingUp,
            },
            {
              label: 'Properties',
              value: projects.length,
              sub: 'operational nodes',
              color: 'text-amber-400',
              icon: Building2,
            },
          ].map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 space-y-2">
                <Icon size={14} className="text-zinc-600" />
                <p className={`text-2xl font-black font-mono tabular-nums ${s.color}`}>{s.value}</p>
                <p className="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">{s.label}</p>
                <p className="text-[9px] text-zinc-700">{s.sub}</p>
              </div>
            );
          })}
        </div>

        {/* How it works */}
        <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/10">
          <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest mb-3">How rental yield works</p>
          <div className="grid grid-cols-3 gap-4">
            {[
              { step: '01', title: 'Tenant pays rent', body: 'Tenant uses a Paystack link to pay monthly rent into the Ark.' },
              { step: '02', title: 'Ark splits instantly', body: 'The yield engine calculates your pro-rata share the moment the payment clears.' },
              { step: '03', title: 'Ledger entry created', body: 'Every distribution is SHA-256 hashed and recorded on the immutable ledger.' },
            ].map(s => (
              <div key={s.step} className="space-y-2">
                <p className="text-teal-500 font-mono font-black text-[9px] uppercase tracking-widest">{s.step}</p>
                <p className="text-white text-xs font-bold">{s.title}</p>
                <p className="text-zinc-500 text-[10px] leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Projects generating yield */}
        {projects.length > 0 && (
          <div className="space-y-3">
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Operational projects</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects.map((p: any) => (
                <div key={p.id} className="p-5 rounded-2xl border border-teal-500/20 bg-teal-500/5 flex items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] text-teal-500 font-mono font-black">{p.project_number}</span>
                      <span className="text-[8px] border border-teal-500/30 text-teal-400 px-1.5 py-0.5 rounded font-bold uppercase">OPERATIONAL</span>
                    </div>
                    <p className="font-bold text-sm truncate">{p.title}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-mono font-bold text-xl text-teal-400">
                      ₦{safeF(p.total_received_ngn ?? 0)}
                    </p>
                    <p className="text-[8px] text-zinc-600 uppercase font-bold">received</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Distribution history */}
        <div className="space-y-4">
          <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">Distribution history</p>

          {distributions.length === 0 ? (
            <div className="py-20 text-center border border-dashed border-zinc-800 rounded-2xl space-y-5">
              <DollarSign className="text-zinc-700 mx-auto" size={40} />
              <div>
                <p className="text-zinc-400 font-bold">No rental income yet</p>
                <p className="text-zinc-600 text-sm mt-1">
                  You'll receive automatic distributions when tenants pay rent on projects you've invested in.
                </p>
              </div>
              <Link href="/projects"
                className="inline-flex items-center gap-2 px-6 py-3 bg-teal-500 text-black font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-white transition-all">
                Browse Investment Projects <ArrowRight size={11} />
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {distributions.map((d: Distribution) => (
                <div key={d.id}
                  className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 flex items-center justify-between gap-4 flex-wrap">
                  <div className="space-y-1 flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{d.project_title}</p>
                    <div className="flex items-center gap-3 text-[9px] text-zinc-500 flex-wrap">
                      <span className="font-mono">{d.project_number}</span>
                      {d.unit_name && (
                        <span className="flex items-center gap-1">
                          <Building2 size={9} /> {d.unit_name}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar size={9} /> {d.period_month}
                      </span>
                      {d.paid_at && (
                        <span>{new Date(d.paid_at).toLocaleDateString()}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[9px] text-zinc-600 flex-wrap">
                      {d.investment_stake && (
                        <span>Your stake: {safeD(d.investment_stake, 2)}%</span>
                      )}
                      <span>Rent total: ₦{safeF(d.rent_total)}</span>
                      <span className="flex items-center gap-1">
                        <ShieldCheck size={9} className="text-teal-500/50" /> Ledger verified
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-mono font-bold text-xl text-teal-400">
                      ₦{safeF(d.amount_ngn)}
                    </p>
                    <p className="text-[8px] text-zinc-600 uppercase font-bold">your share</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>
      <Footer />
    </div>
  );
}
