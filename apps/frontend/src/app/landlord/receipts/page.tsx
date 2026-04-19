'use client';
/**
 * /landlord/receipts
 *
 * Smart redirect for the Navbar "View Receipts & Ledger" link.
 *
 *  • 1 project  → redirect straight to /projects/[id]/rental-management?tab=receipts
 *  • 2+ projects → project picker
 *  • 0 projects  → prompt to submit
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { Receipt, Building2, Loader2, Plus, ChevronRight } from 'lucide-react';

interface Project {
  id: string;
  project_number: string;
  title: string;
  location: string;
  country: string;
  status: string;
}

export default function LandlordReceiptsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (authLoading) return;
    api.get('/api/projects/my')
      .then(res => {
        const list: Project[] = res.data.projects ?? [];
        setProjects(list);
        if (list.length === 1) {
          router.replace(`/projects/${list[0].id}/rental-management?tab=receipts`);
        }
      })
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, [authLoading, router]);

  if (authLoading || loading) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <Loader2 className="animate-spin text-teal-500" size={28} />
    </div>
  );

  if (projects.length === 0) return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="text-center space-y-6 max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto">
            <Building2 size={28} className="text-zinc-600" />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight">No Projects Yet</h1>
            <p className="text-zinc-500 text-sm mt-2">Submit your first property project to start seeing rent receipts and payment history.</p>
          </div>
          <Link href="/projects/submit"
            className="inline-flex items-center gap-2 px-6 py-3 bg-teal-500 text-black font-black text-xs uppercase tracking-widest rounded-xl hover:bg-teal-400 transition-all">
            <Plus size={13} /> Submit Your First Project
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-2xl mx-auto px-6 py-12 w-full space-y-8">
        <div className="border-l-2 border-amber-500 pl-5">
          <p className="text-[9px] text-amber-400 uppercase font-black tracking-[0.25em] mb-1">Payment Ledger</p>
          <h1 className="text-2xl font-black uppercase tracking-tight">Receipts & Ledger</h1>
          <p className="text-zinc-500 text-sm mt-1">Select the property whose payment history you want to view</p>
        </div>

        <div className="space-y-3">
          {projects.map(p => (
            <Link
              key={p.id}
              href={`/projects/${p.id}/rental-management?tab=receipts`}
              className="flex items-center justify-between p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 hover:border-amber-500/30 hover:bg-amber-500/5 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0 group-hover:border-amber-500/30">
                  <Receipt size={16} className="text-amber-400" />
                </div>
                <div>
                  <p className="font-bold text-sm uppercase tracking-tight">{p.title}</p>
                  <p className="text-[9px] text-zinc-500 mt-0.5">{p.project_number} · {p.location}, {p.country}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className={`text-[8px] px-2 py-0.5 rounded border font-bold uppercase ${
                  p.status === 'ACTIVE' ? 'border-teal-500/40 text-teal-500' : 'border-zinc-700 text-zinc-500'
                }`}>{p.status}</span>
                <ChevronRight size={16} className="text-zinc-600 group-hover:text-amber-400 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
