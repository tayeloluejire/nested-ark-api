'use client';
import { useState } from 'react';
import { Edit3, Eye, ShieldCheck, MapPin, Layers, Save } from 'lucide-react';

export default function UnitEditorWithPreview() {
  // Shared structural component state binding editor to presentation container
  const [unitName, setUnitName] = useState('SUITE 4A — TWIN BUNGALOW LUXURY');
  const [baseRent, setBaseRent] = useState('2500000');
  const [location, setLocation] = useState('Lekki Phase 1, Lagos, Nigeria');
  const [bedrooms, setBedrooms] = useState('2');
  const [bathrooms, setBathrooms] = useState('2');
  const [description, setDescription] = useState('Premium dual-wing architectural design layout featuring integrated smart metering, a dedicated solar power backup matrix, and secure escrow settlement options.');
  const [imgUrl, setImgUrl] = useState('https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=400&q=80');

  return (
    <div className="min-h-screen bg-[#050505] p-8 text-zinc-200 font-mono text-[11px]">
      
      {/* Header Panel */}
      <div className="border-b border-zinc-900 pb-4 mb-8">
        <h1 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
          <Layers size={16} className="text-teal-400" /> Architectural Unit Editor Matrix
        </h1>
        <p className="text-[9px] text-zinc-500 uppercase tracking-widest mt-0.5">
          Real-time dual pane synchronization control between database entry attributes and public layout designs
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        
        {/* Pane A: Modification Panel Form */}
        <div className="bg-[#0a0a0a] border border-zinc-900 rounded-2xl p-6 space-y-4 shadow-xl">
          <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest flex items-center gap-1 border-b border-zinc-950 pb-2 mb-2">
            <Edit3 size={10} className="text-teal-400"/> Mutation Controls
          </span>

          <div>
            <label className="block text-zinc-500 uppercase font-bold tracking-wider mb-1">Unit Display Label</label>
            <input type="text" value={unitName} onChange={(e) => setUnitName(e.target.value.toUpperCase())} className="w-full bg-[#050505] border border-zinc-800 rounded-xl px-3 py-2 text-white text-[11px]" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-500 uppercase font-bold tracking-wider mb-1">Annual Base Rent (₦)</label>
              <input type="number" value={baseRent} onChange={(e) => setBaseRent(e.target.value)} className="w-full bg-[#050505] border border-zinc-800 rounded-xl px-3 py-2 text-white text-[11px]" />
            </div>
            <div>
              <label className="block text-zinc-500 uppercase font-bold tracking-wider mb-1">Geographic Location Map</label>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="w-full bg-[#050505] border border-zinc-800 rounded-xl px-3 py-2 text-white text-[11px]" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-500 uppercase font-bold tracking-wider mb-1">Bedrooms</label>
              <input type="number" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} className="w-full bg-[#050505] border border-zinc-800 rounded-xl px-3 py-2 text-white text-[11px]" />
            </div>
            <div>
              <label className="block text-zinc-500 uppercase font-bold tracking-wider mb-1">Bathrooms</label>
              <input type="number" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} className="w-full bg-[#050505] border border-zinc-800 rounded-xl px-3 py-2 text-white text-[11px]" />
            </div>
          </div>

          <div>
            <label className="block text-zinc-500 uppercase font-bold tracking-wider mb-1">Portfolio Preview Render Link (Image URL)</label>
            <input type="text" value={imgUrl} onChange={(e) => setImgUrl(e.target.value)} className="w-full bg-[#050505] border border-zinc-800 rounded-xl px-3 py-2 text-zinc-400 text-[10px]" />
          </div>

          <div>
            <label className="block text-zinc-500 uppercase font-bold tracking-wider mb-1">Marketing Description</label>
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full bg-[#050505] border border-zinc-800 rounded-xl px-3 py-2 text-white text-[11px] font-sans resize-none leading-relaxed" />
          </div>

          <button className="w-full mt-2 bg-teal-500 hover:bg-teal-400 text-black font-black uppercase tracking-wider py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 text-[10px]">
            <Save size={12} /> Commit Structural Specifications to Database
          </button>
        </div>

        {/* Pane B: Real-Time Marketplace Live Layout Engine Card View */}
        <div className="space-y-4">
          <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest flex items-center gap-1 border-b border-zinc-900 pb-2 mb-2">
            <Eye size={10} className="text-teal-400"/> Real-time Marketplace Visual Card Layout Engine
          </span>

          <div className="max-w-md mx-auto bg-[#0a0a0a] border border-zinc-900 rounded-2xl overflow-hidden shadow-2xl group transition-all duration-300 hover:border-zinc-800">
            {/* Visual Frame */}
            <div className="relative aspect-video w-full bg-zinc-900 border-b border-zinc-950 overflow-hidden">
              {imgUrl ? (
                <img src={imgUrl} alt="Preview Render" className="object-cover w-full h-full" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-700 font-mono text-[9px]">NO RENDER MEDIA RECOGNIZED</div>
              )}
              <span className="absolute top-3 right-3 bg-teal-500/10 border border-teal-500/30 text-teal-400 text-[8px] px-2.5 py-1 rounded-md font-black uppercase tracking-wider flex items-center gap-1 backdrop-blur-sm">
                <ShieldCheck size={10}/> Ark Verified
              </span>
            </div>

            {/* Typography Frame */}
            <div className="p-5">
              <h3 className="text-sm font-black tracking-tight text-white uppercase truncate">{unitName || 'UNTITLED CRITERIA BLANK'}</h3>
              <p className="text-[9px] text-zinc-500 font-mono mt-1 flex items-center gap-1 uppercase">
                <MapPin size={10} className="text-zinc-600"/> {location || 'No geographic mapping applied'}
              </p>
              
              <div className="flex gap-4 mt-3 font-mono text-[9px] text-zinc-400 border-y border-zinc-950 py-2 my-3">
                <span>BEDROOMS: <b className="text-white">{bedrooms}</b></span>
                <span>BATHROOMS: <b className="text-white">{bathrooms}</b></span>
                <span>STATUS: <b className="text-teal-400">VACANT</b></span>
              </div>

              <p className="text-[11px] text-zinc-400 line-clamp-3 leading-relaxed font-sans mt-2">
                {description || 'No marketing property portfolio description applied to this record file block.'}
              </p>
            </div>

            {/* Financial Action Box */}
            <div className="p-5 pt-0 border-t border-zinc-950 mt-2 flex items-center justify-between">
              <div>
                <span className="text-[8px] text-zinc-500 block font-mono uppercase tracking-wider">ANNUAL BILLING</span>
                <span className="text-sm font-mono font-black text-teal-400">₦{Number(baseRent || 0).toLocaleString()}</span>
              </div>
              <button className="px-4 py-2 bg-white text-black text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-not-allowed opacity-80 shadow-md">
                Apply Placement
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}