'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// ─── Types ───────────────────────────────────────────────────────────────────
interface StandaloneVault {
  id: string;
  vault_balance: number;
  target_amount: number;
  installment_amount: number;
  funded_pct: number;
  frequency: string;
  status: string;
  currency: string;
  funded_periods: number;
  total_contributed: number;
  contribution_count: number;
  landlord_name: string | null;
  landlord_email: string | null;
  landlord_bank_name: string | null;
  landlord_account_name: string | null;
  linked_tenancy_id: string | null;
  created_at: string;
}

interface LinkedVault {
  id: string;
  vault_balance: number;
  target_amount: number;
  installment_amount: number;
  funded_pct: number;
  frequency: string;
  status: string;
  total_contributed: number;
}

interface VaultApiResponse {
  success: boolean;
  hasActiveTenancy: boolean;
  vault: LinkedVault | null;
  standalone_vault: StandaloneVault | null;
  profile?: { user_id: string; email: string; full_name: string };
  message?: string;
}

// ─── Init Form State ──────────────────────────────────────────────────────────
interface InitForm {
  target_amount: string;
  installment_amount: string;
  frequency: string;
  landlord_name: string;
  landlord_email: string;
  landlord_bank_name: string;
  landlord_account_number: string;
  landlord_account_name: string;
}

