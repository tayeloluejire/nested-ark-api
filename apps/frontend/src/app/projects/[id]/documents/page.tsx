'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import api from '@/lib/api';
import {
  FileText, Download, ShieldCheck, Loader2, AlertCircle,
  ArrowLeft, Lock, CheckCircle2, Eye
} from 'lucide-react';

interface Doc {
  id: string;
  title: string;
  doc_type: string;
  file_url: string;
  is_public: boolean;
  requires_kyc: boolean;
  created_at: string;
}

const DOC_ICONS: Record<string, string> = {
  BLUEPRINT: '📐', RENDER_3D: '🏗️', PERMIT: '📋', ASSESSMENT: '📊',
  CONTRACT: '📄', CERTIFICATE: '🏆', PHOTO: '📷', OTHER: '📎',
};

export default function ProjectDocumentsPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();

  const [docs,       setDocs]       = useState<Doc[]>([]);
  const [project,    setProject]    = useState<any>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');

  const load = async () => {
    if (!id) return;
    setLoading(true); setError('');
    try {
      const [pRes, dRes] = await Promise.allSettled([
        api.get(`/api/projects/${id}`),
        api.get(`/api/projects/${id}/documents`),
      ]);

      if (pRes.status === 'fulfilled') {
        setProject(pRes.value.data.project ?? pRes.value.data);
      }

      if (dRes.status === 'fulfilled') {
        // API returns { success: true, documents: [...] }
        const data = dRes.value.data;
        setDocs(data.documents ?? data ?? []);
      } else {
        const err = (dRes as any).reason;
        setError(err?.response?.data?.error ?? err?.message ?? 'Could not load documents.');
      }
    } catch (ex: any) {
      setError('Could not load documents. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]); // eslint-disable-line

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar />
      <div className="flex items-center justify-center py-40">
        <div className="text-center space-y-4">
          <Loader2 className="animate-spin text-teal-500 mx-auto" size={32} />
          <p className="text-zinc-500 text-sm uppercase font-bold tracking-widest">Loading documents…</p>
        </div>
      </div>
      <Footer />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar />

      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Back */}
        <button onClick={() => router.back()}
          className="flex items-center gap-2 text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors mb-8">
          <ArrowLeft size={13} /> Back to Project
        </button>

        {/* Header */}
        <div className="border-l-2 border-teal-500 pl-5 mb-10">
          <h1 className="text-3xl font-black uppercase tracking-tighter">Technical Archive</h1>
          {project && (
            <p className="text-zinc-500 text-sm mt-1">
              {project.project_number} · {project.title}
            </p>
          )}
          <p className="text-zinc-600 text-xs mt-1 font-mono">
            All verified plans, permits, and audits
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="p-5 rounded-2xl border border-red-500/20 bg-red-500/5 flex items-start gap-3 mb-8">
            <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 text-sm font-bold">{error}</p>
              <button onClick={load}
                className="text-teal-500 text-xs font-bold uppercase tracking-widest mt-2 hover:text-white transition-colors">
                Retry →
              </button>
            </div>
          </div>
        )}

        {/* Documents from API */}
        {!error && docs.length > 0 && (
          <div className="space-y-6 mb-10">
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">
              {docs.length} document{docs.length !== 1 ? 's' : ''} on file
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {docs.map((doc) => (
                <div key={doc.id}
                  className="p-6 bg-zinc-900/30 border border-zinc-800 rounded-2xl flex items-center justify-between hover:border-zinc-700 transition-all group">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="p-3 bg-teal-500/10 rounded-xl flex-shrink-0">
                      <span className="text-xl">{DOC_ICONS[doc.doc_type] ?? '📎'}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{doc.title}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <p className="text-[8px] text-zinc-500 uppercase font-mono">{doc.doc_type?.replace('_', ' ')}</p>
                        {doc.is_public
                          ? <span className="flex items-center gap-0.5 text-[8px] text-teal-500 font-bold"><Eye size={8} /> Public</span>
                          : <span className="flex items-center gap-0.5 text-[8px] text-amber-400 font-bold"><Lock size={8} /> KYC Required</span>
                        }
                        <span className="flex items-center gap-0.5 text-[8px] text-zinc-600">
                          <ShieldCheck size={8} className="text-teal-500/50" /> Ledger Verified
                        </span>
                      </div>
                    </div>
                  </div>
                  {doc.file_url && doc.is_public ? (
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                      className="p-3 hover:bg-zinc-800 rounded-full transition-all flex-shrink-0 group-hover:text-teal-500">
                      <Download size={16} />
                    </a>
                  ) : (
                    <Lock size={16} className="text-zinc-700 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Template placeholders (shown when no real docs OR alongside real ones) */}
        <div className="space-y-4">
          {docs.length === 0 && !error && (
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">
              Document templates — awaiting upload from project owner
            </p>
          )}

          {docs.length > 0 && (
            <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">
              Standard document checklist
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: 'Environmental Impact Assessment', ext: 'PDF', ready: false },
              { label: 'Government Approval Letter',      ext: 'PDF', ready: false },
              { label: 'Financial Model & Projections',   ext: 'XLSX', ready: false },
              { label: 'Engineering Feasibility Report',  ext: 'PDF', ready: false },
              { label: 'Site Survey & Geotechnical Report', ext: 'PDF', ready: false },
              { label: 'Contractor Qualification Pack',   ext: 'PDF', ready: false },
            ].map((doc, i) => (
              <div key={i}
                className="p-5 rounded-2xl border border-zinc-800/50 bg-zinc-900/10 flex items-center gap-4 opacity-50">
                <div className="h-10 w-10 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0">
                  <FileText size={16} className="text-zinc-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate text-zinc-400">{doc.label}</p>
                  <p className="text-[8px] text-zinc-600 uppercase font-mono mt-0.5">{doc.ext} · Pending Upload</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* KYC notice */}
        <div className="mt-8 p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 flex items-start gap-3">
          <AlertCircle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-400 text-xs font-bold">Full document access requires KYC verification</p>
            <p className="text-zinc-500 text-xs leading-relaxed mt-1">
              Complete your KYC to access restricted project documents, permits and financial models.{' '}
              <Link href="/kyc" className="text-teal-500 hover:text-white transition-colors font-bold">
                Complete KYC →
              </Link>
            </p>
          </div>
        </div>

        {/* Platform trust */}
        <div className="mt-6 flex flex-wrap gap-3">
          {[
            <><ShieldCheck size={10} /> Tri-Layer Verification</>,
            <><CheckCircle2 size={10} /> Immutable Ledger</>,
            <><Lock size={10} /> KYC-Gated Access</>,
          ].map((badge, i) => (
            <span key={i}
              className="flex items-center gap-1 text-[9px] text-teal-500 border border-teal-500/30 bg-teal-500/5 px-3 py-1.5 rounded-lg font-bold uppercase tracking-widest">
              {badge}
            </span>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
