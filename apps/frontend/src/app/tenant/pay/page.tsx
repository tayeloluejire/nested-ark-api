'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
// ─── Imports added for layout framework ─────────────────────────────────────
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import MobileBottomNav from '@/components/navigation/MobileBottomNav';

const API_BASE = '/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token') || sessionStorage.getItem('token');
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 }).format(n);

// ─── Types ────────────────────────────────────────────────────────────────────
type FlowState =
  | 'loading'
  | 'linked_vault'          // has tenancy + vault → normal pay flow
  | 'standalone_vault'      // has standalone vault → route to standalone pay
  | 'no_vault'              // no tenancy, no standalone vault → redirect to init
  | 'error';

interface VaultInfo {
  id: string;
  installment_amount: number;
  vault_balance: number;
  target_amount: number;
  funded_pct: number;
  frequency: string;
  status: string;
  isStandalone?: boolean;
}

export default function PayInstallmentPage() {
  const router = useRouter();
  const [flow, setFlow]         = useState<FlowState>('loading');
  const [vault, setVault]       = useState<VaultInfo | null>(null);
  const [amount, setAmount]     = useState('');
  const [paying, setPaying]     = useState(false);
  const [error, setError]       = useState('');
  const [statusMsg, setStatus]  = useState('');

  // ── Resolve vault state on mount ─────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const token = getToken();
      if (!token) { router.push('/login'); return; }

      try {
        // 1. Check linked vault first (my-vault returns standalone_vault too)
        const mvRes  = await fetch(`${API_BASE}/tenant/my-vault`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const mvData = await mvRes.json();

        if (mvData.hasActiveTenancy && mvData.vault) {
          // Linked tenancy + vault: standard flow
          setVault({ ...mvData.vault, isStandalone: false });
          setAmount(String(mvData.vault.installment_amount || ''));
          setFlow('linked_vault');
          return;
        }

        if (!mvData.hasActiveTenancy && mvData.standalone_vault) {
          // Independent tenant with initialized standalone vault
          setVault({ ...mvData.standalone_vault, isStandalone: true });
          setAmount(String(mvData.standalone_vault.installment_amount || ''));
          setFlow('standalone_vault');
          return;
        }

        // No vault at all → redirect to vault init
        setFlow('no_vault');
      } catch (e: any) {
        setError(e.message);
        setFlow('error');
      }
    })();
  }, []);

  // ── Initiate payment ──────────────────────────────────────────────────────
  const handlePay = async () => {
    if (!vault) return;
    const amt = Number(amount);
    if (!amt || amt < 50) return setError('Minimum contribution is ₦50');
    setPaying(true);
    setError('');
    setStatus('');
    try {
      const token = getToken();
      const endpoint = vault.isStandalone
        ? `${API_BASE}/tenant/standalone-vault/pay`
        : `${API_BASE}/tenant/pay-installment`;

      const res  = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ amount: amt }),
      });
      const data = await res.json();

      if (!data.success) throw new Error(data.error || 'Payment initialization failed');

      setStatus(`Redirecting to Paystack...`);
      window.location.href = data.authorization_url;
    } catch (e: any) {
      setError(e.message);
      setPaying(false);
    }
  };

  // ─── Shared styles ─────────────────────────────────────────────────────────
  const shell: React.CSSProperties = {
    maxWidth: 560, margin: '0 auto', padding: '24px 20px',
  };
  const card: React.CSSProperties = {
    background: 'linear-gradient(135deg, #0d1f1f 0%, #0a1a1a 100%)',
    border: '1px solid rgba(20,184,166,0.25)',
    borderRadius: 16, padding: 28,
  };

  const pageHeader = (
    <div style={{ marginBottom: 28 }}>
      <div style={{ color: '#6b7280', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>
        Tenant Portal
      </div>
      <h1 style={{ margin: 0, color: 'white', fontSize: 24, fontWeight: 700 }}>Pay Installment</h1>
      <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: 13 }}>
        Contribute to your Flex-Pay vault via Paystack
      </p>
    </div>
  );

  // ── Loading ───────────────────────────────────────────────────────────────
  if (flow === 'loading') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#050505' }}>
        <Navbar />
        <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#14b8a6', fontFamily: 'monospace', fontSize: 14 }}>⟳ Loading vault...</span>
        </div>
        <Footer />
        <MobileBottomNav />
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (flow === 'error') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#050505' }}>
        <Navbar />
        <div style={{ flexGrow: 1, ...shell }}>
          {pageHeader}
          <div style={{ ...card, borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 14 }}>
            ⚠️ {error || 'Something went wrong. Please refresh and try again.'}
          </div>
        </div>
        <Footer />
        <MobileBottomNav />
      </div>
    );
  }

  // ── No vault — redirect to init ───────────────────────────────────────────
  if (flow === 'no_vault') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#050505' }}>
        <Navbar />
        <div style={{ flexGrow: 1, ...shell }}>
          {pageHeader}
          <div style={{ ...card, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🏦</div>
            <h3 style={{ margin: '0 0 10px', color: 'white', fontWeight: 700 }}>No Active Vault Found</h3>
            <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              Initialize your personal savings vault to start contributing toward rent.
              No landlord required — you control your own savings timeline.
            </p>
            <button
              onClick={() => router.push('/tenant/vault')}
              style={{
                padding: '12px 28px', borderRadius: 10,
                background: 'linear-gradient(135deg, #14b8a6, #0d9488)',
                border: 'none', color: 'white', fontWeight: 700, fontSize: 14,
                cursor: 'pointer',
              }}
            >
              🚀 Initialize My Vault
            </button>
            <div style={{ marginTop: 16 }}>
              <a href="/tenant/dashboard" style={{ color: '#4b5563', fontSize: 12, textDecoration: 'none' }}>
                ← Back to Dashboard
              </a>
            </div>
          </div>
        </div>
        <Footer />
        <MobileBottomNav />
      </div>
    );
  }

  // ── Payment Form (linked_vault OR standalone_vault) ───────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#050505' }}>
      <Navbar />
      
      <div style={{ flexGrow: 1, ...shell }}>
        {pageHeader}

        {/* Vault Summary */}
        {vault && (
          <div style={{
            background: 'rgba(20,184,166,0.06)', border: '1px solid rgba(20,184,166,0.15)',
            borderRadius: 12, padding: '16px 20px', marginBottom: 20,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ color: '#6b7280', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
                {vault.isStandalone ? 'Independent Savings Vault' : 'Flex-Pay Vault'}
              </div>
              <div style={{ color: 'white', fontSize: 16, fontWeight: 700, fontFamily: 'monospace' }}>
                {fmt(vault.vault_balance)} / {fmt(vault.target_amount)}
              </div>
              <div style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>
                {vault.funded_pct}% funded · {vault.frequency.toLowerCase()}
              </div>
            </div>
            {/* Mini progress bar */}
            <div style={{ width: 80 }}>
              <div style={{ height: 6, background: '#1a2a2a', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${vault.funded_pct}%`,
                  background: vault.funded_pct >= 100 ? '#10b981' : '#14b8a6',
                  borderRadius: 3, transition: 'width 0.5s ease',
                }} />
              </div>
              <div style={{ color: '#6b7280', fontSize: 10, textAlign: 'center', marginTop: 4 }}>
                {vault.funded_pct}%
              </div>
            </div>
          </div>
        )}

        {/* Payment Card */}
        <div style={card}>
          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: 'block', color: '#9ca3af', fontSize: 11,
              letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8,
            }}>
              Contribution Amount (₦)
            </label>

            {/* Quick amount buttons */}
            {vault && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                {[vault.installment_amount, vault.installment_amount * 2, vault.installment_amount * 0.5]
                  .filter(v => v >= 50)
                  .map(v => (
                    <button
                      key={v}
                      onClick={() => setAmount(String(v))}
                      style={{
                        padding: '6px 14px', borderRadius: 6, fontSize: 12,
                        background: Number(amount) === v ? 'rgba(20,184,166,0.25)' : 'rgba(20,184,166,0.08)',
                        border: `1px solid ${Number(amount) === v ? '#14b8a6' : 'rgba(20,184,166,0.2)'}`,
                        color: Number(amount) === v ? '#14b8a6' : '#9ca3af',
                        cursor: 'pointer',
                      }}
                    >
                      {fmt(v)}
                    </button>
                  ))}
              </div>
            )}

            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="Enter amount"
              style={{
                width: '100%', background: '#0d1f1f',
                border: '1px solid rgba(20,184,166,0.2)', borderRadius: 8,
                padding: '12px 14px', color: 'white', fontSize: 18,
                outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Fee note */}
          <div style={{
            background: 'rgba(20,184,166,0.06)', borderRadius: 8,
            padding: '10px 14px', marginBottom: 20,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ color: '#9ca3af', fontSize: 12 }}>You pay exactly</div>
              <div style={{ color: 'white', fontWeight: 700, fontFamily: 'monospace', fontSize: 20 }}>
                {amount && !isNaN(Number(amount)) ? fmt(Number(amount)) : '₦0.00'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#14b8a6', fontSize: 11 }}>Platform covers Paystack fee</div>
              <div style={{ color: '#6b7280', fontSize: 11 }}>Funds held in escrow · 2% platform fee at release</div>
            </div>
          </div>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 8, padding: '10px 14px', color: '#ef4444',
              fontSize: 13, marginBottom: 16,
            }}>{error}</div>
          )}

          {statusMsg && (
            <div style={{
              background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.3)',
              borderRadius: 8, padding: '10px 14px', color: '#14b8a6',
              fontSize: 13, marginBottom: 16,
            }}>{statusMsg}</div>
          )}

          <button
            onClick={handlePay}
            disabled={paying || !amount || Number(amount) < 50}
            style={{
              width: '100%', padding: 14, borderRadius: 10,
              background: (paying || !amount || Number(amount) < 50)
                ? '#0d2d2d'
                : 'linear-gradient(135deg, #14b8a6, #0d9488)',
              border: 'none', color: 'white', fontWeight: 700, fontSize: 15,
              cursor: (paying || !amount || Number(amount) < 50) ? 'not-allowed' : 'pointer',
              letterSpacing: 0.5,
            }}
          >
            {paying ? '⏳ Preparing Paystack...' : `⚡ Pay ${amount && !isNaN(Number(amount)) ? fmt(Number(amount)) : ''} via Paystack`}
          </button>

          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <a href="/tenant/vault" style={{ color: '#4b5563', fontSize: 12, textDecoration: 'none' }}>
              ← Back to Vault
            </a>
          </div>
        </div>

        {/* SHA note */}
        <div style={{
          marginTop: 16, textAlign: 'center', color: '#374151', fontSize: 11, fontFamily: 'monospace',
        }}>
          🔐 SHA-256 receipt issued on payment confirmation
        </div>
      </div>

      <Footer />
      <MobileBottomNav />
    </div>
  );
}