const API_BASE = '/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token') || sessionStorage.getItem('token');
}

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 }).format(n);

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressRing({ pct }: { pct: number }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width="130" height="130" viewBox="0 0 130 130" className="progress-ring">
      <circle cx="65" cy="65" r={r} fill="none" stroke="#1a2a2a" strokeWidth="10" />
      <circle
        cx="65" cy="65" r={r} fill="none"
        stroke={pct >= 100 ? '#10b981' : '#14b8a6'}
        strokeWidth="10"
        strokeDasharray={`${dash} ${circ}`}
        strokeDashoffset={circ / 4}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />
      <text x="65" y="60" textAnchor="middle" fill="white" fontSize="20" fontWeight="700" fontFamily="monospace">
        {pct}%
      </text>
      <text x="65" y="78" textAnchor="middle" fill="#14b8a6" fontSize="10" fontFamily="monospace">
        FUNDED
      </text>
    </svg>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      background: 'rgba(20,184,166,0.06)',
      border: '1px solid rgba(20,184,166,0.15)',
      borderRadius: 10,
      padding: '16px 18px',
    }}>
      <div style={{ color: '#6b7280', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ color: 'white', fontSize: 18, fontWeight: 700, fontFamily: 'monospace' }}>{value}</div>
      {sub && <div style={{ color: '#6b7280', fontSize: 11, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ─── Init Form ────────────────────────────────────────────────────────────────
function InitVaultForm({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState<InitForm>({
    target_amount: '',
    installment_amount: '',
    frequency: 'MONTHLY',
    landlord_name: '',
    landlord_email: '',
    landlord_bank_name: '',
    landlord_account_number: '',
    landlord_account_name: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showLandlord, setShowLandlord] = useState(false);

  const set = (k: keyof InitForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    setError('');
    if (!form.target_amount || Number(form.target_amount) < 100) {
      return setError('Target amount must be at least ₦100');
    }
    if (!form.installment_amount || Number(form.installment_amount) < 50) {
      return setError('Installment amount must be at least ₦50');
    }
    setLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/tenant/standalone-vault/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          target_amount:           Number(form.target_amount),
          installment_amount:      Number(form.installment_amount),
          frequency:               form.frequency,
          landlord_name:           form.landlord_name || undefined,
          landlord_email:          form.landlord_email || undefined,
          landlord_bank_name:      form.landlord_bank_name || undefined,
          landlord_account_number: form.landlord_account_number || undefined,
          landlord_account_name:   form.landlord_account_name || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to initialize vault');
      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#0d1f1f', border: '1px solid rgba(20,184,166,0.2)',
    borderRadius: 8, padding: '11px 14px', color: 'white', fontSize: 14,
    outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', color: '#9ca3af', fontSize: 11,
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6,
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0d1f1f 0%, #0a1a1a 100%)',
      border: '1px solid rgba(20,184,166,0.25)',
      borderRadius: 16, padding: 32,
    }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'rgba(20,184,166,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20,
          }}>🔒</div>
          <div>
            <h2 style={{ margin: 0, color: 'white', fontSize: 18, fontWeight: 700 }}>Initialize Your Savings Vault</h2>
            <p style={{ margin: 0, color: '#6b7280', fontSize: 12, marginTop: 2 }}>
              Start saving toward rent independently — no landlord required to begin
            </p>
          </div>
        </div>
        <div style={{
          background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.15)',
          borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#14b8a6', lineHeight: 1.5,
        }}>
          💡 Your savings are held in Paystack escrow. When your landlord onboards, funds auto-release to them. You can also add their bank details now to pre-configure the payout.
        </div>
      </div>

      {/* Core Fields */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div>
          <label style={labelStyle}>Target Amount (₦) *</label>
          <input style={inputStyle} type="number" placeholder="e.g. 150000" value={form.target_amount} onChange={set('target_amount')} />
        </div>
        <div>
          <label style={labelStyle}>Installment Amount (₦) *</label>
          <input style={inputStyle} type="number" placeholder="e.g. 25000" value={form.installment_amount} onChange={set('installment_amount')} />
        </div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Payment Frequency</label>
        <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.frequency} onChange={set('frequency')}>
          <option value="DAILY">Daily</option>
          <option value="WEEKLY">Weekly</option>
          <option value="BIWEEKLY">Bi-Weekly</option>
          <option value="MONTHLY">Monthly</option>
          <option value="QUARTERLY">Quarterly</option>
        </select>
      </div>

      {/* Landlord Section — Optional */}
      <div style={{ marginBottom: 20 }}>
        <button
          onClick={() => setShowLandlord(!showLandlord)}
          style={{
            background: 'none', border: '1px dashed rgba(20,184,166,0.3)',
            borderRadius: 8, padding: '10px 16px', color: '#14b8a6',
            fontSize: 13, cursor: 'pointer', width: '100%', textAlign: 'left',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}
        >
          <span>🏠 Add Landlord Payout Details <span style={{ color: '#6b7280' }}>(optional — configures auto-release)</span></span>
          <span style={{ fontSize: 16 }}>{showLandlord ? '▲' : '▼'}</span>
        </button>

        {showLandlord && (
          <div style={{
            marginTop: 12, padding: '20px', background: 'rgba(0,0,0,0.3)',
            borderRadius: 10, border: '1px solid rgba(20,184,166,0.1)',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Landlord Name</label>
                <input style={inputStyle} placeholder="Full name" value={form.landlord_name} onChange={set('landlord_name')} />
              </div>
              <div>
                <label style={labelStyle}>Landlord Email</label>
                <input style={inputStyle} type="email" placeholder="landlord@email.com" value={form.landlord_email} onChange={set('landlord_email')} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              <div>
                <label style={labelStyle}>Bank Name</label>
                <input style={inputStyle} placeholder="GTBank" value={form.landlord_bank_name} onChange={set('landlord_bank_name')} />
              </div>
              <div>
                <label style={labelStyle}>Account Number</label>
                <input style={inputStyle} placeholder="0123456789" value={form.landlord_account_number} onChange={set('landlord_account_number')} />
              </div>
              <div>
                <label style={labelStyle}>Account Name</label>
                <input style={inputStyle} placeholder="As on bank" value={form.landlord_account_name} onChange={set('landlord_account_name')} />
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 8, padding: '10px 14px', color: '#ef4444', fontSize: 13, marginBottom: 16,
        }}>{error}</div>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading}
        style={{
          width: '100%', padding: '14px', borderRadius: 10,
          background: loading ? '#0d2d2d' : 'linear-gradient(135deg, #14b8a6, #0d9488)',
          border: 'none', color: 'white', fontWeight: 700, fontSize: 15,
          cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: 0.5,
          transition: 'all 0.2s',
        }}
      >
        {loading ? '⏳ Initializing Vault...' : '🚀 Initialize My Savings Vault'}
      </button>
    </div>
  );
}

// ─── Active Vault Display (Standalone) ───────────────────────────────────────
function StandaloneVaultDisplay({ vault, onPay }: { vault: StandaloneVault; onPay: () => void }) {
  const statusColor = vault.status === 'FUNDED_READY' ? '#10b981' : vault.status === 'ACTIVE' ? '#14b8a6' : '#f59e0b';

  return (
    <div>
      {/* Status Banner */}
      {vault.status === 'FUNDED_READY' && (
        <div style={{
          background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
          borderRadius: 10, padding: '12px 18px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 20 }}>🎯</span>
          <div>
            <div style={{ color: '#10b981', fontWeight: 700, fontSize: 14 }}>Vault Fully Funded!</div>
            <div style={{ color: '#6b7280', fontSize: 12 }}>Awaiting landlord onboarding for escrow release. Share your vault ID with your landlord.</div>
          </div>
        </div>
      )}

      {/* Main Vault Card */}
      <div style={{
        background: 'linear-gradient(135deg, #0d1f1f 0%, #0a1a1a 100%)',
        border: `1px solid ${statusColor}30`,
        borderRadius: 16, padding: 28, marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ color: '#6b7280', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
              Independent Flex-Pay Vault
            </div>
            <div style={{ color: 'white', fontSize: 22, fontWeight: 700, fontFamily: 'monospace' }}>
              {fmt(vault.vault_balance)}
            </div>
            <div style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>
              of {fmt(vault.target_amount)} target · {vault.frequency.toLowerCase()}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <ProgressRing pct={vault.funded_pct} />
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          <StatCard label="Total Saved" value={fmt(vault.total_contributed)} sub={`${vault.contribution_count} payments`} />
          <StatCard label="Installment" value={fmt(vault.installment_amount)} sub={vault.frequency.toLowerCase()} />
          <StatCard label="Status" value={vault.status.replace('_', ' ')} sub={vault.funded_periods > 0 ? `${vault.funded_periods} period(s) funded` : 'Saving in progress'} />
        </div>

        {/* Landlord Payout Config */}
        {vault.landlord_name || vault.landlord_email ? (
          <div style={{
            background: 'rgba(20,184,166,0.06)', border: '1px solid rgba(20,184,166,0.15)',
            borderRadius: 10, padding: '14px 18px', marginBottom: 20,
          }}>
            <div style={{ color: '#6b7280', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
              Landlord Payout Destination
            </div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {vault.landlord_name && <span style={{ color: 'white', fontSize: 13 }}>👤 {vault.landlord_name}</span>}
              {vault.landlord_email && <span style={{ color: '#14b8a6', fontSize: 13 }}>✉️ {vault.landlord_email}</span>}
              {vault.landlord_bank_name && <span style={{ color: '#9ca3af', fontSize: 13 }}>🏦 {vault.landlord_bank_name}</span>}
              {vault.landlord_account_name && <span style={{ color: '#9ca3af', fontSize: 13 }}>{vault.landlord_account_name}</span>}
            </div>
            <div style={{ color: '#6b7280', fontSize: 11, marginTop: 8 }}>
              ✅ Payout auto-configured — funds release to this account when vault is claimed by landlord
            </div>
          </div>
        ) : (
          <div style={{
            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
            borderRadius: 10, padding: '12px 16px', marginBottom: 20,
          }}>
            <div style={{ color: '#f59e0b', fontSize: 12 }}>
              ⚠️ No landlord payout details added. Your savings are secure in escrow. Add your landlord's bank details to pre-configure the release, or share your vault ID <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4 }}>{vault.id.slice(0, 8)}...</code> with your landlord so they can claim it when they onboard.
            </div>
          </div>
        )}

        {/* Vault ID */}
        <div style={{ color: '#374151', fontSize: 11, fontFamily: 'monospace' }}>
          VAULT · {vault.id} · {new Date(vault.created_at).toLocaleDateString('en-NG')}
        </div>
      </div>

      {/* CTA */}
      {vault.status !== 'FUNDED_READY' && (
        <button
          onClick={onPay}
          style={{
            width: '100%', padding: '14px', borderRadius: 10,
            background: 'linear-gradient(135deg, #14b8a6, #0d9488)',
            border: 'none', color: 'white', fontWeight: 700, fontSize: 15,
            cursor: 'pointer', letterSpacing: 0.5,
          }}
        >
          ⚡ Make a Contribution — {fmt(vault.installment_amount)}
        </button>
      )}
    </div>
  );
}

// ─── Linked Vault Display (standard tenancy) ──────────────────────────────────
function LinkedVaultDisplay({ vault }: { vault: LinkedVault }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #0d1f1f 0%, #0a1a1a 100%)',
      border: '1px solid rgba(20,184,166,0.25)', borderRadius: 16, padding: 28,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ color: '#6b7280', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
            Flex-Pay Vault
          </div>
          <div style={{ color: 'white', fontSize: 24, fontWeight: 700, fontFamily: 'monospace' }}>
            {fmt(vault.vault_balance)}
          </div>
          <div style={{ color: '#6b7280', fontSize: 13, marginTop: 4 }}>
            of {fmt(vault.target_amount)} target
          </div>
        </div>
        <ProgressRing pct={vault.funded_pct} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <StatCard label="Contributed" value={fmt(vault.total_contributed)} />
        <StatCard label="Installment" value={fmt(vault.installment_amount)} sub={vault.frequency.toLowerCase()} />
        <StatCard label="Status" value={vault.status} />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TenantVaultPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<VaultApiResponse | null>(null);
  const [error, setError] = useState('');

  const fetchVault = async () => {
    setLoading(true);
    try {
      const token = getToken();
      if (!token) { router.push('/login'); return; }
      const res = await fetch(`${API_BASE}/tenant/my-vault`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchVault(); }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: '#14b8a6', fontSize: 14 }}>
      <span style={{ fontFamily: 'monospace' }}>⟳ Loading vault...</span>
    </div>
  );

  if (error) return (
    <div style={{ padding: 24, color: '#ef4444', fontSize: 14 }}>Error: {error}</div>
  );

  const shell: React.CSSProperties = {
    maxWidth: 720, margin: '0 auto', padding: '24px 20px',
  };
  const pageHeader = (
    <div style={{ marginBottom: 28 }}>
      <div style={{ color: '#6b7280', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>
        Tenant Portal
      </div>
      <h1 style={{ margin: 0, color: 'white', fontSize: 24, fontWeight: 700 }}>My Flex-Pay Vault</h1>
      <p style={{ margin: '6px 0 0', color: '#6b7280', fontSize: 13 }}>
        Your micro-contribution rent engine
      </p>
    </div>
  );

  // ── Case 1: Linked tenancy with vault ────────────────────────────────────
  if (data?.hasActiveTenancy && data.vault) {
    return (
      <div style={shell}>
        {pageHeader}
        <LinkedVaultDisplay vault={data.vault} />
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <a href="/tenant/contributions" style={{ color: '#14b8a6', fontSize: 13, textDecoration: 'none' }}>
            View All Contributions →
          </a>
        </div>
      </div>
    );
  }

  // ── Case 2: Linked tenancy but no vault yet (landlord hasn't set one up) ─
  if (data?.hasActiveTenancy && !data.vault) {
    return (
      <div style={shell}>
        {pageHeader}
        <div style={{
          background: 'linear-gradient(135deg, #0d1f1f, #0a1a1a)',
          border: '1px solid rgba(20,184,166,0.2)', borderRadius: 16, padding: 32, textAlign: 'center',
        }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔄</div>
          <div style={{ color: 'white', fontWeight: 600, fontSize: 16, marginBottom: 8 }}>Property Linked — Vault Pending</div>
          <div style={{ color: '#6b7280', fontSize: 13 }}>
            Your landlord is setting up your Flex-Pay vault. You will be notified as soon as it is activated.
          </div>
        </div>
      </div>
    );
  }

  // ── Case 3: No tenancy but HAS a standalone vault ─────────────────────────
  if (!data?.hasActiveTenancy && data?.standalone_vault) {
    return (
      <div style={shell}>
        {pageHeader}
        <StandaloneVaultDisplay
          vault={data.standalone_vault}
          onPay={() => router.push('/tenant/pay')}
        />
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <a href="/tenant/contributions" style={{ color: '#14b8a6', fontSize: 13, textDecoration: 'none' }}>
            View All Contributions →
          </a>
        </div>
      </div>
    );
  }

  // ── Case 4: No tenancy, no standalone vault — show Init form ─────────────
  return (
    <div style={shell}>
      {pageHeader}

      {/* Feature highlights */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24,
      }}>
        {[
          { icon: '🔒', label: 'Escrow-held' },
          { icon: '📅', label: 'Your rhythm' },
          { icon: '⚡', label: 'Auto-disburse' },
          { icon: '🧾', label: 'SHA-256 receipts' },
        ].map(({ icon, label }) => (
          <div key={label} style={{
            background: 'rgba(20,184,166,0.06)', border: '1px solid rgba(20,184,166,0.12)',
            borderRadius: 10, padding: '12px 8px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
            <div style={{ color: '#9ca3af', fontSize: 11 }}>{label}</div>
          </div>
        ))}
      </div>

      <InitVaultForm onSuccess={fetchVault} />
    </div>
  );
}
