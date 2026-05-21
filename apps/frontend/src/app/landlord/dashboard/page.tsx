'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function LandlordDashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Gracefully route the user to their active project workspace ledger
    router.replace('/projects/my');
  }, [router]);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-3">
      <Loader2 className="animate-spin text-teal-500" size={32} />
      <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">
        Loading Project Workspace…
      </p>
    </div>
  );
}