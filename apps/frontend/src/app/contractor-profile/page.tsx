'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import Navbar from '@/components/Navbar';
import { useContractorProfile } from '@/hooks/useLiveSystem';
import api from '@/lib/api';
import { Briefcase, Star, Activity, Loader2, CheckCircle2 } from 'lucide-react';

const SPECS = ['Civil Engineering','Road Construction','Bridge Construction','Water Infrastructure','Energy Systems','Housing','Telecommunications','Healthcare Facilities','Education Infrastructure','Agricultural Systems'];

export default function ContractorProfilePage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { profile, hasProfile, isLoading: profileLoading, mutate } = useContractorProfile();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ company_name: '', bio: '', specialization: 'Civil Engineering', years_experience: '5', hourly_rate: '50' });

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
    if (!authLoading && user && user.role !== 'CONTRACTOR' && user.role !== 'ADMIN') router.replace('/dashboard');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (profile) setForm({ company_name: profile.company_name || '', bio: profile.bio || '', specialization: profile.specialization || 'Civil Engineering', years_experience: String(profile.years_experience || 5), hourly_rate: String(profile.hourly_rate || 50) });
    if (!hasProfile && !profileLoading) setEditing(true);
  }, [profile, hasProfile, profileLoading]);

  if (authLoading || profileLoading) return <div className="h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="animate-spin text-teal-500" size={32} /></div>;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (hasProfile) {
        await api.put('/api/contractors/profile', { ...form, years_experience: parseInt(form.years_experience), hourly_rate: parseFloat(form.hourly_rate) });
      } else {
        await api.post('/api/contractors/profile', { ...form, years_experience: parseInt(form.years_experience), hourly_rate: parseFloat(form.hourly_rate) });
      }
      await mutate();
      setEditing(false);
      alert(hasProfile ? 'Profile updated.' : 'Profile created! You can now submit bids on projects.');
    } catch (err: any) { alert(err?.response?.data?.error ?? 'Save failed.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navbar />
      <main className="max-w-3xl mx-auto px-6 py-12">
        <header className="mb-10 border-l-2 border-amber-500 pl-6">
          <p className="text-[10px] text-amber-500 uppercase font-bold tracking-[0.2em] mb-2">Contractor Terminal</p>
          <h1 className="text-3xl font-black tracking-tighter uppercase italic">My Profile</h1>
          <p className="text-zinc-500 text-sm mt-1">Your contractor profile is required to submit bids on projects.</p>
        </header>

        {!hasProfile && !editing && (
          <div className="mb-8 p-6 rounded-2xl border border-amber-500/30 bg-amber-500/5">
            <p className="text-amber-400 text-sm font-bold mb-2">⚠ Profile Required</p>
            <p className="text-zinc-400 text-xs mb-4">Create your contractor profile before you can submit bids.</p>
            <button onClick={() => setEditing(true)} className="px-6 py-3 bg-amber-500 text-black font-bold uppercase text-xs tracking-widest rounded-xl hover:bg-amber-400 transition-all">Create Profile Now</button>
          </div>
        )}

        {hasProfile && !editing && profile && (
          <div className="space-y-6">
            <div className="p-8 rounded-3xl border border-zinc-800 bg-zinc-900/30">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold">{profile.company_name}</h2>
                  <p className="text-teal-500 text-sm mt-1">{profile.specialization}</p>
                </div>
                <button onClick={() => setEditing(true)} className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white text-xs uppercase font-bold tracking-widest transition-all">Edit</button>
              </div>
              <p className="text-zinc-400 text-sm mb-6">{profile.bio || 'No bio provided.'}</p>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="p-4 rounded-xl bg-zinc-800/50 text-center">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-1">Experience</p>
                  <p className="text-xl font-bold">{profile.years_experience} yrs</p>
                </div>
                <div className="p-4 rounded-xl bg-zinc-800/50 text-center">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-1">Hourly Rate</p>
                  <p className="text-xl font-bold">${profile.hourly_rate}/hr</p>
                </div>
                <div className="p-4 rounded-xl bg-zinc-800/50 text-center">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mb-1">Rating</p>
                  <div className="flex items-center justify-center gap-1">
                    <Star size={14} className="text-amber-400" />
                    <p className="text-xl font-bold">{Number(profile.rating || 0).toFixed(1)}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs">
                {profile.verified ? <span className="flex items-center gap-1 text-teal-500 font-bold"><CheckCircle2 size={12} /> Verified Contractor</span> : <span className="flex items-center gap-1 text-zinc-500 font-bold"><Briefcase size={12} /> Pending Verification</span>}
                {profile.completed_projects > 0 && <span className="text-zinc-500 font-bold">· {profile.completed_projects} projects completed</span>}
              </div>
            </div>
            <button onClick={() => router.push('/projects')} className="w-full py-4 rounded-xl bg-white text-black font-bold uppercase text-xs tracking-widest hover:bg-teal-500 transition-all flex items-center justify-center gap-2">
              <Activity size={14} /> Browse Projects & Submit Bids
            </button>
          </div>
        )}

        {editing && (
          <form onSubmit={handleSave} className="space-y-6 p-8 rounded-3xl border border-zinc-800 bg-zinc-900/30">
            <h2 className="text-xl font-bold uppercase tracking-tight">{hasProfile ? 'Update Profile' : 'Create Your Profile'}</h2>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-2">Company / Firm Name *</label>
                <input required value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} placeholder="e.g. Apex Construction Ltd" className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-teal-500 transition-colors" />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-2">Specialization *</label>
                <select value={form.specialization} onChange={e => setForm({ ...form, specialization: e.target.value })} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-teal-500 transition-colors">
                  {SPECS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-2">Bio / Company Description</label>
                <textarea rows={3} value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} placeholder="Describe your experience, past projects, and capabilities..." className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-teal-500 transition-colors resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-2">Years Experience</label>
                  <input type="number" min="0" value={form.years_experience} onChange={e => setForm({ ...form, years_experience: e.target.value })} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-teal-500 transition-colors" />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-2">Hourly Rate (USD)</label>
                  <input type="number" min="0" value={form.hourly_rate} onChange={e => setForm({ ...form, hourly_rate: e.target.value })} className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-teal-500 transition-colors" />
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="flex-1 py-4 bg-teal-500 text-black font-bold uppercase text-xs tracking-widest rounded-xl hover:bg-teal-400 transition-all disabled:opacity-50 flex items-center justify-center">
                {saving ? <Loader2 className="animate-spin" size={16} /> : hasProfile ? 'Update Profile' : 'Create Profile'}
              </button>
              {hasProfile && <button type="button" onClick={() => setEditing(false)} className="px-6 py-4 border border-zinc-700 text-zinc-400 font-bold uppercase text-xs tracking-widest rounded-xl hover:text-white transition-all">Cancel</button>}
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
