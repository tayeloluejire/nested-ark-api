'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// Backend URL — NEXT_PUBLIC_API_URL must be set in Vercel env vars
// pointing to the Render backend e.g. https://nested-ark-backend.onrender.com/api
// Falls back to relative /api for local dev only
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return (
    localStorage.getItem('ark_token') ||
    localStorage.getItem('token') ||
    sessionStorage.getItem('ark_token') ||
    sessionStorage.getItem('token') ||
    null
  );
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(n);

const fmtDate = (d?: string | null) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-NG', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return '—'; }
};

// ─── Types ────────────────────────────────────────────────────────────────────
type TenantType = 'linked' | 'standalone' | 'none';

interface VaultData {
  id: string;
  vault_balance: number;
  target_amount: number;
  installment_amount: number;
  funded_pct: number;
  status: string;
  frequency: string;
  total_contributed: number;
  contribution_count?: number;
  landlord_name?: string | null;
  landlord_email?: string | null;
  currency?: string;
}

interface TenancyData {
  id: string;
  tenant_name: string;
  tenant_email: string;
  unit_name: string;
  unit_type: string;
  project_title: string;
  project_number: string;
  location: string;
  lease_start: string;
  lease_end: string;
  rent_amount: number;
  currency: string;
  payment_frequency: string;
  status: string;
}

interface PaymentRow {
  id: string;
  amount_ngn: number;
  status: string;
  period_month?: string;
  period_label?: string;
  paid_at: string | null;
  ledger_hash?: string | null;
}

interface MaintenanceRow {
  id: string;
  title: string;
  category: string;
  severity: string;
  status: string;
  created_at: string;
}

interface OnboardingStep {
  key: string;
  label: string;
  status: 'done' | 'pending' | 'skipped';
}

interface ProfileData {
  user_id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  created_at: string | null;
}

interface DashboardData {
  hasActiveTenancy: boolean;
  tenancy: TenancyData | null;
  vault: VaultData | null;
  standalone_vault: VaultData | null;
  next_due_date: string | null;
  active_notice_count: number;
  recent_payments: PaymentRow[];
  recent_maintenance: MaintenanceRow[];
  profile?: ProfileData;
  onboarding_steps?: OnboardingStep[];
  message?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  SUCCESS:   '#10b981',
  PENDING:   '#f59e0b',
  FAILED:    '#ef4444',
  UNKNOWN:   '#6b7280',
};

const SEVERITY_COLOR: Record<string, string> = {
  HIGH:     '#ef4444',
  MEDIUM:   '#f59e0b',
  LOW:      '#10b981',
  CRITICAL: '#dc2626',
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLOR[status] || '#6b7280';
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
      background: `${color}18`, color, border: `1px solid ${color}40`,
      textTransform: 'uppercase', letterSpacing: 0.5,
    }}>
      {status}
    </span>
  );
}

