'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
// Import required design ecosystem blocks
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import MobileBottomNav from '@/components/navigation/MobileBottomNav';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return (
    localStorage.getItem('ark_token') ||
    localStorage.getItem('token') ||
    sessionStorage.getItem('ark_token') ||
    sessionStorage.getItem('token')
  );
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 }).format(n);

interface Contribution {
  id: string;
  amount: number;
  currency: string;
  period_label: string;
  paid_at: string | null;
  status: string;
  ledger_hash: string | null;
  receipt_id: string;
  source?: string;
}

interface Summary {
  total_paid: number;
  count: number;
  source: 'linked' | 'standalone' | 'none';
}

const STATUS_COLOR: Record<string, string> = {
  SUCCESS: '#10b981',
  PENDING: '#f59e0b',
  FAILED:  '#ef4444',
};

function HashBadge({ hash }: { hash: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!hash) return <span style={{ color: '#374151', fontSize: 11 }}>—</span>;
  const short = hash.slice(0, 12) + '…';
  const copy = () => {
    navigator.clipboard.writeText(hash).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <span
      onClick={copy}
      title={hash}
      style={{
        fontFamily: 'monospace', fontSize: 11, color: copied ? '#10b981' : '#14b8a6',
        cursor: 'pointer', background: 'rgba(20,184,166,0.08)',
        padding: '2px 7px', borderRadius: 4,
      }}
    >
      {copied ? 'Copied!' : short}
    </span>
  );
}

