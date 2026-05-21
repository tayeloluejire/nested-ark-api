'use client';
export const dynamic = 'force-dynamic';
/**
 * apps/frontend/src/app/projects/[id]/rental-management/page.tsx
 *
 * Settlement Bank Details section now uses Option 1:
 *  → Loads landlord's verified bank accounts from /api/landlord/bank-accounts
 *  → Dropdown selector — no free-text fields, no typo risk
 *  → If no accounts exist, shows a direct link to /landlord/bank to add one
 *  → selected_bank_account_id posted alongside unit data so backend auto-bridges
 *
 * Everything else (existing units display, tabs, onboard links) is unchanged.
 */

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import {
  Building2, Plus, FileText, ArrowRight, Loader2,
  CheckCircle2, AlertCircle, Send, ExternalLink,
  Landmark, Info, RefreshCw,
} from 'lucide-react';

const safeF = (v: any): string => {
  const n = Number(v);
  return (v == null || isNaN(n)) ? '0' : n.toLocaleString();
};

interface BankAccount {
  id: string;
  account_name: string;
  account_number: string;
  bank_name: string;
  is_default: boolean;
  payout_ready: boolean;
  paystack_recipient_code?: string;
}

interface Unit {
  id: string;
  unit_name: string;
  rent_amount: number;
  currency: string;
  payment_frequency?: string;
  status: string;
  tenancy_status?: string;
  tenant_name?: string;
  bank_name?: string;
  account_number?: string;
  security_deposit?: number;
  agency_fee?: number;
  caution_fee?: number;
}

// ── mask last 4 digits only ────────────────────────────────────────────────
const maskAcct = (n: string) => n ? `****${n.slice(-4)}` : '****';

