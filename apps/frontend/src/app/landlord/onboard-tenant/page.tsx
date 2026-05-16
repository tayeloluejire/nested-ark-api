'use client';
import { useState } from 'react';
import axios from 'axios';
import { UserPlus, Link, Copy, CheckCircle, Loader2, Mail } from 'lucide-react';

export default function OnboardLegacyTenant() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [leaseStart, setLeaseStart] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setGeneratedLink('');
    setCopied(false);

    try {
      const token = localStorage.getItem('token');
      // Request a secure temporary enrollment signature from the API
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/landlord/tenants/generate-invite`,
        { fullName, email, unitId: selectedUnitId, leaseStart },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.inviteToken) {
        // Build link adhering to your newly stabilized next.config.js path schema
        const inviteUrl = `${window.location.origin}/tenant/register/?invite=${res.data.inviteToken}`;
        setGeneratedLink(inviteUrl);
      }
    } catch (err: any) {
      console.error("Failed to compile invitation link:", err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="min-h-screen bg-[#050505] p-8 text-zinc-200 font-mono text-[11px]">
      <div className="max-w-xl mx-auto bg-[#0a0a0a] border border-zinc-900 rounded-2xl p-8 shadow-2xl">
        
        {/* Title */}
        <div className="border-b border-zinc-900 pb-4 mb-6">
          <h2 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
            <UserPlus size={16} className="text-teal-400" /> Onboard Legacy Tenant Profile
          </h2>
          <p className="text-[9px] text-zinc-500 uppercase tracking-widest mt-1">
            Pre-allocate historical records and issue secure cryptographically tied onboarding links
          </p>
        </div>

        <form onSubmit={handleGenerateInvite} className="space-y-4">
          <div>
            <label className="block text-zinc-500 font-bold uppercase tracking-wider mb-1.5">Tenant Full Name</label>
            <input 
              type="text" 
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="E.G. CHIDI NWACHUKWU"
              className="w-full bg-[#050505] border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-200 focus:outline-none focus:border-teal-500/40 uppercase"
            />
          </div>

          <div>
            <label className="block text-zinc-500 font-bold uppercase tracking-wider mb-1.5">Email Address</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="TENANT@DOMAIN.COM"
              className="w-full bg-[#050505] border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-200 focus:outline-none focus:border-teal-500/40"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-500 font-bold uppercase tracking-wider mb-1.5">Target Unit Identification ID</label>
              <input 
                type="text" 
                required
                value={selectedUnitId}
                onChange={(e) => setSelectedUnitId(e.target.value)}
                placeholder="E.G. UNIT-4A"
                className="w-full bg-[#050505] border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-200 focus:outline-none focus:border-teal-500/40 uppercase"
              />
            </div>
            <div>
              <label className="block text-zinc-500 font-bold uppercase tracking-wider mb-1.5">Lease Cycle Start Date</label>
              <input 
                type="date" 
                required
                value={leaseStart}
                onChange={(e) => setLeaseStart(e.target.value)}
                className="w-full bg-[#050505] border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-200 focus:outline-none focus:border-teal-500/40"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full mt-4 bg-white hover:bg-zinc-200 text-black font-black uppercase tracking-wider py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-[10px]"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Link size={12} />} Generate Secure Portal Access Key
          </button>
        </form>

        {/* Generated Access Result Block */}
        {generatedLink && (
          <div className="mt-8 p-4 bg-teal-950/10 border border-teal-500/20 rounded-xl space-y-2 animate-fade-in">
            <span className="text-[9px] text-teal-400 font-black uppercase tracking-widest flex items-center gap-1">
              <CheckCircle size={10} /> LINK GENERATED SUCCESSFULLY
            </span>
            <p className="text-[10px] text-zinc-400 font-sans leading-relaxed">
              Send this single-use link to the tenant. It auto-fills their credentials and bypasses manual setup:
            </p>
            <div className="flex gap-2 items-center mt-2">
              <input 
                type="text" 
                readOnly 
                value={generatedLink}
                className="w-full bg-zinc-950 border border-zinc-900 text-zinc-300 font-mono text-[10px] p-2 rounded-lg focus:outline-none"
              />
              <button 
                onClick={copyToClipboard}
                className="p-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-lg text-white transition-all shrink-0"
                title="Copy Link"
              >
                {copied ? <span className="text-teal-400 text-[9px] px-1 font-bold">COPIED</span> : <Copy size={12} />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}