export default function TenantContributionsPage() {
  const router = useRouter();
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [summary, setSummary]             = useState<Summary>({ total_paid: 0, count: 0, source: 'none' });
  const [loading, setLoading]             = useState(true);
  const [filter, setFilter]               = useState<'ALL' | 'SUCCESS' | 'PENDING' | 'FAILED'>('ALL');

  useEffect(() => {
    (async () => {
      const token = getToken();
      if (!token) { router.push('/login'); return; }
      try {
        const res  = await fetch(`${API_BASE}/tenant/my-contributions`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include'
        });
        const data = await res.json();
        const list: Contribution[] = (data.contributions || []).map((c: any) => ({
          id:          c.id,
          amount:      parseFloat(c.amount) || 0,
          currency:    c.currency || 'NGN',
          period_label: c.period_label || '—',
          paid_at:     c.paid_at || null,
          status:      c.status || 'UNKNOWN',
          ledger_hash: c.ledger_hash || null,
          receipt_id:  c.receipt_id || c.id,
          source:      c.source || 'linked',
        }));
        setContributions(list);
        const successOnly = list.filter(c => c.status === 'SUCCESS');
        setSummary({
          total_paid: successOnly.reduce((s, c) => s + c.amount, 0),
          count:      successOnly.length,
          source:     data.source || (list.length > 0 ? 'linked' : 'none'),
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const visible = filter === 'ALL' ? contributions : contributions.filter(c => c.status === filter);

  const card: React.CSSProperties = {
    background: 'linear-gradient(135deg, #0d1f1f 0%, #0a1a1a 100%)',
    border: '1px solid rgba(20,184,166,0.2)',
    borderRadius: 14,
  };

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#050505' }}>
      <Navbar />
      <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#14b8a6', fontFamily: 'monospace', fontSize: 14 }}>⟳ Loading contributions...</span>
      </div>
      <Footer />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#050505' }}>
      {/* 1. Global Navigation Header */}
      <Navbar />

      {/* 2. Preserved Original Interface Body */}
      <main style={{ flexGrow: 1, maxWidth: 800, width: '100%', margin: '0 auto', padding: '40px 20px 96px' }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ color: '#6b7280', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>
            Tenant Portal
          </div>
          <h1 style={{ margin: 0, color: 'white', fontSize: 24, fontWeight: 700 }}>My Contributions</h1>
          <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: 13 }}>
            {summary.source === 'standalone'
              ? 'Independent savings vault · SHA-256 ledger'
              : 'Flex-Pay vault history · SHA-256 ledger'}
          </p>
        </div>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Total Saved', value: fmt(summary.total_paid), sub: `${summary.count} successful payment${summary.count !== 1 ? 's' : ''}` },
            { label: 'Vault Type',  value: summary.source === 'standalone' ? 'Independent' : summary.source === 'linked' ? 'Linked' : '—', sub: summary.source === 'standalone' ? 'Self-initiated vault' : summary.source === 'linked' ? 'Landlord-linked vault' : 'No vault yet' },
            { label: 'Ledger',      value: 'SHA-256', sub: 'Bulletproof hash chain' },
          ].map(({ label, value, sub }) => (
            <div key={label} style={{ ...card, padding: '16px 18px' }}>
              <div style={{ color: '#6b7280', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
              <div style={{ color: 'white', fontSize: 17, fontWeight: 700, fontFamily: 'monospace' }}>{value}</div>
              {sub && <div style={{ color: '#4b5563', fontSize: 11, marginTop: 4 }}>{sub}</div>}
            </div>
          ))}
        </div>

        {/* Filter Bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          {(['ALL', 'SUCCESS', 'PENDING', 'FAILED'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 16px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                background: filter === f ? 'rgba(20,184,166,0.2)' : 'rgba(20,184,166,0.05)',
                border: `1px solid ${filter === f ? '#14b8a6' : 'rgba(20,184,166,0.15)'}`,
                color: filter === f ? '#14b8a6' : '#6b7280',
                fontWeight: filter === f ? 700 : 400,
              }}
            >
              {f === 'ALL' ? `All (${contributions.length})` : `${f} (${contributions.filter(c => c.status === f).length})`}
            </button>
          ))}
        </div>

        {/* Empty State */}
        {visible.length === 0 && (
          <div style={{ ...card, padding: 40, textAlign: 'center' }}>
            {contributions.length === 0 ? (
              <>
                <div style={{ fontSize: 40, marginBottom: 16 }}>💳</div>
                <div style={{ color: 'white', fontWeight: 600, marginBottom: 8 }}>No contributions yet</div>
                <div style={{ color: '#6b7280', fontSize: 13, marginBottom: 24 }}>
                  Make your first installment to start building your rent history.
                </div>
                <button
                  onClick={() => router.push('/tenant/pay')}
                  style={{
                    padding: '10px 24px', borderRadius: 8,
                    background: 'linear-gradient(135deg, #14b8a6, #0d9488)',
                    border: 'none', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  }}
                >
                  Make First Contribution
                </button>
              </>
            ) : (
              <div style={{ color: '#6b7280', fontSize: 13 }}>No {filter} contributions found.</div>
            )}
          </div>
        )}

        {/* Contributions Table */}
        {visible.length > 0 && (
          <div style={{ ...card, overflow: 'hidden' }}>
            {/* Table Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 120px 90px 130px 130px',
              padding: '12px 20px',
              borderBottom: '1px solid rgba(20,184,166,0.1)',
              background: 'rgba(20,184,166,0.04)',
            }}>
              {['Date', 'Amount', 'Status', 'Period', 'Ledger Hash'].map(h => (
                <div key={h} style={{ color: '#6b7280', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>{h}</div>
              ))}
            </div>

            {/* Rows */}
            {visible.map((c, i) => (
              <div
                key={c.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 120px 90px 130px 130px',
                  padding: '14px 20px',
                  borderBottom: i < visible.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  alignItems: 'center',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(20,184,166,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Date */}
                <div>
                  <div style={{ color: 'white', fontSize: 13 }}>
                    {c.paid_at ? new Date(c.paid_at).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </div>
                  <div style={{ color: '#4b5563', fontSize: 11, marginTop: 2, fontFamily: 'monospace' }}>
                    {c.paid_at ? new Date(c.paid_at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' }) : ''}
                  </div>
                </div>
                {/* Amount */}
                <div style={{ color: 'white', fontWeight: 700, fontFamily: 'monospace', fontSize: 13 }}>
                  {fmt(c.amount)}
                </div>
                {/* Status */}
                <div>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                    background: `${STATUS_COLOR[c.status] || '#6b7280'}18`,
                    color: STATUS_COLOR[c.status] || '#6b7280',
                    border: `1px solid ${STATUS_COLOR[c.status] || '#6b7280'}40`,
                  }}>
                    {c.status}
                  </span>
                </div>
                {/* Period */}
                <div style={{ color: '#9ca3af', fontSize: 12, fontFamily: 'monospace' }}>
                  {c.period_label}
                </div>
                {/* Ledger Hash */}
                <div>
                  <HashBadge hash={c.ledger_hash} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer Navigation Link Interactivity */}
        <div style={{ marginTop: 32, display: 'flex', gap: 24, justifyContent: 'center' }}>
          <button 
            onClick={() => router.push('/tenant/vault')}
            style={{ background: 'none', border: 'none', color: '#14b8a6', fontSize: 13, cursor: 'pointer', fontFamily: 'monospace' }}
          >
            ← Back to Vault
          </button>
          <button 
            onClick={() => router.push('/tenant/pay')}
            style={{ background: 'none', border: 'none', color: '#14b8a6', fontSize: 13, cursor: 'pointer', fontFamily: 'monospace' }}
          >
            Add Pay Installment →
          </button>
        </div>
      </main>

      {/* 3. Corporate Footer & Mobile Sticky Bar Responsiveness */}
      <Footer />
      <MobileBottomNav />
    </div>
  );
}