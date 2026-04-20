'use client';
/**
 * /landlord/notices
 * Smart redirect — 1 project → rental-management?tab=litigation
 *                  2+ projects → project picker
 *                  0 projects  → prompt to submit
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { Gavel, Building2, Loader2, Plus, ChevronRight } from 'lucide-react';

interface Project {
  id: string; project_number: string; title: string;
  location: string; country: string; status: string;
}

export default function LandlordNoticesPage() {
  const router = useRouter();
  const { isLoading: authLoading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (authLoading) return;
    api.get('/api/projects/my')
      .then(res => {
        const list: Project[] = res.data.projects ?? [];
        setProjects(list);
        if (list.length === 1) router.replace(`/projects/${list[0].id}/rental-management?tab=litigation`);
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
            <p className="text-zinc-500 text-sm mt-2">Submit your first property project to start issuing legal notices to tenants.</p>
          </div>
          <Link href="/projects/submit" className="inline-flex items-center gap-2 px-6 py-3 bg-teal-500 text-black font-black text-xs uppercase tracking-widest rounded-xl hover:bg-teal-400 transition-all">
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
        <div className="border-l-2 border-red-500 pl-5">
          <p className="text-[9px] text-red-400 uppercase font-black tracking-[0.25em] mb-1">Litigation Command</p>
          <h1 className="text-2xl font-black uppercase tracking-tight">Issue Legal Notice</h1>
          <p className="text-zinc-500 text-sm mt-1">Select the property where you want to issue a notice</p>
        </div>
        <div className="space-y-3">
          {projects.map(p => (
            <Link key={p.id} href={`/projects/${p.id}/rental-management?tab=litigation`}
              className="flex items-center justify-between p-5 rounded-2xl border border-zinc-800 bg-zinc-900/20 hover:border-red-500/30 hover:bg-red-500/5 transition-all group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0 group-hover:border-red-500/30">
                  <Gavel size={16} className="text-red-400" />
                </div>
                <div>
                  <p className="font-bold text-sm uppercase tracking-tight">{p.title}</p>
                  <p className="text-[9px] text-zinc-500 mt-0.5">{p.project_number} · {p.location}, {p.country}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className={`text-[8px] px-2 py-0.5 rounded border font-bold uppercase ${p.status === 'ACTIVE' ? 'border-teal-500/40 text-teal-500' : 'border-zinc-700 text-zinc-500'}`}>{p.status}</span>
                <ChevronRight size={16} className="text-zinc-600 group-hover:text-red-400 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
