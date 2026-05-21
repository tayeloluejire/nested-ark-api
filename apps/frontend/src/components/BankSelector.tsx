'use client';
/**
 * BankSelector.tsx
 * Drop-in replacement for the "Settlement Bank Details" section in the unit deploy form.
 *
 * Location: apps/frontend/src/components/BankSelector.tsx
 *
 * Usage in rental-management/page.tsx unit form:
 *   import BankSelector, { BankFields } from '@/components/BankSelector';
 *
 *   const [bankFields, setBankFields] = useState<BankFields>({
 *     bank_name: '', bank_code: '', account_number: '', account_name: '', sort_code: '',
 *   });
 *
 *   <BankSelector value={bankFields} onChange={setBankFields} />
 *
 *   Then spread into unit POST:
 *   api.post('/api/rental/units', { ...otherFields, ...bankFields })
 */

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { CheckCircle2, Loader2, AlertCircle, Landmark } from 'lucide-react';

export interface BankFields {
  bank_name: string;
  bank_code: string;      // Paystack's numeric bank code — sent as sort_code to backend
  account_number: string;
  account_name: string;   // auto-resolved via Paystack NUBAN API
  sort_code: string;      // same value as bank_code — backend uses this for recipient creation
}

interface BankOption { name: string; code: string; }

interface Props {
  value: BankFields;
  onChange: (fields: BankFields) => void;
  disabled?: boolean;
  required?: boolean;
}

export default function BankSelector({ value, onChange, disabled = false, required = false }: Props) {
  const [banks,     setBanks]     = useState<BankOption[]>([]);
  const [resolving, setResolving] = useState(false);
  const [resolved,  setResolved]  = useState(false);
  const [resolveErr,setResolveErr]= useState('');

  // Load Nigerian bank list from Paystack on mount
  useEffect(() => {
    api.get('/api/paystack/banks')
      .then(res => setBanks((res.data.banks ?? []).map((b: any) => ({ name: b.name, code: b.code }))))
      .catch(() => {}); // non-fatal — user can still type manually
  }, []);

  const resolveAccountName = useCallback(async (acctNum: string, bankCode: string) => {
    if (acctNum.length !== 10 || !bankCode) return;
    setResolving(true);
    setResolved(false);
    setResolveErr('');
    onChange({ ...value, account_number: acctNum, bank_code: bankCode, sort_code: bankCode, account_name: '' });
    try {
      const res = await api.post('/api/paystack/resolve-account', {
        account_number: acctNum, bank_code: bankCode,
      });
      const resolvedName = res.data.account_name ?? '';
      onChange({ ...value, account_number: acctNum, bank_code: bankCode, sort_code: bankCode, account_name: resolvedName });
      setResolved(true);
    } catch (ex: any) {
      setResolveErr(ex?.response?.data?.error ?? 'Could not verify account. Check number and bank.');
    } finally {
      setResolving(false);
    }
  }, [value, onChange]);

  const handleBankChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    const bank = banks.find(b => b.code === code);
    const next = { ...value, bank_code: code, bank_name: bank?.name ?? '', sort_code: code, account_name: '' };
    onChange(next);
    setResolved(false);
    setResolveErr('');
    if (value.account_number.length === 10 && code) {
      resolveAccountName(value.account_number, code);
    }
  };

  const handleAcctChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const num = e.target.value.replace(/\D/g, '').slice(0, 10);
    const next = { ...value, account_number: num, account_name: '' };
    onChange(next);
    setResolved(false);
    setResolveErr('');
    if (num.length === 10 && value.bank_code) {
      resolveAccountName(num, value.bank_code);
    }
  };

  const fieldClass = `w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5
    text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-teal-500/60
    transition-colors disabled:opacity-50`;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Landmark size={12} className="text-teal-500" />
        <p className="text-[9px] text-zinc-400 uppercase font-black tracking-widest">
          Settlement Bank Details
          {required && <span className="text-red-500 ml-1">*</span>}
        </p>
      </div>
      <p className="text-[10px] text-zinc-600 -mt-1">
        Rent collected via Paystack escrow will auto-transfer to this account after key-handover.
        The bank code is auto-filled when you select a bank.
      </p>

      {/* Bank dropdown — auto-fills bank_code */}
      <div>
        <label className="text-[9px] text-zinc-500 uppercase font-bold block mb-1">
          Bank Name {required && <span className="text-red-500">*</span>}
        </label>
        {banks.length > 0 ? (
          <select
            value={value.bank_code}
            onChange={handleBankChange}
            disabled={disabled}
            className={fieldClass}
          >
            <option value="">— Select bank —</option>
            {banks.map(b => (
              <option key={b.code} value={b.code}>{b.name}</option>
            ))}
          </select>
        ) : (
          /* Fallback: free-text if bank list fails to load */
          <input
            type="text"
            placeholder="e.g. Zenith Bank"
            value={value.bank_name}
            disabled={disabled}
            onChange={e => onChange({ ...value, bank_name: e.target.value })}
            className={fieldClass}
          />
        )}
      </div>

      {/* Bank code — auto-filled, read-only confirmation */}
      {value.bank_code && (
        <div className="flex items-center gap-2 text-[9px] text-teal-400 font-mono bg-teal-500/5 border border-teal-500/20 rounded-lg px-3 py-1.5">
          <CheckCircle2 size={9} />
          Bank code auto-filled: <span className="font-black">{value.bank_code}</span>
          &nbsp;· Paystack will use this to create your transfer recipient
        </div>
      )}

      {/* Account Number */}
      <div>
        <label className="text-[9px] text-zinc-500 uppercase font-bold block mb-1">
          Account Number (10 digits) {required && <span className="text-red-500">*</span>}
        </label>
        <div className="relative">
          <input
            type="text"
            inputMode="numeric"
            maxLength={10}
            placeholder="e.g. 1004038532"
            value={value.account_number}
            disabled={disabled}
            onChange={handleAcctChange}
            className={`${fieldClass} pr-9 font-mono`}
          />
          {resolving && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-teal-500" size={13} />
          )}
          {resolved && !resolving && (
            <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-400" size={13} />
          )}
        </div>
      </div>

      {/* Account Name — auto-resolved */}
      <div className={`p-3 rounded-xl border transition-all ${
        resolved ? 'border-teal-500/30 bg-teal-500/5' : 'border-zinc-800 bg-zinc-900/30'
      }`}>
        <p className="text-[8px] text-zinc-500 uppercase font-bold tracking-widest mb-0.5">
          Account Name (auto-verified via Paystack)
        </p>
        <p className={`text-sm font-bold ${resolved ? 'text-teal-400' : 'text-zinc-600'}`}>
          {resolving
            ? 'Verifying with Paystack NUBAN…'
            : value.account_name || 'Select bank and enter account number above'}
        </p>
      </div>

      {/* Resolve error */}
      {resolveErr && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-500/5 border border-red-500/20 text-red-400 text-[10px] font-bold">
          <AlertCircle size={10} className="shrink-0" /> {resolveErr}
        </div>
      )}

      {/* Ready state confirmation */}
      {resolved && value.account_name && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-teal-500/5 border border-teal-500/20 text-teal-400 text-[10px] font-bold">
          <CheckCircle2 size={10} className="shrink-0" />
          Verified: <span className="font-black">{value.account_name}</span> at {value.bank_name}
          · Payout will auto-route to this account
        </div>
      )}
    </div>
  );
}