function RentalManagementContent({ projectId }: { projectId: string }) {
  const searchParams  = useSearchParams();
  const initialTab    = searchParams.get('tab') || 'units';
  const [activeTab,   setActiveTab]   = useState(initialTab);
  const [project,     setProject]     = useState<any>(null);
  const [units,       setUnits]       = useState<Unit[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');

  // ── Verified bank accounts (Option 1 selector) ────────────────────────────
  const [bankAccounts,  setBankAccounts]  = useState<BankAccount[]>([]);
  const [loadingBanks,  setLoadingBanks]  = useState(false);
  const [selectedBankId,setSelectedBankId]= useState('');

  // ── Deploy form ────────────────────────────────────────────────────────────
  const [submitting,    setSubmitting]    = useState(false);
  const [submitOk,      setSubmitOk]      = useState('');
  const [newUnitId,     setNewUnitId]     = useState('');
  const [submitErr,     setSubmitErr]     = useState('');

  // Specs
  const [unitName,      setUnitName]      = useState('');
  const [bedrooms,      setBedrooms]      = useState('1');
  const [bathrooms,     setBathrooms]     = useState('1');
  const [floorArea,     setFloorArea]     = useState('');
  const [floor,         setFloor]         = useState('');
  const [furnishing,    setFurnishing]    = useState('Unfurnished');

  // Terms
  const [currency,      setCurrency]      = useState('NGN');
  const [frequency,     setFrequency]     = useState('Annual');
  const [rentAmount,    setRentAmount]    = useState('');
  const [deposit,       setDeposit]       = useState('');
  const [serviceCharge, setServiceCharge] = useState('');
  const [agencyFee,     setAgencyFee]     = useState('');
  const [legalFee,      setLegalFee]      = useState('');
  const [cautionFee,    setCautionFee]    = useState('');

  // ── Load project + units ──────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [projRes, unitsRes] = await Promise.all([
        api.get(`/api/projects/${projectId}`),
        api.get(`/api/rental/units/${projectId}`),
      ]);
      if (projRes.data?.project) setProject(projRes.data.project);
      if (unitsRes.data?.units)  setUnits(unitsRes.data.units);
      else if (Array.isArray(unitsRes.data)) setUnits(unitsRes.data);
    } catch (ex: any) {
      setError(ex?.response?.data?.error ?? 'Could not load project data.');
    } finally { setLoading(false); }
  }, [projectId]);

  // ── Load verified landlord bank accounts ─────────────────────────────────
  const loadBankAccounts = useCallback(async () => {
    setLoadingBanks(true);
    try {
      const res = await api.get('/api/landlord/bank-accounts');
      const accts: BankAccount[] = res.data.accounts ?? [];
      setBankAccounts(accts);
      // Pre-select default account
      const def = accts.find(a => a.is_default) ?? accts[0];
      if (def) setSelectedBankId(def.id);
    } catch { /* non-fatal — handled in UI */ }
    finally { setLoadingBanks(false); }
  }, []);

  useEffect(() => {
    loadData();
    loadBankAccounts();
  }, [loadData, loadBankAccounts]);

  // ── Deploy unit ───────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitErr('');
    if (!unitName.trim())  { setSubmitErr('Unit name is required.'); return; }
    if (!rentAmount)       { setSubmitErr('Rent amount is required.'); return; }
    if (!selectedBankId)   { setSubmitErr('Select a settlement bank account before deploying.'); return; }

    const selectedAcct = bankAccounts.find(a => a.id === selectedBankId);
    setSubmitting(true); setSubmitOk(''); setNewUnitId('');
    try {
      const res = await api.post('/api/rental/units', {
        project_id:               projectId,
        unit_name:                unitName.trim(),
        bedrooms:                 Number(bedrooms),
        bathrooms:                Number(bathrooms),
        floor_area_sqm:           floorArea ? Number(floorArea) : undefined,
        floor_level:              floor || undefined,
        furnished:                furnishing !== 'Unfurnished',
        furnishing,
        rent_amount:              Number(rentAmount),
        currency,
        payment_frequency:        frequency,
        security_deposit:         deposit      ? Number(deposit)      : 0,
        service_charge:           serviceCharge? Number(serviceCharge): 0,
        agency_fee:               agencyFee    ? Number(agencyFee)    : 0,
        legal_fee:                legalFee     ? Number(legalFee)     : 0,
        caution_fee:              cautionFee   ? Number(cautionFee)   : 0,
        // ── Bank fields from verified account — no free text ──────────────
        bank_name:                selectedAcct?.bank_name      ?? '',
        account_number:           selectedAcct?.account_number ?? '',
        account_name:             selectedAcct?.account_name   ?? '',
        selected_bank_account_id: selectedBankId,   // backend uses this to link landlord_bank_accounts
      });

      if (res.data?.unit?.id) setNewUnitId(res.data.unit.id);
      setSubmitOk(`Unit "${unitName}" added successfully!`);

      // Reset form
      setUnitName(''); setRentAmount(''); setDeposit('');
      setServiceCharge(''); setAgencyFee(''); setLegalFee('');
      setCautionFee(''); setFloorArea(''); setFloor('');
      setFurnishing('Unfurnished');

      // Refresh unit list
      const unitsRes = await api.get(`/api/rental/units/${projectId}`);
      if (unitsRes.data?.units) setUnits(unitsRes.data.units);
      else if (Array.isArray(unitsRes.data)) setUnits(unitsRes.data);
    } catch (ex: any) {
      setSubmitErr(ex?.response?.data?.error ?? 'Failed to add unit. Try again.');
    } finally { setSubmitting(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <Loader2 className="animate-spin text-teal-500" size={32} />
    </div>
  );

  const payoutReadyAccounts = bankAccounts.filter(a => a.payout_ready);

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar />

      {/* Sticky project header */}
      <header className="border-b border-zinc-900 bg-black/60 backdrop-blur-md sticky top-16 z-40 py-4">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-0.5">
              <Link href="/projects/my" className="hover:text-teal-400 transition-colors">My Projects</Link>
              <span>·</span>
              <span className="text-zinc-400">Rental Management</span>
            </div>
            <h1 className="text-lg font-black tracking-tight uppercase">
              {project?.title ?? 'Loading…'}
            </h1>
            <p className="text-[10px] text-zinc-500">Deploy and configure apartment units for this property</p>
          </div>
          <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-900 self-start sm:self-center">
            {(['units','receipts'] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-wider transition-all ${
                  activeTab === t ? 'bg-zinc-900 text-teal-400' : 'text-zinc-500 hover:text-zinc-300'
                }`}>
                {t === 'units' ? <Building2 size={11} /> : <FileText size={11} />}
                {t === 'units' ? 'Units' : 'Receipts'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-10">
        {error && (
          <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 text-red-400 text-xs font-bold flex items-center gap-2 mb-8">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {/* ── UNITS TAB ─────────────────────────────────────────────────────── */}
        {activeTab === 'units' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

            {/* LEFT — existing units */}
            <div className="lg:col-span-7 space-y-5">
              <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest flex items-center gap-2">
                  Existing Units
                  <span className="text-teal-400 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded text-[10px]">
                    {units.length}
                  </span>
                </p>
              </div>

              {units.length === 0 ? (
                <div className="py-16 text-center border border-dashed border-zinc-800 rounded-2xl">
                  <Building2 className="text-zinc-700 mx-auto mb-3" size={32} />
                  <p className="text-zinc-500 text-xs">No units yet. Deploy your first unit using the panel →</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {units.map(unit => {
                    const isOccupied = ['Occupied','ACTIVE','occupied'].includes(unit.tenancy_status ?? unit.status ?? '');
                    return (
                      <div key={unit.id} className="p-4 rounded-2xl bg-zinc-950 border border-zinc-900 hover:border-zinc-800 transition-all flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-bold text-sm text-zinc-200 truncate">{unit.unit_name}</p>
                          <span className={`text-[8px] px-2 py-0.5 rounded font-black uppercase border shrink-0 ${
                            isOccupied
                              ? 'bg-teal-500/5 border-teal-500/20 text-teal-400'
                              : 'bg-amber-500/5 border-amber-500/20 text-amber-400'
                          }`}>
                            {isOccupied ? 'Occupied' : 'Vacant'}
                          </span>
                        </div>

                        <div>
                          <p className="text-xs font-black text-zinc-400">
                            {unit.currency || 'NGN'} {safeF(unit.rent_amount)}
                            <span className="text-[10px] font-medium text-zinc-600"> / {(unit.payment_frequency || 'annual').toLowerCase()}</span>
                          </p>
                          {(unit.security_deposit || unit.agency_fee || unit.caution_fee) ? (
                            <p className="text-[9px] text-zinc-600 mt-1">
                              {Number(unit.security_deposit) > 0 && `Deposit: ${safeF(unit.security_deposit)} · `}
                              {Number(unit.agency_fee)       > 0 && `Agency: ${safeF(unit.agency_fee)} · `}
                              {Number(unit.caution_fee)      > 0 && `Caution: ${safeF(unit.caution_fee)}`}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex items-center justify-between text-[9px] border-t border-zinc-900/60 pt-2">
                          <span className="text-zinc-500 truncate">
                            {isOccupied ? `👤 ${unit.tenant_name ?? 'Tenant'}` : '🏚 No tenant'}
                          </span>
                          {unit.bank_name && (
                            <span className="text-zinc-600 font-mono truncate max-w-[50%]">
                              🏦 {unit.bank_name} · {unit.account_number ? maskAcct(unit.account_number) : '****'}
                            </span>
                          )}
                        </div>

                        {!isOccupied && (
                          <Link href={`/landlord/onboard/${unit.id}`}
                            className="w-full py-2 bg-zinc-900 hover:bg-teal-500 hover:text-black border border-zinc-800 text-zinc-400 font-black text-[9px] uppercase tracking-wider rounded-xl transition-all text-center flex items-center justify-center gap-1">
                            Onboard Tenant <ArrowRight size={10} />
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* RIGHT — deploy form */}
            <div className="lg:col-span-5 space-y-6 bg-black/40 border border-zinc-900 p-6 rounded-3xl self-start">
              <div>
                <p className="text-[9px] text-teal-400 uppercase font-black tracking-widest flex items-center gap-1.5 mb-1">
                  <Plus size={11} /> Deploy New Unit
                </p>
                <p className="text-[10px] text-zinc-500">Configure specs and link to your verified payout account.</p>
              </div>

              {/* Success */}
              {submitOk && (
                <div className="p-4 rounded-xl bg-teal-500/5 border border-teal-500/20 text-teal-400 text-xs font-bold space-y-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="shrink-0 mt-0.5" /> {submitOk}
                  </div>
                  {newUnitId && (
                    <Link href={`/landlord/onboard/${newUnitId}`}
                      className="inline-flex items-center gap-1.5 bg-teal-500 text-black px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-white transition-all">
                      Onboard Tenant Now <ArrowRight size={10} />
                    </Link>
                  )}
                </div>
              )}

              {/* Error */}
              {submitErr && (
                <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/20 text-red-400 text-xs font-bold flex items-center gap-2">
                  <AlertCircle size={12} /> {submitErr}
                </div>
              )}

              {/* ── Section A: Specs ── */}
              <section className="space-y-3 border-t border-zinc-900 pt-4">
                <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">Apartment Specs & Identity</p>

                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">Unit Name *</label>
                  <input type="text" value={unitName} onChange={e => setUnitName(e.target.value)}
                    placeholder="e.g. Alpha Courts, Flat 3B"
                    className="w-full bg-black border border-zinc-800 px-4 py-3 rounded-xl text-xs outline-none focus:border-teal-500 transition-colors" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">Bedrooms</label>
                    <select value={bedrooms} onChange={e => setBedrooms(e.target.value)}
                      className="w-full bg-black border border-zinc-800 px-3 py-3 rounded-xl text-xs outline-none focus:border-teal-500">
                      {['1','2','3','4','5','6'].map(n => <option key={n} value={n}>{n} Bed</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">Bathrooms</label>
                    <select value={bathrooms} onChange={e => setBathrooms(e.target.value)}
                      className="w-full bg-black border border-zinc-800 px-3 py-3 rounded-xl text-xs outline-none focus:border-teal-500">
                      {['1','2','3','4'].map(n => <option key={n} value={n}>{n} Bath</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">Size (sqm)</label>
                    <input type="number" value={floorArea} onChange={e => setFloorArea(e.target.value)} placeholder="e.g. 85"
                      className="w-full bg-black border border-zinc-800 px-4 py-3 rounded-xl text-xs outline-none focus:border-teal-500" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">Floor Level</label>
                    <input type="text" value={floor} onChange={e => setFloor(e.target.value)} placeholder="e.g. Ground"
                      className="w-full bg-black border border-zinc-800 px-4 py-3 rounded-xl text-xs outline-none focus:border-teal-500" />
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">Furnishing</label>
                  <div className="flex gap-2">
                    {['Unfurnished','Semi-Furnished','Fully Furnished'].map(f => (
                      <button key={f} onClick={() => setFurnishing(f)}
                        className={`flex-1 py-2 text-[9px] font-black uppercase rounded-xl border transition-all ${
                          furnishing === f
                            ? 'bg-zinc-800 border-teal-500/40 text-teal-400'
                            : 'border-zinc-800 text-zinc-600 hover:text-zinc-400'
                        }`}>
                        {f.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              {/* ── Section B: Financial ── */}
              <section className="space-y-3 border-t border-zinc-900 pt-4">
                <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">Rent, Fees & Payment Terms</p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">Currency</label>
                    <select value={currency} onChange={e => setCurrency(e.target.value)}
                      className="w-full bg-black border border-zinc-800 px-3 py-3 rounded-xl text-xs outline-none focus:border-teal-500 text-amber-500 font-bold">
                      {['NGN','USD','GBP','EUR','GHS','KES','AED','ZAR'].map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">Frequency</label>
                    <select value={frequency} onChange={e => setFrequency(e.target.value)}
                      className="w-full bg-black border border-zinc-800 px-3 py-3 rounded-xl text-xs outline-none focus:border-teal-500">
                      {['Monthly','Quarterly','Bi-Annual','Annual'].map(f => <option key={f}>{f}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">Rent Amount *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 text-xs font-bold">₦</span>
                    <input type="number" value={rentAmount} onChange={e => setRentAmount(e.target.value)} placeholder="e.g. 750000"
                      className="w-full bg-black border border-zinc-800 pl-7 pr-4 py-3 rounded-xl text-xs font-bold text-zinc-200 outline-none focus:border-teal-500" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">Security Deposit</label>
                    <input type="number" value={deposit} onChange={e => setDeposit(e.target.value)} placeholder="0"
                      className="w-full bg-black border border-zinc-800 px-4 py-3 rounded-xl text-xs outline-none focus:border-teal-500" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">Service Charge</label>
                    <input type="number" value={serviceCharge} onChange={e => setServiceCharge(e.target.value)} placeholder="0"
                      className="w-full bg-black border border-zinc-800 px-4 py-3 rounded-xl text-xs outline-none focus:border-teal-500" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">Agency Fee</label>
                    <input type="number" value={agencyFee} onChange={e => setAgencyFee(e.target.value)} placeholder="0"
                      className="w-full bg-black border border-zinc-800 px-4 py-3 rounded-xl text-xs outline-none focus:border-teal-500" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">Caution Fee</label>
                    <input type="number" value={cautionFee} onChange={e => setCautionFee(e.target.value)} placeholder="0"
                      className="w-full bg-black border border-zinc-800 px-4 py-3 rounded-xl text-xs outline-none focus:border-teal-500" />
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">Legal Fee</label>
                  <input type="number" value={legalFee} onChange={e => setLegalFee(e.target.value)} placeholder="0"
                    className="w-full bg-black border border-zinc-800 px-4 py-3 rounded-xl text-xs outline-none focus:border-teal-500" />
                </div>
              </section>

              {/* ── Section C: Settlement Bank — Option 1 ── */}
              <section className="space-y-3 border-t border-zinc-900 pt-4">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest flex items-center gap-1.5">
                    <Landmark size={11} className="text-teal-400" /> Settlement Bank Account
                  </p>
                  <div className="flex items-center gap-2">
                    <button onClick={loadBankAccounts} title="Refresh accounts"
                      className="text-zinc-600 hover:text-teal-400 transition-colors">
                      <RefreshCw size={11} />
                    </button>
                    <Link href="/landlord/bank" target="_blank"
                      className="text-[9px] font-black uppercase text-teal-400 hover:text-white transition-colors flex items-center gap-1">
                      Manage <ExternalLink size={9} />
                    </Link>
                  </div>
                </div>

                <p className="text-[10px] text-zinc-600 leading-relaxed">
                  Rent collected via Paystack escrow auto-transfers to this account. Only your verified,
                  Paystack-linked accounts appear here — no manual entry needed.
                </p>

                {loadingBanks ? (
                  <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center gap-2">
                    <Loader2 className="animate-spin text-teal-500" size={12} />
                    <span className="text-[10px] text-zinc-500">Loading your verified accounts…</span>
                  </div>

                ) : bankAccounts.length === 0 ? (
                  /* No accounts — prompt landlord to add one first */
                  <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-3">
                    <div className="flex items-start gap-2 text-amber-400">
                      <AlertCircle size={13} className="shrink-0 mt-0.5" />
                      <p className="text-[10px] leading-relaxed font-bold">
                        No verified bank accounts found. You must add and verify a payout account before deploying units.
                      </p>
                    </div>
                    <Link href="/landlord/bank"
                      className="w-full py-2.5 bg-amber-500 text-black text-[9px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-1.5 hover:bg-white transition-all">
                      <Plus size={11} /> Add Bank Account Now
                    </Link>
                  </div>

                ) : (
                  <div className="space-y-2">
                    <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-400">
                      Select Payout Destination *
                    </label>
                    <select value={selectedBankId} onChange={e => setSelectedBankId(e.target.value)}
                      className="w-full bg-black border border-zinc-800 px-4 py-3 rounded-xl text-sm text-zinc-200 outline-none focus:border-teal-500 transition-colors">
                      {bankAccounts.map(acct => (
                        <option key={acct.id} value={acct.id}>
                          {acct.bank_name} · {maskAcct(acct.account_number)} · {acct.account_name}
                          {acct.is_default ? ' [DEFAULT]' : ''}
                          {!acct.payout_ready ? ' ⚠ not ready' : ''}
                        </option>
                      ))}
                    </select>

                    {/* Show selected account detail */}
                    {(() => {
                      const sel = bankAccounts.find(a => a.id === selectedBankId);
                      if (!sel) return null;
                      return (
                        <div className={`p-3 rounded-xl border text-[10px] space-y-0.5 ${
                          sel.payout_ready
                            ? 'border-teal-500/20 bg-teal-500/5'
                            : 'border-amber-500/20 bg-amber-500/5'
                        }`}>
                          <p className={`font-bold ${sel.payout_ready ? 'text-teal-400' : 'text-amber-400'}`}>
                            {sel.payout_ready ? '✓ Paystack Verified · Payout Ready' : '⚠ Not payout-ready — visit Bank Accounts page to repair'}
                          </p>
                          <p className="text-zinc-500">
                            {sel.account_name} · {sel.bank_name} · {maskAcct(sel.account_number)}
                          </p>
                          {!sel.payout_ready && (
                            <Link href="/landlord/bank" target="_blank"
                              className="inline-flex items-center gap-1 text-amber-400 font-black underline mt-1">
                              Fix now <ExternalLink size={9} />
                            </Link>
                          )}
                        </div>
                      );
                    })()}

                    <div className="flex items-start gap-1.5 text-[9px] text-zinc-600">
                      <Info size={9} className="text-zinc-700 shrink-0 mt-0.5" />
                      Rent transfers automatically within 30 minutes of Paystack T+1 clearing.
                      <Link href="/landlord/bank" target="_blank" className="text-teal-600 hover:text-teal-400 font-bold shrink-0">
                        Manage accounts
                      </Link>
                    </div>
                  </div>
                )}
              </section>

              {/* ── Submit ── */}
              <button onClick={handleSubmit}
                disabled={submitting || bankAccounts.length === 0}
                className="w-full py-4 bg-teal-500 text-black font-black uppercase text-xs tracking-widest rounded-xl hover:bg-teal-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {submitting
                  ? <><Loader2 className="animate-spin" size={13} /> Adding Unit…</>
                  : <><Send size={12} /> Add Unit to Ledger</>
                }
              </button>
            </div>
          </div>
        )}

        {/* ── RECEIPTS TAB ── */}
        {activeTab === 'receipts' && (
          <div className="space-y-6">
            <div className="border-l-2 border-amber-500 pl-4">
              <p className="text-[9px] text-amber-400 uppercase font-black tracking-widest mb-0.5">Payment Ledger</p>
              <h2 className="text-xl font-black uppercase">Receipts & History</h2>
              <p className="text-zinc-500 text-xs mt-0.5">Tenant payment records for this property</p>
            </div>
            {/* Link to the full receipts page which supports per-tenancy view */}
            <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/20 text-center space-y-4">
              <FileText size={28} className="text-zinc-600 mx-auto" />
              <p className="text-zinc-400 text-sm font-bold">View payment receipts per tenant</p>
              <p className="text-zinc-600 text-xs">Select a tenant from the Tenants panel and click Receipt to view their ledger.</p>
              <Link href="/landlord/tenants"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white font-black text-[9px] uppercase tracking-widest rounded-xl transition-all">
                Go to Tenants <ArrowRight size={10} />
              </Link>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

export default function RentalManagementPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="animate-spin text-teal-500" size={32} />
      </div>
    }>
      <RentalManagementContent projectId={params.id} />
    </Suspense>
  );
}