function ProgressRing({ pct, size = 64 }: { pct: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const stroke = circ - (pct / 100) * circ;
  const color = pct >= 100 ? '#10b981' : pct >= 60 ? '#14b8a6' : pct >= 30 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(20,184,166,0.12)" strokeWidth={4} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={4}
        strokeDasharray={circ} strokeDashoffset={stroke}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />
      <text
        x="50%" y="50%"
        textAnchor="middle" dominantBaseline="central"
        style={{ transform: 'rotate(90deg)', transformOrigin: `${size / 2}px ${size / 2}px` }}
        fill={color} fontSize={10} fontWeight={700} fontFamily="monospace"
      >
        {pct}%
      </text>
    </svg>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function TenantDashboardPage() {
  const router = useRouter();
  const [data, setData]       = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      const token = getToken();
      if (!token) { router.replace('/login?reason=session_expired'); return; }
      try {
        const res = await fetch(`${API_BASE}/tenant/dashboard`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          credentials: 'include',
          cache: 'no-store',
        });

        // 401 — clear stale token and redirect
        if (res.status === 401) {
          localStorage.removeItem('ark_token');
          localStorage.removeItem('token');
          if (mounted) router.replace('/login?reason=session_expired');
          return;
        }

        if (!res.ok) throw new Error(`Server error (${res.status})`);

        const json = await res.json();

        // Support both raw response and wrapped { data: {} } or { dashboard: {} }
        const dashData = json.data || json.dashboard || json;

        if (dashData?.error || json?.error) {
          throw new Error(dashData.error || json.error);
        }

        if (mounted) setData(dashData);
      } catch (e: any) {
        if (mounted) setError(e.message || 'Failed to load dashboard');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // ── Derived state ─────────────────────────────────────────────────────────
  const tenantType: TenantType = data
    ? data.hasActiveTenancy
      ? 'linked'
      : data.standalone_vault
        ? 'standalone'
        : 'none'
    : 'none';

  const activeVault: VaultData | null = data
    ? (data.vault || data.standalone_vault || null)
    : null;

  const tenancy = data?.tenancy ?? null;
  const profile = data?.profile ?? null;
  const displayName = tenancy?.tenant_name || profile?.full_name || 'Tenant';
  const firstName   = displayName.split(' ')[0];

  // ── Shared styles ─────────────────────────────────────────────────────────
  const S = {
    shell: {
      maxWidth: 900,
      margin: '0 auto',
      padding: '28px 20px 48px',
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    } as React.CSSProperties,

    card: {
      background: 'linear-gradient(135deg, #0d1f1f 0%, #091818 100%)',
      border: '1px solid rgba(20,184,166,0.18)',
      borderRadius: 16,
    } as React.CSSProperties,

    cardPad: (extra?: React.CSSProperties) => ({
      background: 'linear-gradient(135deg, #0d1f1f 0%, #091818 100%)',
      border: '1px solid rgba(20,184,166,0.18)',
      borderRadius: 16,
      padding: '20px 22px',
      ...extra,
    } as React.CSSProperties),

    label: {
      color: '#6b7280',
      fontSize: 10,
      letterSpacing: 1.5,
      textTransform: 'uppercase' as const,
      marginBottom: 4,
    } as React.CSSProperties,

    val: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: 600,
    } as React.CSSProperties,

    tealVal: {
      color: '#14b8a6',
      fontSize: 15,
      fontWeight: 700,
      fontFamily: 'monospace',
    } as React.CSSProperties,

    sectionTitle: {
      color: '#9ca3af',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 1.5,
      textTransform: 'uppercase' as const,
      marginBottom: 14,
    } as React.CSSProperties,

    navLink: {
      color: '#14b8a6',
      fontSize: 12,
      fontWeight: 600,
      textDecoration: 'none',
      letterSpacing: 0.3,
    } as React.CSSProperties,

    dimLink: {
      color: '#4b5563',
      fontSize: 12,
      textDecoration: 'none',
    } as React.CSSProperties,
  };

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '60vh', background: '#050d0d',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 36, height: 36, border: '3px solid rgba(20,184,166,0.2)',
            borderTopColor: '#14b8a6', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 12px',
          }} />
          <div style={{ color: '#14b8a6', fontFamily: 'monospace', fontSize: 12, letterSpacing: 2 }}>
            LOADING PORTAL
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ─── Error ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={S.shell}>
        <div style={{ ...S.cardPad(), borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 13 }}>
          ⚠️ {error}
        </div>
      </div>
    );
  }

  // ─── No vault / no tenancy → onboarding CTA ───────────────────────────────
  if (tenantType === 'none') {
    return (
      <div style={S.shell}>
        {/* Header */}
        <PageHeader firstName={firstName} tenantType="none" />

        <div style={{ ...S.cardPad({ textAlign: 'center', padding: '48px 28px' }) }}>
          <div style={{ fontSize: 52, marginBottom: 20 }}>🏦</div>
          <h2 style={{ margin: '0 0 10px', color: '#ffffff', fontSize: 20, fontWeight: 700 }}>
            Welcome to Nested Ark
          </h2>
          <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.7, maxWidth: 420, margin: '0 auto 28px' }}>
            {data?.message || 'Initialize your personal savings vault to start building toward rent — no landlord required.'}
          </p>

          {/* Onboarding steps */}
          {data?.onboarding_steps && (
            <div style={{ marginBottom: 28, maxWidth: 360, margin: '0 auto 28px' }}>
              {data.onboarding_steps.map((step, i) => (
                <div key={step.key} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 0',
                  borderBottom: i < (data.onboarding_steps?.length ?? 0) - 1
                    ? '1px solid rgba(255,255,255,0.05)'
                    : 'none',
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                    background: step.status === 'done'
                      ? 'rgba(16,185,129,0.2)'
                      : step.status === 'skipped'
                        ? 'rgba(107,114,128,0.15)'
                        : 'rgba(245,158,11,0.15)',
                    border: `2px solid ${step.status === 'done' ? '#10b981' : step.status === 'skipped' ? '#4b5563' : '#f59e0b'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11,
                  }}>
                    {step.status === 'done' ? '✓' : step.status === 'skipped' ? '—' : '○'}
                  </div>
                  <span style={{
                    fontSize: 13,
                    color: step.status === 'done' ? '#ffffff' : step.status === 'skipped' ? '#4b5563' : '#9ca3af',
                  }}>
                    {step.label}
                  </span>
                  <span style={{
                    marginLeft: 'auto', fontSize: 10, fontWeight: 700,
                    color: step.status === 'done' ? '#10b981' : step.status === 'skipped' ? '#4b5563' : '#f59e0b',
                    textTransform: 'uppercase', letterSpacing: 0.5,
                  }}>
                    {step.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => router.push('/tenant/vault')}
            style={{
              padding: '13px 32px', borderRadius: 12,
              background: 'linear-gradient(135deg, #14b8a6, #0d9488)',
              border: 'none', color: 'white', fontWeight: 700, fontSize: 14,
              cursor: 'pointer', letterSpacing: 0.4,
            }}
          >
            🚀 Initialize My Vault
          </button>
        </div>
      </div>
    );
  }

  // ─── Full Dashboard (linked OR standalone) ────────────────────────────────
  return (
    <div style={{ ...S.shell, background: 'transparent' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .dash-section { animation: fadeUp 0.35s ease both; }
        .dash-section:nth-child(2) { animation-delay: 0.05s; }
        .dash-section:nth-child(3) { animation-delay: 0.10s; }
        .dash-section:nth-child(4) { animation-delay: 0.15s; }
        .dash-section:nth-child(5) { animation-delay: 0.20s; }
        .row-hover:hover { background: rgba(20,184,166,0.04) !important; }
        a { transition: color 0.15s; }
        a:hover { color: #2dd4bf !important; }
      `}</style>

      {/* ── Header ── */}
      <div className="dash-section">
        <PageHeader firstName={firstName} tenantType={tenantType} />
      </div>

      {/* ── Stat Bar ── */}
      <div className="dash-section" style={{ marginBottom: 20 }}>
        <StatBar
          data={data!}
          vault={activeVault}
          tenantType={tenantType}
          fmt={fmt}
          fmtDate={fmtDate}
        />
      </div>

      {/* ── Main grid: vault + property info ── */}
      <div className="dash-section" style={{
        display: 'grid',
        gridTemplateColumns: activeVault ? '1fr 1fr' : '1fr',
        gap: 16,
        marginBottom: 20,
      }}>
        {/* Vault card */}
        {activeVault && (
          <VaultCard vault={activeVault} tenantType={tenantType} fmt={fmt} S={S} />
        )}

        {/* Property / Profile info */}
        {tenantType === 'linked' && tenancy ? (
          <PropertyCard tenancy={tenancy} S={S} fmtDate={fmtDate} />
        ) : (
          <StandaloneInfoCard vault={activeVault} profile={profile} S={S} />
        )}
      </div>

      {/* ── Recent payments ── */}
      {(data?.recent_payments?.length ?? 0) > 0 && (
        <div className="dash-section" style={{ marginBottom: 20 }}>
          <RecentPayments
            payments={data!.recent_payments}
            tenantType={tenantType}
            S={S}
            fmt={fmt}
            fmtDate={fmtDate}
          />
        </div>
      )}

      {/* ── Maintenance (linked only) ── */}
      {tenantType === 'linked' && (data?.recent_maintenance?.length ?? 0) > 0 && (
        <div className="dash-section" style={{ marginBottom: 20 }}>
          <MaintenanceCard maintenance={data!.recent_maintenance} S={S} fmtDate={fmtDate} />
        </div>
      )}

      {/* ── Notices banner (linked only) ── */}
      {tenantType === 'linked' && (data?.active_notice_count ?? 0) > 0 && (
        <div className="dash-section" style={{ marginBottom: 20 }}>
          <div style={{
            ...S.cardPad(),
            borderColor: 'rgba(245,158,11,0.3)',
            background: 'rgba(245,158,11,0.05)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>⚠️</span>
              <div>
                <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: 13 }}>
                  {data!.active_notice_count} Active Legal Notice{data!.active_notice_count !== 1 ? 's' : ''}
                </div>
                <div style={{ color: '#6b7280', fontSize: 12 }}>Review your notices immediately</div>
              </div>
            </div>
            <a href="/tenant/notices" style={{ ...S.navLink, color: '#f59e0b' }}>View →</a>
          </div>
        </div>
      )}

      {/* ── Quick actions ── */}
      <div className="dash-section">
        <QuickActions tenantType={tenantType} vault={activeVault} router={router} S={S} />
      </div>

      {/* ── Footer nav ── */}
      <div style={{ marginTop: 32, display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap' }}>
        <a href="/tenant/vault"         style={S.navLink}>My Vault</a>
        <a href="/tenant/pay"           style={S.navLink}>Pay Installment</a>
        <a href="/tenant/contributions" style={S.navLink}>Contributions</a>
        {tenantType === 'linked' && <a href="/tenant/maintenance" style={S.dimLink}>Maintenance</a>}
        {tenantType === 'linked' && <a href="/tenant/notices"     style={S.dimLink}>Notices</a>}
      </div>

      <div style={{ marginTop: 20, textAlign: 'center', color: '#1f3030', fontSize: 10, fontFamily: 'monospace' }}>
        🔐 SHA-256 LEDGER ACTIVE · NESTED ARK OS
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PageHeader({ firstName, tenantType }: { firstName: string; tenantType: TenantType }) {
  const tagMap: Record<TenantType, { label: string; color: string }> = {
    linked:     { label: 'Linked Tenancy',            color: '#14b8a6' },
    standalone: { label: 'Independent Savings Vault', color: '#818cf8' },
    none:       { label: 'Tenant Portal',             color: '#6b7280' },
  };
  const tag = tagMap[tenantType];
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: `${tag.color}14`,
        border: `1px solid ${tag.color}30`,
        borderRadius: 20, padding: '3px 12px', marginBottom: 10,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: tag.color, display: 'inline-block' }} />
        <span style={{ color: tag.color, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' }}>
          {tag.label}
        </span>
      </div>
      <h1 style={{ margin: '0 0 6px', color: 'white', fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>
        Welcome back, {firstName}
      </h1>
      <p style={{ margin: 0, color: '#4b5563', fontSize: 13 }}>
        Your Nested Ark tenant portal — all activity at a glance.
      </p>
    </div>
  );
}

function StatBar({
  data, vault, tenantType, fmt, fmtDate,
}: {
  data: DashboardData;
  vault: VaultData | null;
  tenantType: TenantType;
  fmt: (n: number) => string;
  fmtDate: (d: string | null) => string;
}) {
  const stats: { label: string; value: string; sub?: string; accent?: boolean }[] = [];

  if (vault) {
    stats.push({
      label: 'Vault Balance',
      value: fmt(vault.vault_balance),
      sub: `${vault.funded_pct}% of target`,
      accent: true,
    });
    stats.push({
      label: 'Total Contributed',
      value: fmt(vault.total_contributed),
      sub: vault.contribution_count != null
        ? `${vault.contribution_count} payment${vault.contribution_count !== 1 ? 's' : ''}`
        : undefined,
    });
  }

  if (tenantType === 'linked') {
    stats.push({
      label: 'Next Due',
      value: fmtDate(data.next_due_date),
      sub: data.tenancy?.payment_frequency?.toLowerCase() ?? '',
    });
    stats.push({
      label: 'Active Notices',
      value: String(data.active_notice_count),
      sub: data.active_notice_count > 0 ? 'requires attention' : 'all clear',
    });
  } else if (tenantType === 'standalone' && vault) {
    stats.push({
      label: 'Vault Status',
      value: vault.status,
      sub: vault.frequency?.toLowerCase(),
    });
    stats.push({
      label: 'Installment',
      value: fmt(vault.installment_amount),
      sub: 'per period',
    });
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${Math.min(stats.length, 4)}, 1fr)`,
      gap: 12,
    }}>
      {stats.map(({ label, value, sub, accent }) => (
        <div key={label} style={{
          background: accent
            ? 'linear-gradient(135deg, rgba(20,184,166,0.12), rgba(13,148,136,0.06))'
            : 'linear-gradient(135deg, #0d1f1f 0%, #091818 100%)',
          border: `1px solid ${accent ? 'rgba(20,184,166,0.35)' : 'rgba(20,184,166,0.12)'}`,
          borderRadius: 14, padding: '16px 18px',
        }}>
          <div style={{ color: '#6b7280', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 5 }}>
            {label}
          </div>
          <div style={{
            color: accent ? '#14b8a6' : '#ffffff',
            fontWeight: 700, fontFamily: 'monospace', fontSize: 15,
          }}>
            {value}
          </div>
          {sub && (
            <div style={{ color: '#4b5563', fontSize: 11, marginTop: 3 }}>{sub}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function VaultCard({
  vault, tenantType, fmt, S,
}: {
  vault: VaultData;
  tenantType: TenantType;
  fmt: (n: number) => string;
  S: any;
}) {
  const isStandalone = tenantType === 'standalone';
  const color = vault.funded_pct >= 100 ? '#10b981' : vault.funded_pct >= 60 ? '#14b8a6' : '#f59e0b';

  return (
    <div style={{ ...S.cardPad() }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <div style={S.label}>{isStandalone ? 'Independent Savings Vault' : 'Flex-Pay Vault'}</div>
          <div style={{ color: '#ffffff', fontSize: 17, fontWeight: 800, fontFamily: 'monospace' }}>
            {fmt(vault.vault_balance)}
          </div>
          <div style={{ color: '#4b5563', fontSize: 11, marginTop: 2 }}>
            of {fmt(vault.target_amount)} target
          </div>
        </div>
        <ProgressRing pct={vault.funded_pct} size={68} />
      </div>

      {/* Progress bar */}
      <div style={{ height: 5, background: '#0a1a1a', borderRadius: 3, overflow: 'hidden', marginBottom: 14 }}>
        <div style={{
          height: '100%', width: `${vault.funded_pct}%`,
          background: `linear-gradient(90deg, ${color}, ${color}cc)`,
          borderRadius: 3, transition: 'width 0.8s ease',
        }} />
      </div>

      {/* Key fields */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        {[
          { label: 'Installment', value: fmt(vault.installment_amount) },
          { label: 'Frequency',   value: vault.frequency?.toLowerCase() ?? '—' },
          { label: 'Status',      value: vault.status },
          { label: 'Funded',      value: `${vault.funded_pct}%` },
        ].map(({ label, value }) => (
          <div key={label} style={{
            background: 'rgba(20,184,166,0.04)',
            borderRadius: 8, padding: '8px 10px',
          }}>
            <div style={S.label}>{label}</div>
            <div style={{ color: '#e5e7eb', fontSize: 12, fontWeight: 600, fontFamily: 'monospace' }}>{value}</div>
          </div>
        ))}
      </div>

      {vault.funded_pct >= 100 && (
        <div style={{
          background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
          borderRadius: 8, padding: '8px 12px', textAlign: 'center',
          color: '#10b981', fontSize: 12, fontWeight: 700, marginBottom: 12,
        }}>
          🎉 Vault Fully Funded — Awaiting Disbursement
        </div>
      )}

      <a href="/tenant/vault" style={{ ...S.navLink, display: 'block', textAlign: 'center', marginTop: 4 }}>
        View Full Vault →
      </a>
    </div>
  );
}

function PropertyCard({
  tenancy, S, fmtDate,
}: {
  tenancy: TenancyData;
  S: any;
  fmtDate: (d: string | null) => string;
}) {
  return (
    <div style={{ ...S.cardPad() }}>
      <div style={S.sectionTitle}>Property Details</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          { label: 'Property',   value: tenancy.project_title },
          { label: 'Unit',       value: `${tenancy.unit_name} · ${tenancy.unit_type}` },
          { label: 'Location',   value: tenancy.location },
          { label: 'Lease Start', value: fmtDate(tenancy.lease_start) },
          { label: 'Lease End',  value: fmtDate(tenancy.lease_end) },
          { label: 'Rent',       value: `${tenancy.currency} ${Number(tenancy.rent_amount).toLocaleString()}` },
          { label: 'Frequency',  value: tenancy.payment_frequency?.toLowerCase() },
          { label: 'Status',     value: tenancy.status },
        ].map(({ label, value }) => (
          <div key={label} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
            paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.04)',
          }}>
            <span style={{ color: '#4b5563', fontSize: 12 }}>{label}</span>
            <span style={{
              color: '#e5e7eb', fontSize: 12, fontWeight: 600,
              textAlign: 'right', maxWidth: '55%', wordBreak: 'break-word',
            }}>
              {value || '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StandaloneInfoCard({
  vault, profile, S,
}: {
  vault: VaultData | null;
  profile: ProfileData | null;
  S: any;
}) {
  return (
    <div style={{ ...S.cardPad() }}>
      <div style={S.sectionTitle}>Account Overview</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {profile && [
          { label: 'Name',    value: profile.full_name },
          { label: 'Email',   value: profile.email },
          { label: 'Phone',   value: profile.phone },
          { label: 'Member Since', value: profile.created_at
            ? new Date(profile.created_at).toLocaleDateString('en-NG', { month: 'short', year: 'numeric' })
            : '—',
          },
        ].map(({ label, value }) => (
          <div key={label} style={{
            display: 'flex', justifyContent: 'space-between',
            paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.04)',
          }}>
            <span style={{ color: '#4b5563', fontSize: 12 }}>{label}</span>
            <span style={{ color: '#e5e7eb', fontSize: 12, fontWeight: 600 }}>{value || '—'}</span>
          </div>
        ))}
        {vault?.landlord_name && (
          <div style={{
            background: 'rgba(20,184,166,0.06)', borderRadius: 8, padding: '10px 12px', marginTop: 6,
            border: '1px solid rgba(20,184,166,0.12)',
          }}>
            <div style={{ color: '#6b7280', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
              Saving Towards
            </div>
            <div style={{ color: '#14b8a6', fontSize: 13, fontWeight: 600 }}>{vault.landlord_name}</div>
            {vault.landlord_email && (
              <div style={{ color: '#4b5563', fontSize: 11, marginTop: 2 }}>{vault.landlord_email}</div>
            )}
          </div>
        )}
        {!vault?.landlord_name && (
          <div style={{
            background: 'rgba(99,102,241,0.06)', borderRadius: 8, padding: '10px 12px', marginTop: 6,
            border: '1px solid rgba(99,102,241,0.15)',
          }}>
            <div style={{ color: '#818cf8', fontSize: 12, fontWeight: 600, marginBottom: 3 }}>
              Independent Savings Mode
            </div>
            <div style={{ color: '#4b5563', fontSize: 11, lineHeight: 1.5 }}>
              Saving without a linked landlord. Add landlord details in vault settings to enable direct disbursement.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RecentPayments({
  payments, tenantType, S, fmt, fmtDate,
}: {
  payments: PaymentRow[];
  tenantType: TenantType;
  S: any;
  fmt: (n: number) => string;
  fmtDate: (d: string | null) => string;
}) {
  return (
    <div style={{ ...S.card, overflow: 'hidden' }}>
      {/* header */}
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid rgba(20,184,166,0.08)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={S.sectionTitle}>Recent Payments</div>
        <a href="/tenant/contributions" style={S.navLink}>View All →</a>
      </div>

      {/* table header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 120px 90px 110px',
        padding: '10px 20px',
        background: 'rgba(20,184,166,0.03)',
        borderBottom: '1px solid rgba(20,184,166,0.06)',
      }}>
        {['Date', 'Amount', 'Status', 'Period'].map(h => (
          <div key={h} style={{ color: '#374151', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }}>{h}</div>
        ))}
      </div>

      {payments.map((p, i) => (
        <div
          key={p.id}
          className="row-hover"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 120px 90px 110px',
            padding: '12px 20px',
            borderBottom: i < payments.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
            alignItems: 'center',
            transition: 'background 0.15s',
          }}
        >
          <div style={{ color: '#d1d5db', fontSize: 12 }}>{fmtDate(p.paid_at)}</div>
          <div style={{ color: '#ffffff', fontWeight: 700, fontFamily: 'monospace', fontSize: 12 }}>
            {fmt(p.amount_ngn)}
          </div>
          <div><StatusBadge status={p.status} /></div>
          <div style={{ color: '#6b7280', fontSize: 11, fontFamily: 'monospace' }}>
            {p.period_month || p.period_label || '—'}
          </div>
        </div>
      ))}
    </div>
  );
}

function MaintenanceCard({
  maintenance, S, fmtDate,
}: {
  maintenance: MaintenanceRow[];
  S: any;
  fmtDate: (d: string | null) => string;
}) {
  return (
    <div style={{ ...S.card, overflow: 'hidden' }}>
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid rgba(20,184,166,0.08)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={S.sectionTitle}>Maintenance Requests</div>
        <a href="/tenant/maintenance" style={S.navLink}>View All →</a>
      </div>
      {maintenance.map((m, i) => (
        <div
          key={m.id}
          className="row-hover"
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 20px',
            borderBottom: i < maintenance.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
            transition: 'background 0.15s',
          }}
        >
          <div style={{
            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
            background: SEVERITY_COLOR[m.severity] || '#6b7280',
          }} />
          <div style={{ flex: 1 }}>
            <div style={{ color: '#e5e7eb', fontSize: 13, fontWeight: 600 }}>{m.title}</div>
            <div style={{ color: '#4b5563', fontSize: 11, marginTop: 2 }}>
              {m.category} · {fmtDate(m.created_at)}
            </div>
          </div>
          <StatusBadge status={m.status} />
        </div>
      ))}
    </div>
  );
}

function QuickActions({
  tenantType, vault, router, S,
}: {
  tenantType: TenantType;
  vault: VaultData | null;
  router: any;
  S: any;
}) {
  const actions: { icon: string; label: string; sub: string; href: string; primary?: boolean; disabled?: boolean }[] = [
    {
      icon: '⚡',
      label: 'Pay Installment',
      sub: vault ? `Next: ${new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(vault.installment_amount)}` : 'Contribute to vault',
      href: '/tenant/pay',
      primary: true,
      disabled: vault?.funded_pct === 100,
    },
    {
      icon: '📊',
      label: 'Contribution History',
      sub: 'SHA-256 ledger records',
      href: '/tenant/contributions',
    },
    {
      icon: '🏦',
      label: 'My Vault',
      sub: tenantType === 'standalone' ? 'Independent savings' : 'Flex-Pay vault',
      href: '/tenant/vault',
    },
  ];

  if (tenantType === 'linked') {
    actions.push({
      icon: '🔧',
      label: 'Maintenance',
      sub: 'Submit a request',
      href: '/tenant/maintenance',
    });
  }

  return (
    <div>
      <div style={S.sectionTitle}>Quick Actions</div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.min(actions.length, 4)}, 1fr)`,
        gap: 12,
      }}>
        {actions.map(({ icon, label, sub, href, primary, disabled }) => (
          <button
            key={label}
            onClick={() => !disabled && router.push(href)}
            disabled={disabled}
            style={{
              background: primary && !disabled
                ? 'linear-gradient(135deg, rgba(20,184,166,0.15), rgba(13,148,136,0.08))'
                : 'linear-gradient(135deg, #0d1f1f, #091818)',
              border: `1px solid ${primary && !disabled ? 'rgba(20,184,166,0.4)' : 'rgba(20,184,166,0.12)'}`,
              borderRadius: 14, padding: '16px 14px', cursor: disabled ? 'not-allowed' : 'pointer',
              textAlign: 'left', opacity: disabled ? 0.45 : 1,
              transition: 'all 0.15s',
            }}
          >
            <div style={{ fontSize: 22, marginBottom: 8 }}>{icon}</div>
            <div style={{
              color: primary && !disabled ? '#14b8a6' : '#e5e7eb',
              fontWeight: 700, fontSize: 13, marginBottom: 3,
            }}>
              {label}
            </div>
            <div style={{ color: '#4b5563', fontSize: 11 }}>{sub}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
