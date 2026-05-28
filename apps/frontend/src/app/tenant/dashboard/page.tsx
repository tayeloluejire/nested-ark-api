'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE = '/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token') || sessionStorage.getItem('token');
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 }).format(n);

// ─── Types ────────────────────────────────────────────────────────────────────
interface OnboardingStep {
  key: string;
  label: string;
  status: 'done' | 'skipped' | 'pending';
}

interface StandaloneVaultSummary {
  id: string;
  vault_balance: number;
  target_amount: number;
  installment_amount: number;
  funded_pct: number;
  frequency: string;
  status: string;
  total_contributed: number;
  contribution_count: number;
  landlord_name: string | null;
  landlord_email: string | null;
}

interface LinkedVaultSummary {
  id: string;
  vault_balance: number;
  target_amount: number;
  installment_amount: number;
  funded_pct: number;
  frequency: string;
  status: string;
  total_contributed: number;
}

interface DashboardData {
  success: boolean;
  hasActiveTenancy: boolean;
  tenancy: any | null;
  vault: LinkedVaultSummary | null;
  standalone_vault: StandaloneVaultSummary | null;
  next_due_date: string | null;
  active_notice_count: number;
  recent_payments: any[];
  recent_maintenance: any[];
  profile: { user_id: string; email: string; full_name: string; phone: string; created_at: string };
  onboarding_steps: OnboardingStep[];
  message?: string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepIcon({ status }: { status: string }) {
  if (status === 'done')    return <span style={{ color: '#10b981', fontSize: 16 }}>✓</span>;
  if (status === 'skipped') return <span style={{ color: '#6b7280', fontSize: 16 }}>—</span>;
  return <span style={{ color: '#f59e0b', fontSize: 14 }}>○</span>;
}

function OnboardingProgress({ steps }: { steps: OnboardingStep[] }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #0d1f1f, #0a1a1a)',
      border: '1px solid rgba(20,184,166,0.2)',
      borderRadius: 14, padding: 24, marginBottom: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%', background: '#f59e0b',
          boxShadow: '0 0 8px #f59e0b88',
          animation: 'pulse 2s infinite',
        }} />
        <span style={{ color: '#9ca3af', fontSize: 12 }}>Background tasks running</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {steps.map((step, i) => (
          <div key={step.key} style={{ display: 'flex', gap: 16, paddingBottom: i < steps.length - 1 ? 18 : 0 }}>
            {/* Timeline */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24, flexShrink: 0 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: step.status === 'done' ? 'rgba(16,185,129,0.15)' : step.status === 'skipped' ? 'rgba(107,114,128,0.1)' : 'rgba(245,158,11,0.12)',
                border: `1px solid ${step.status === 'done' ? '#10b98130' : step.status === 'skipped' ? '#6b728030' : '#f59e0b30'}`,
                flexShrink: 0,
              }}>
                <StepIcon status={step.status} />
              </div>
              {i < steps.length - 1 && (
                <div style={{ width: 1, flex: 1, background: 'rgba(255,255,255,0.06)', marginTop: 4 }} />
              )}
            </div>
            {/* Content */}
            <div style={{ paddingTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={{ color: step.status === 'done' ? 'white' : '#9ca3af', fontSize: 14, fontWeight: 600 }}>
                  {step.label}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10,
                  background: step.status === 'done' ? 'rgba(16,185,129,0.15)' : step.status === 'skipped' ? 'rgba(107,114,128,0.12)' : 'rgba(245,158,11,0.12)',
                  color: step.status === 'done' ? '#10b981' : step.status === 'skipped' ? '#6b7280' : '#f59e0b',
                }}>
                  {step.status}
                </span>
              </div>
              <div style={{ color: '#6b7280', fontSize: 12 }}>
                {step.key === 'account_created'    && 'Your Nested Ark account is live and active.'}
                {step.key === 'payout_destination' && 'No bank details provided at registration. Add from your dashboard settings anytime.'}
                {step.key === 'escrow_vault_profile' && (step.status === 'done'
                  ? 'Your savings vault is active and accumulating contributions.'
                  : 'Activated automatically when you initialize your vault.')}
                {step.key === 'link_to_property'   && (step.status === 'done'
                  ? 'Linked to a property via tenancy.'
                  : 'Browse the marketplace or await a landlord invite link.')}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VaultCard({ vault, isStandalone, onPay }: { vault: StandaloneVaultSummary | LinkedVaultSummary; isStandalone: boolean; onPay: () => void }) {
  const r   = 40;
  const circ = 2 * Math.PI * r;
  const dash = (vault.funded_pct / 100) * circ;

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0d1f1f, #0a1a1a)',
      border: '1px solid rgba(20,184,166,0.2)', borderRadius: 14, padding: 22, marginBottom: 20,
    }}>
      <div style={{ color: '#6b7280', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 14 }}>
        {isStandalone ? 'Independent Flex-Pay Vault' : 'Flex-Pay Vault'}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div>
          <div style={{ color: 'white', fontSize: 26, fontWeight: 700, fontFamily: 'monospace' }}>
            {fmt(vault.vault_balance)}
          </div>
          <div style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>
            of {fmt(vault.target_amount)} target
          </div>
        </div>
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke="#1a2a2a" strokeWidth="8" />
          <circle cx="50" cy="50" r={r} fill="none"
            stroke={vault.funded_pct >= 100 ? '#10b981' : '#14b8a6'}
            strokeWidth="8"
            strokeDasharray={`${dash} ${circ}`}
            strokeDashoffset={circ / 4}
            strokeLinecap="round"
          />
          <text x="50" y="46" textAnchor="middle" fill="white" fontSize="16" fontWeight="700" fontFamily="monospace">{vault.funded_pct}%</text>
          <text x="50" y="61" textAnchor="middle" fill="#14b8a6" fontSize="9" fontFamily="monospace">FUNDED</text>
        </svg>
      </div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
        {[
          { label: 'Contributed', val: fmt(vault.total_contributed) },
          { label: 'Installment', val: fmt(vault.installment_amount) },
          { label: 'Frequency',   val: vault.frequency.toLowerCase() },
        ].map(({ label, val }) => (
          <div key={label} style={{
            background: 'rgba(20,184,166,0.06)', border: '1px solid rgba(20,184,166,0.12)',
            borderRadius: 8, padding: '10px 12px',
          }}>
            <div style={{ color: '#6b7280', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
            <div style={{ color: 'white', fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>{val}</div>
          </div>
        ))}
      </div>
      {isStandalone && (vault as StandaloneVaultSummary).landlord_name && (
        <div style={{
          background: 'rgba(20,184,166,0.05)', border: '1px solid rgba(20,184,166,0.12)',
          borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12,
        }}>
          <span style={{ color: '#6b7280' }}>Payout → </span>
          <span style={{ color: '#14b8a6' }}>{(vault as StandaloneVaultSummary).landlord_name}</span>
          {(vault as StandaloneVaultSummary).landlord_email && (
            <span style={{ color: '#6b7280' }}> · {(vault as StandaloneVaultSummary).landlord_email}</span>
          )}
        </div>
      )}
      <button
        onClick={onPay}
        style={{
          width: '100%', padding: '12px', borderRadius: 10,
          background: 'linear-gradient(135deg, #14b8a6, #0d9488)',
          border: 'none', color: 'white', fontWeight: 700, fontSize: 14,
          cursor: 'pointer',
        }}
      >
        ⚡ Pay {fmt(vault.installment_amount)}
      </button>
    </div>
  );
}

function RecentPayments({ payments }: { payments: any[] }) {
  if (!payments.length) return null;
  return (
    <div style={{
      background: 'linear-gradient(135deg, #0d1f1f, #0a1a1a)',
      border: '1px solid rgba(20,184,166,0.15)', borderRadius: 14, padding: 20, marginBottom: 20,
    }}>
      <div style={{ color: '#6b7280', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 14 }}>
        Recent Contributions
      </div>
      {payments.map((p: any, i: number) => (
        <div key={p.id} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          paddingBottom: i < payments.length - 1 ? 12 : 0,
          marginBottom: i < payments.length - 1 ? 12 : 0,
          borderBottom: i < payments.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
        }}>
          <div>
            <div style={{ color: 'white', fontSize: 13, fontFamily: 'monospace' }}>
              {fmt(parseFloat(p.amount_ngn) || 0)}
            </div>
            <div style={{ color: '#4b5563', fontSize: 11, marginTop: 2 }}>
              {p.period_label || p.period_month || '—'} · {p.paid_at ? new Date(p.paid_at).toLocaleDateString('en-NG') : '—'}
            </div>
          </div>
          <span style={{
            fontSize: 11, padding: '3px 9px', borderRadius: 12,
            background: p.status === 'SUCCESS' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.12)',
            color: p.status === 'SUCCESS' ? '#10b981' : '#f59e0b',
          }}>
            {p.status}
          </span>
        </div>
      ))}
      <div style={{ marginTop: 14, textAlign: 'center' }}>
        <a href="/tenant/contributions" style={{ color: '#14b8a6', fontSize: 12, textDecoration: 'none' }}>
          View all contributions →
        </a>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function TenantDashboardPage() {
  const router = useRouter();
  const [data, setData]     = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName]     = useState('');

  useEffect(() => {
    (async () => {
      const token = getToken();
      if (!token) { router.push('/login'); return; }
      try {
        const res  = await fetch(`${API_BASE}/tenant/dashboard`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        setData(json);
        setName(json.profile?.full_name?.split(' ')[0] || json.profile?.email?.split('@')[0] || 'Tenant');
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <span style={{ color: '#14b8a6', fontFamily: 'monospace', fontSize: 14 }}>⟳ Loading dashboard...</span>
    </div>
  );

  if (!data) return (
    <div style={{ padding: 24, color: '#ef4444' }}>Failed to load dashboard. Please refresh.</div>
  );

  const shell: React.CSSProperties = { maxWidth: 760, margin: '0 auto', padding: '24px 20px' };

  // ── Case A: Full tenancy ──────────────────────────────────────────────────
  if (data.hasActiveTenancy && data.tenancy) {
    const t = data.tenancy;
    return (
      <div style={shell}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ color: '#6b7280', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>Tenant Portal</div>
          <h1 style={{ margin: 0, color: 'white', fontSize: 24, fontWeight: 700 }}>My Dashboard</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 13 }}>Welcome, {name}! Your account is active and ready.</p>
        </div>

        {/* Tenancy Summary */}
        <div style={{
          background: 'linear-gradient(135deg, #0d1f1f, #0a1a1a)',
          border: '1px solid rgba(20,184,166,0.2)', borderRadius: 14,
          padding: 22, marginBottom: 20,
        }}>
          <div style={{ color: '#6b7280', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 }}>Active Tenancy</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ color: '#6b7280', fontSize: 11 }}>Unit</div>
              <div style={{ color: 'white', fontWeight: 600 }}>{t.unit_name || '—'}</div>
            </div>
            <div>
              <div style={{ color: '#6b7280', fontSize: 11 }}>Property</div>
              <div style={{ color: 'white', fontWeight: 600 }}>{t.project_title || '—'}</div>
            </div>
            {data.next_due_date && (
              <div>
                <div style={{ color: '#6b7280', fontSize: 11 }}>Next Due</div>
                <div style={{ color: '#f59e0b', fontWeight: 600 }}>
                  {new Date(data.next_due_date).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              </div>
            )}
            {data.active_notice_count > 0 && (
              <div>
                <div style={{ color: '#6b7280', fontSize: 11 }}>Active Notices</div>
                <div style={{ color: '#ef4444', fontWeight: 700 }}>{data.active_notice_count}</div>
              </div>
            )}
          </div>
        </div>

        {data.vault && (
          <VaultCard vault={data.vault} isStandalone={false} onPay={() => router.push('/tenant/pay')} />
        )}

        <RecentPayments payments={data.recent_payments} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {[
            { label: 'My Vault',       href: '/tenant/vault',         icon: '🏦' },
            { label: 'Contributions',  href: '/tenant/contributions',  icon: '📋' },
            { label: 'Notices',        href: '/tenant/notices',        icon: '📬' },
          ].map(({ label, href, icon }) => (
            <a key={href} href={href} style={{
              background: 'rgba(20,184,166,0.06)', border: '1px solid rgba(20,184,166,0.15)',
              borderRadius: 12, padding: '16px', textAlign: 'center', textDecoration: 'none',
            }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
              <div style={{ color: '#14b8a6', fontSize: 13, fontWeight: 600 }}>{label}</div>
            </a>
          ))}
        </div>
      </div>
    );
  }

  // ── Case B: Independent Tenant ────────────────────────────────────────────
  const sv = data.standalone_vault;
  return (
    <div style={shell}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ color: '#6b7280', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>Tenant Portal</div>
        <h1 style={{ margin: 0, color: 'white', fontSize: 24, fontWeight: 700 }}>My Dashboard</h1>
        <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 13 }}>Welcome, {name}! Your account is active and ready.</p>
      </div>

      {/* Onboarding Steps */}
      {data.onboarding_steps?.length > 0 && (
        <OnboardingProgress steps={data.onboarding_steps} />
      )}

      {/* Standalone Vault or Init CTA */}
      {sv ? (
        <>
          <VaultCard vault={sv} isStandalone={true} onPay={() => router.push('/tenant/pay')} />
          <RecentPayments payments={data.recent_payments} />
        </>
      ) : (
        <div style={{
          background: 'linear-gradient(135deg, #0d1f1f, #0a1a1a)',
          border: '1px solid rgba(20,184,166,0.2)', borderRadius: 14,
          padding: 32, marginBottom: 20, textAlign: 'center',
        }}>
          <div style={{ fontSize: 44, marginBottom: 16 }}>🔒</div>
          <div style={{ color: 'white', fontWeight: 700, fontSize: 17, marginBottom: 8 }}>
            No unit linked yet
          </div>
          <p style={{ color: '#6b7280', fontSize: 13, lineHeight: 1.7, marginBottom: 24, maxWidth: 440, margin: '0 auto 24px' }}>
            Your account is an independent savings profile. Browse the marketplace to find and apply for a property, or ask your landlord to send you an invite link. Once linked, your escrow vault activates automatically and tracks your rent target.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => router.push('/tenant/vault')}
              style={{
                padding: '11px 24px', borderRadius: 9,
                background: 'linear-gradient(135deg, #14b8a6, #0d9488)',
                border: 'none', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}
            >
              🚀 Initialize Savings Vault
            </button>
            <a href="/marketplace" style={{
              padding: '11px 24px', borderRadius: 9,
              background: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.2)',
              color: '#14b8a6', fontWeight: 700, fontSize: 13, textDecoration: 'none', display: 'inline-block',
            }}>
              Browse Properties
            </a>
          </div>
        </div>
      )}

      {/* Vault Feature Highlights */}
      <div style={{
        background: 'linear-gradient(135deg, #0d1f1f, #0a1a1a)',
        border: '1px solid rgba(20,184,166,0.12)', borderRadius: 14, padding: 22, marginBottom: 20,
      }}>
        <div style={{ color: '#6b7280', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 14 }}>
          Your Escrow Savings Vault
        </div>
        <p style={{ color: '#9ca3af', fontSize: 12, lineHeight: 1.7, marginBottom: 18, margin: '0 0 18px' }}>
          {sv
            ? 'Keep contributing. When your target is reached, funds auto-disburse to your landlord. You carry your vault history and tenant score across properties.'
            : 'Once you initialize, your Flex-Pay vault activates automatically. Contributions accumulate in Paystack escrow and auto-disburse to your landlord when the target is reached.'}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[
            { icon: '🔒', label: 'Escrow-held' },
            { icon: '📅', label: 'Your rhythm' },
            { icon: '⚡', label: 'Auto-disburse' },
            { icon: '🧾', label: 'SHA-256 receipts' },
          ].map(({ icon, label }) => (
            <div key={label} style={{
              background: 'rgba(20,184,166,0.06)', border: '1px solid rgba(20,184,166,0.1)',
              borderRadius: 9, padding: '12px 8px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
              <div style={{ color: '#9ca3af', fontSize: 10 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Links */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {[
          { label: 'My Vault',      href: '/tenant/vault',        icon: '🏦', sub: 'View & manage savings' },
          { label: 'Marketplace',   href: '/marketplace',          icon: '🏘️', sub: 'Find a property' },
        ].map(({ label, href, icon, sub }) => (
          <a key={href} href={href} style={{
            background: 'rgba(20,184,166,0.06)', border: '1px solid rgba(20,184,166,0.15)',
            borderRadius: 12, padding: '18px', textDecoration: 'none',
          }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
            <div style={{ color: 'white', fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{label}</div>
            <div style={{ color: '#6b7280', fontSize: 12 }}>{sub}</div>
          </a>
        ))}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
