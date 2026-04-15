'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import { Camera, Link2, CheckCircle2, Loader2, AlertCircle, Eye, MapPin, Clock } from 'lucide-react';

interface MilestoneRow {
  id: string;
  title: string;
  project_title?: string;
  status: string;
  drone_status: string;
  drone_url?: string;
  drone_synced_at?: string;
  ai_status: string;
  human_status: string;
  evidence_url?: string;
  evidence_submitted_at?: string;
}

export default function AdminDroneUploadPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [selected,   setSelected]   = useState<string | null>(null);
  const [droneUrl,   setDroneUrl]   = useState('');
  const [geoLat,     setGeoLat]     = useState('');
  const [geoLng,     setGeoLng]     = useState('');
  const [operator,   setOperator]   = useState('');
  const [progressPct,setProgressPct]= useState('');
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState<string | null>(null);
  const [error,      setError]      = useState('');

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ADMIN')) router.replace('/login');
  }, [user, authLoading, router]);

  const loadMilestones = async () => {
    setLoading(true);
    try {
      // Get all milestones with verification status
      const res = await api.get('/api/admin/approval');
      const allM = res.data.milestones ?? [];
      setMilestones(allM);
    } catch { setError('Failed to load milestones'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (user?.role === 'ADMIN') loadMilestones(); }, [user]);

  const submit = async (milestoneId: string) => {
    if (!droneUrl.trim()) { setError('Drone footage / photo URL is required'); return; }
    setSaving(true); setError(''); setSaved(null);
    try {
      await api.post(`/api/milestones/${milestoneId}/verify/drone`, {
        drone_url:     droneUrl.trim(),
        geo_latitude:  geoLat  ? parseFloat(geoLat)  : undefined,
        geo_longitude: geoLng  ? parseFloat(geoLng)  : undefined,
        drone_operator: operator || 'Admin Manual Upload',
        progress_pct:  progressPct ? parseFloat(progressPct) : undefined,
        api_key: process.env.NEXT_PUBLIC_DRONE_API_KEY || 'nested-ark-drone-2024',
      });
      setSaved(milestoneId);
      setDroneUrl(''); setGeoLat(''); setGeoLng(''); setOperator(''); setProgressPct('');
      setSelected(null);
      loadMilestones();
    } catch (ex: any) {
      setError(ex?.response?.data?.error ?? 'Upload failed');
    } finally { setSaving(false); }
  };

  if (authLoading || !user) return (
    <div className="h-screen bg-[#050505] flex items-center justify-center">
      <Loader2 className="animate-spin text-teal-500" size={32} />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-10 space-y-8">

      <header className="border-l-2 border-blue-500 pl-6">
        <p className="text-[9px] text-blue-400 uppercase font-bold tracking-[0.2em] mb-1">Admin · Verification Tools</p>
        <h1 className="text-3xl font-black tracking-tighter uppercase italic">Drone &amp; Evidence Upload</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Attach drone footage, site photos or video links to milestones. This triggers the drone verification
          layer and chains the evidence to the immutable ledger.
        </p>
      </header>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 text-red-400 text-xs font-bold flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Info box */}
      <div className="p-5 rounded-2xl border border-blue-500/20 bg-blue-500/5 text-xs text-blue-300 space-y-1">
        <p className="font-bold text-[10px] uppercase tracking-widest text-blue-400">How to use</p>
        <p>1. Paste a public image URL (Google Drive, Dropbox, Cloudinary, or direct .jpg/.mp4 link)</p>
        <p>2. Optionally add GPS coordinates and progress percentage</p>
        <p>3. Click "Submit Drone Verification" — the evidence is hashed and ledgered automatically</p>
        <p className="text-blue-500 text-[9px] mt-2">Investors can see this footage inside their portfolio positions.</p>
      </div>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="animate-spin text-teal-500 mx-auto" size={28} /></div>
      ) : (
        <div className="space-y-4">
          {milestones.length === 0 && (
            <div className="p-8 rounded-2xl border border-dashed border-zinc-800 text-center text-zinc-600 text-sm">
              No milestones found in the approval queue.
            </div>
          )}

          {milestones.map(m => (
            <div key={m.id}
              className={`rounded-2xl border transition-all ${
                selected === m.id ? 'border-blue-500/40 bg-blue-500/5' : 'border-zinc-800 bg-zinc-900/20'
              }`}>
              {/* Milestone header row */}
              <div
                className="flex items-start justify-between gap-4 p-5 cursor-pointer"
                onClick={() => setSelected(selected === m.id ? null : m.id)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold uppercase truncate">{m.title}</p>
                  {m.project_title && (
                    <p className="text-[9px] text-zinc-500 mt-0.5">{m.project_title}</p>
                  )}
                  {/* Verification status badges */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[
                      { label: 'AI',    status: m.ai_status    },
                      { label: 'Human', status: m.human_status },
                      { label: 'Drone', status: m.drone_status },
                    ].map(v => (
                      <span key={v.label}
                        className={`text-[7px] px-2 py-0.5 rounded border font-black uppercase ${
                          v.status === 'VERIFIED'
                            ? 'border-teal-500/40 text-teal-500 bg-teal-500/10'
                            : 'border-zinc-700 text-zinc-500'
                        }`}>
                        {v.label}: {v.status}
                      </span>
                    ))}
                    {m.drone_url && (
                      <a href={m.drone_url} target="_blank" rel="noopener noreferrer"
                        className="text-[7px] px-2 py-0.5 rounded border border-blue-500/40 text-blue-400 hover:text-white transition-colors flex items-center gap-1">
                        <Eye size={7} /> View Footage
                      </a>
                    )}
                  </div>
                  {m.drone_synced_at && (
                    <p className="text-[8px] text-zinc-700 font-mono mt-1 flex items-center gap-1">
                      <Clock size={7} /> Last drone sync: {new Date(m.drone_synced_at).toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {saved === m.id && (
                    <span className="flex items-center gap-1 text-[9px] text-teal-500 font-bold">
                      <CheckCircle2 size={12} /> Uploaded
                    </span>
                  )}
                  <span className={`text-[8px] font-bold uppercase ${selected === m.id ? 'text-blue-400' : 'text-zinc-600'}`}>
                    {selected === m.id ? '▲ Close' : '▼ Upload'}
                  </span>
                </div>
              </div>

              {/* Upload form — visible when selected */}
              {selected === m.id && (
                <div className="border-t border-zinc-800 p-5 space-y-4">
                  <div>
                    <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest block mb-2">
                      <Camera size={9} className="inline mr-1" /> Drone Footage / Photo URL *
                    </label>
                    <input
                      type="url"
                      value={droneUrl}
                      onChange={e => setDroneUrl(e.target.value)}
                      placeholder="https://drive.google.com/... or https://cloudinary.com/..."
                      className="w-full bg-black border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-blue-500 transition-colors font-mono"
                    />
                    <p className="text-[8px] text-zinc-600 mt-1">
                      Accepts any public URL — image (.jpg, .png) or video (.mp4, YouTube, Drive). Must be publicly accessible.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest block mb-2">
                        <MapPin size={9} className="inline mr-1" /> Latitude
                      </label>
                      <input type="number" step="any" value={geoLat} onChange={e => setGeoLat(e.target.value)}
                        placeholder="e.g. 6.5244" className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-blue-500 font-mono" />
                    </div>
                    <div>
                      <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest block mb-2">Longitude</label>
                      <input type="number" step="any" value={geoLng} onChange={e => setGeoLng(e.target.value)}
                        placeholder="e.g. 3.3792" className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-blue-500 font-mono" />
                    </div>
                    <div>
                      <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest block mb-2">Operator / Source</label>
                      <input type="text" value={operator} onChange={e => setOperator(e.target.value)}
                        placeholder="Drone operator name" className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="text-[9px] text-zinc-400 uppercase font-bold tracking-widest block mb-2">Progress % (0-100)</label>
                      <input type="number" min="0" max="100" value={progressPct} onChange={e => setProgressPct(e.target.value)}
                        placeholder="e.g. 65" className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-blue-500 font-mono" />
                    </div>
                  </div>

                  <button
                    onClick={() => submit(m.id)}
                    disabled={saving || !droneUrl.trim()}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-white hover:text-black transition-all disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="animate-spin" size={13} /> : <Camera size={13} />}
                    Submit Drone Verification
                  </button>
                  <p className="text-[8px] text-zinc-700 font-mono">
                    This will set drone_status = VERIFIED, hash the evidence URL, and write to the immutable system ledger.
                    Investors will be able to view this footage from their portfolio positions.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
