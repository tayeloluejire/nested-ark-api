'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://nested-ark-api.onrender.com';

interface Tenancy {
  tenancy_id:      string;
  unit_id:         string;
  project_id:      string;
  tenant_name:     string;
  tenant_email:    string;
  unit_name:       string;
  project_title:   string;
  project_number:  string;
  // New world-class fields
  guarantor_json?:          { name: string; phone: string; work_id?: string; relationship?: string } | null;
  digital_signature_url?:   string | null;
  tenant_score?:            number | null;
  former_landlord_contact?: string | null;
  reason_for_quit?:         string | null;
  litigation_history?:      any[] | null;
}

interface Vault {
  id:                 string;
  vault_balance:      number;
  target_amount:      number;
  frequency:          string;
  installment_amount: number;
  currency:           string;
  next_due_date:      string;
  status:             string;
}

interface Contribution {
  id:           string;
  amount:       number;
  currency:     string;
  period_label: string;
  paid_at:      string;
  status:       string;
  receipt_id?:  string;
}

interface Notice {
  id:                string;
  notice_number:     string;
  notice_type:       string;
  amount_overdue:    number;
  days_overdue:      number;
  issued_at:         string;
  response_deadline: string;
  status:            string;
}

const NOTICE_COLORS: Record<string, string> = {
  ISSUED:   'text-amber-400 bg-amber-950 border-amber-800',
  SERVED:   'text-red-400 bg-red-950 border-red-800',
  RESOLVED: 'text-teal-400 bg-teal-950 border-teal-800',
  EXPIRED:  'text-zinc-400 bg-zinc-900 border-zinc-700',
};

const SCORE_COLOR = (s: number) =>
  s >= 80 ? 'text-teal-400' : s >= 60 ? 'text-amber-400' : 'text-red-400';

