'use client';
import { useState } from 'react';
import { CURRENCIES } from '@/hooks/useCurrency';
import { ChevronDown } from 'lucide-react';

interface Props {
  currency: string;
  onSelect: (code: string) => void;
  compact?: boolean;
}

export default function CurrencySelector({ currency, onSelect, compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const info = CURRENCIES[currency];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/50 text-white text-xs font-bold uppercase tracking-widest hover:border-teal-500/50 transition-all"
      >
        <span>{info?.flag}</span>
        {!compact && <span>{currency}</span>}
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl z-50">
          <div className="py-1 max-h-72 overflow-y-auto">
            {Object.entries(CURRENCIES).map(([code, info]) => (
              <button
                key={code}
                onClick={() => { onSelect(code); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-800 transition-colors ${code === currency ? 'bg-teal-500/10 text-teal-500' : 'text-zinc-300'}`}
              >
                <span className="text-base">{info.flag}</span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest">{code}</p>
                  <p className="text-[9px] text-zinc-500">{info.name}</p>
                </div>
                <span className="ml-auto text-xs text-zinc-500 font-mono">{info.symbol}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