export default function TenantDashboardPage() {
  const router = useRouter();
  const [tenancy,       setTenancy]       = useState<Tenancy | null>(null);
  const [vault,         setVault]         = useState<Vault | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [notices,       setNotices]       = useState<Notice[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');
  const [payLoading,    setPayLoading]    = useState(false);
  const [tab,           setTab]           = useState<'vault' | 'history' | 'profile' | 'notices'>('vault');

  const token = typeof window !== 'undefined' ? localStorage.getItem('ark_token') : null;

  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function loadDashboard() {
    setLoading(true);
    setError('');
    try {
      // 1. Get tenancy
      const tenRes = await fetch(`${API}/api/tenant/my-tenancy`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!tenRes.ok) {
        const d = await tenRes.json();
        setError(d.error || 'Could not load your tenancy.');
        setLoading(false);
        return;
      }
      const ten: Tenancy = await tenRes.json();
      setTenancy(ten);

      // 2. Get vault
      const vRes = await fetch(
        `${API}/api/flex-pay/vault-status/${ten.tenancy_id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (vRes.ok) {
        const vd = await vRes.json();
        setVault(vd.vault || null);
      }

      // 3. Contributions
      const cRes = await fetch(
        `${API}/api/flex-pay/contributions/${ten.tenancy_id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (cRes.ok) {
        const cd = await cRes.json();
        setContributions(cd.contributions || []);
      }

      // 4. Legal notices
      const nRes = await fetch(
        `${API}/api/tenant/notices/${ten.tenancy_id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (nRes.ok) {
        const nd = await nRes.json();
        setNotices(nd.notices || []);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load dashboard.');
    } finally {
      setLoading(false);
    }
  }

  async function handlePay() {
    if (!tenancy?.tenancy_id) return;
    setPayLoading(true);
    try {
      const res = await fetch(`${API}/api/rental/payments/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tenancy_id: tenancy.tenancy_id }),
      });
      const data = await res.json();
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        alert(data.error || 'Could not initialize payment.');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setPayLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-teal-500 text-sm animate-pulse">Loading your dashboard…</div>
      </div>
    );
  }

  if (error && !tenancy) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
        <div className="text-4xl mb-4">🏠</div>
        <p className="text-zinc-400 text-sm mb-4">{error}</p>
        <p className="text-zinc-600 text-xs mb-6">
          No active tenancy is linked to your account yet. If you have a tenancy invite link, use it to complete onboarding first.
        </p>
        <button
          onClick={() => router.push('/')}
          className="bg-teal-500 text-black font-bold px-6 py-2 rounded-lg text-sm"
        >
          Back to Home
        </button>
      </div>
    );
  }

  if (!tenancy) return null;

  const score    = tenancy.tenant_score ?? 100;
  const funded   = vault ? Math.min((vault.vault_balance / vault.target_amount) * 100, 100) : 0;
  const hasNotice = notices.some(n => n.status === 'ISSUED' || n.status === 'SERVED');

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-zinc-900 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs text-teal-500 font-bold uppercase tracking-widest">Nested Ark</p>
            <p className="text-lg font-black text-white">{tenancy.tenant_name}</p>
            <p className="text-xs text-zinc-500">{tenancy.unit_name} · {tenancy.project_title}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-zinc-500 mb-1">Nested Ark Score</p>
            <p className={`text-2xl font-black ${SCORE_COLOR(score)}`}>{score}</p>
            <p className="text-xs text-zinc-600">/ 100</p>
          </div>
        </div>
      </div>

      {/* Active notice banner */}
      {hasNotice && (
        <div className="bg-red-950 border-b border-red-900 px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="text-sm font-bold text-red-300">You have an active legal notice</p>
              <p className="text-xs text-red-400">Review it in the Notices tab and take action before the deadline.</p>
            </div>
            <button
              onClick={() => setTab('notices')}
              className="ml-auto text-xs bg-red-800 text-red-200 px-3 py-1 rounded-lg"
            >
              View →
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-zinc-900 px-4">
        <div className="max-w-2xl mx-auto flex gap-0">
          {(['vault', 'history', 'profile', 'notices'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition ${
                tab === t
                  ? 'border-teal-500 text-teal-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t === 'notices' && hasNotice ? `${t} 🔴` : t}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* ── Vault Tab ── */}
        {tab === 'vault' && (
          <div className="space-y-4">
            {vault ? (
              <>
                {/* Vault card */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-1">Flex-Pay Vault</p>
                      <p className="text-3xl font-black text-teal-400 font-mono">
                        {vault.currency} {Number(vault.vault_balance).toLocaleString()}
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">
                        of {vault.currency} {Number(vault.target_amount).toLocaleString()} target
                      </p>
                    </div>
                    <div className={`text-xs font-bold px-3 py-1 rounded-full border ${
                      vault.status === 'FUNDED_READY' ? 'text-teal-400 bg-teal-950 border-teal-800' :
                      vault.status === 'ACTIVE'       ? 'text-amber-400 bg-amber-950 border-amber-800' :
                                                        'text-zinc-400 bg-zinc-800 border-zinc-700'
                    }`}>
                      {vault.status === 'FUNDED_READY' ? '✓ FUNDED' : vault.status}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden mb-3">
                    <div
                      className="h-2 bg-teal-500 rounded-full transition-all"
                      style={{ width: `${funded}%` }}
                    />
                  </div>
                  <p className="text-xs text-zinc-500">{funded.toFixed(1)}% funded</p>

                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <div className="bg-zinc-800 rounded-lg p-3">
                      <p className="text-xs text-zinc-500 mb-1">Frequency</p>
                      <p className="text-sm font-bold text-white">{vault.frequency}</p>
                    </div>
                    <div className="bg-zinc-800 rounded-lg p-3">
                      <p className="text-xs text-zinc-500 mb-1">Installment</p>
                      <p className="text-sm font-bold text-white font-mono">
                        {vault.currency} {Number(vault.installment_amount).toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-zinc-800 rounded-lg p-3">
                      <p className="text-xs text-zinc-500 mb-1">Next Due</p>
                      <p className="text-sm font-bold text-white">
                        {vault.next_due_date ? new Date(vault.next_due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handlePay}
                  disabled={payLoading}
                  className="w-full bg-teal-500 hover:bg-teal-400 text-black font-black py-4 rounded-xl text-sm transition disabled:opacity-50"
                >
                  {payLoading ? '⏳ Initializing…' : `💳 Pay ${vault.currency} ${Number(vault.installment_amount).toLocaleString()} Now`}
                </button>

                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-xs text-zinc-500">
                  <p className="font-bold text-zinc-400 mb-1">🔐 The 48-Hour Rule</p>
                  <p>If your vault is not funded within 48 hours of the due date, the system automatically triggers a formal Notice to Pay. Your vault is your responsibility.</p>
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-zinc-500 text-sm">No active vault found.</p>
                <p className="text-zinc-600 text-xs mt-2">Contact your landlord to set up your Flex-Pay vault.</p>
              </div>
            )}
          </div>
        )}

        {/* ── History Tab ── */}
        {tab === 'history' && (
          <div>
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4">Contribution History</h3>
            {contributions.length === 0 ? (
              <div className="text-center py-12 text-zinc-600 text-sm">No contributions recorded yet.</div>
            ) : (
              <div className="space-y-3">
                {contributions.map(c => (
                  <div key={c.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-white font-mono">
                        {c.currency} {Number(c.amount).toLocaleString()}
                      </p>
                      <p className="text-xs text-zinc-500 mt-0.5">{c.period_label}</p>
                      <p className="text-xs text-zinc-600">
                        {c.paid_at ? new Date(c.paid_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        c.status === 'SUCCESS' ? 'text-teal-400 bg-teal-950' : 'text-amber-400 bg-amber-950'
                      }`}>
                        {c.status}
                      </span>
                      {c.receipt_id && (
                        <a
                          href={`${API}/api/flex-pay/receipt/${c.receipt_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-teal-500 hover:text-teal-400"
                        >
                          📄 Receipt
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Profile Tab ── */}
        {tab === 'profile' && (
          <div className="space-y-4">
            {/* Nested Ark Score */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-3">Nested Ark Score</p>
              <div className="flex items-center gap-4">
                <div className={`text-5xl font-black font-mono ${SCORE_COLOR(score)}`}>{score}</div>
                <div>
                  <p className="text-sm font-bold text-white">
                    {score >= 80 ? 'Excellent Tenant' : score >= 60 ? 'Good Standing' : 'Needs Attention'}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {score >= 80
                      ? 'Your payment history is exemplary. Future landlords will see this.'
                      : score >= 60
                      ? 'A few missed payments have affected your score. Stay consistent.'
                      : 'Your score is low due to overdue payments or legal notices. Act now.'}
                  </p>
                </div>
              </div>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden mt-4">
                <div className={`h-2 rounded-full ${score >= 80 ? 'bg-teal-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${score}%` }} />
              </div>
            </div>

            {/* Tenancy info */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-3">Tenancy Details</p>
              <div className="space-y-2 text-sm">
                <Row label="Unit"    value={tenancy.unit_name} />
                <Row label="Project" value={tenancy.project_title} />
                <Row label="Ref"     value={tenancy.project_number} />
                <Row label="Email"   value={tenancy.tenant_email} />
              </div>
            </div>

            {/* Guarantor */}
            {tenancy.guarantor_json ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-3">🛡️ Guarantor on File</p>
                <div className="space-y-2 text-sm">
                  <Row label="Name"         value={tenancy.guarantor_json.name} />
                  <Row label="Phone"        value={tenancy.guarantor_json.phone} />
                  <Row label="Work / ID"    value={tenancy.guarantor_json.work_id   || 'Not provided'} />
                  <Row label="Relationship" value={tenancy.guarantor_json.relationship || 'Not specified'} />
                </div>
              </div>
            ) : (
              <div className="bg-zinc-900 border border-amber-900 rounded-xl p-4">
                <p className="text-xs text-amber-400 font-bold uppercase tracking-widest mb-1">⚠️ No Guarantor on File</p>
                <p className="text-xs text-zinc-500">Your tenancy profile is incomplete. Contact your landlord to update your guarantor details.</p>
              </div>
            )}

            {/* Digital Signature */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-3">✍️ Tenancy Handbook Signature</p>
              {tenancy.digital_signature_url ? (
                <div>
                  <p className="text-xs text-teal-400 mb-2">✓ Signed — Tenancy Handbook accepted</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={tenancy.digital_signature_url}
                    alt="Digital signature"
                    className="border border-zinc-700 rounded-lg max-w-[200px] bg-zinc-950"
                  />
                </div>
              ) : (
                <p className="text-xs text-amber-400">⚠️ Not yet signed. Complete your onboarding to sign the Tenancy Handbook.</p>
              )}
            </div>

            {/* Litigation history */}
            {Array.isArray(tenancy.litigation_history) && tenancy.litigation_history.length > 0 && (
              <div className="bg-red-950 border border-red-900 rounded-xl p-5">
                <p className="text-xs text-red-400 uppercase tracking-widest font-bold mb-3">⚖️ Litigation History</p>
                <div className="space-y-2">
                  {tenancy.litigation_history.map((l: any, i: number) => (
                    <div key={i} className="text-xs text-red-300 bg-red-900/30 rounded-lg p-3">
                      <p className="font-bold">{l.type || 'Legal Event'}</p>
                      <p className="text-red-400">{l.date || ''} — {l.description || ''}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Notices Tab ── */}
        {tab === 'notices' && (
          <div>
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4">Legal Notices</h3>
            {notices.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">✅</div>
                <p className="text-zinc-400 text-sm font-bold">No legal notices</p>
                <p className="text-zinc-600 text-xs mt-1">Your tenancy is in good standing.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {notices.map(n => (
                  <div key={n.id} className={`border rounded-xl p-5 ${NOTICE_COLORS[n.status] || NOTICE_COLORS.EXPIRED}`}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest opacity-75 mb-1">{n.notice_type.replace(/_/g, ' ')}</p>
                        <p className="font-mono text-sm font-bold">{n.notice_number}</p>
                      </div>
                      <span className="text-xs font-bold px-2 py-1 rounded-full border border-current opacity-75">
                        {n.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="opacity-60 uppercase tracking-widest text-[10px] mb-0.5">Amount Overdue</p>
                        <p className="font-bold font-mono">₦{Number(n.amount_overdue || 0).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="opacity-60 uppercase tracking-widest text-[10px] mb-0.5">Days Overdue</p>
                        <p className="font-bold">{n.days_overdue} days</p>
                      </div>
                      <div>
                        <p className="opacity-60 uppercase tracking-widest text-[10px] mb-0.5">Issued</p>
                        <p>{new Date(n.issued_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                      </div>
                      <div>
                        <p className="opacity-60 uppercase tracking-widest text-[10px] mb-0.5">Respond By</p>
                        <p className="font-bold">{n.response_deadline ? new Date(n.response_deadline).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</p>
                      </div>
                    </div>
                    {(n.status === 'ISSUED' || n.status === 'SERVED') && (
                      <div className="mt-3 pt-3 border-t border-current border-opacity-20">
                        <p className="text-xs opacity-75">To resolve this notice, make the overdue payment immediately.</p>
                        <button
                          onClick={handlePay}
                          className="mt-2 bg-current text-black font-bold text-xs px-4 py-2 rounded-lg opacity-90 hover:opacity-100 transition"
                        >
                          Pay Now to Resolve →
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-zinc-500 text-xs">{label}</span>
      <span className="text-white text-xs font-medium max-w-[200px] text-right">{value}</span>
    </div>
  );
}
