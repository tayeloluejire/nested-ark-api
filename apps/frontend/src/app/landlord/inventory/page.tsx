'use client';
import { useState } from 'react';
import axios from 'axios';
import { Plus, Trash2, Edit3, Megaphone, Loader2 } from 'lucide-react';

export default function LandlordInventoryControl() {
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleAdvertisePromotion = async (unitId: string) => {
    setProcessingId(unitId);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/landlord/marketplace/advertise-intent`,
        { unit_id: unitId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.authorization_url) {
        window.location.href = res.data.authorization_url; // Forward landlord straight onto Paystack
      }
    } catch (err) {
      console.error("Ad transaction placement failed", err);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="p-8 bg-[#050505] min-h-screen text-zinc-200 font-mono text-[11px]">
      <div className="flex justify-between items-center border-b border-zinc-900 pb-4 mb-6">
        <div>
          <h2 className="text-base font-black text-white uppercase tracking-tight">Infrastructure Inventory Matrix</h2>
          <p className="text-[9px] text-zinc-500 uppercase tracking-widest mt-0.5">Surgically mutate, onboard tenants, or market vacant rental property positions</p>
        </div>
        <button className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white font-black uppercase px-4 py-2 rounded-xl text-[10px] tracking-wider transition-all">
          <Plus size={12} /> Onboard Legacy Unit
        </button>
      </div>

      <div className="bg-[#090909] border border-zinc-900 rounded-xl overflow-hidden">
        <div className="grid grid-cols-5 p-4 border-b border-zinc-950 text-zinc-500 font-bold uppercase tracking-wider">
          <div>UNIT LOG SPECIFICATION</div>
          <div>ANNUAL CRITERIA</div>
          <div>LEASING STATUS</div>
          <div>MARKET ADVERTISEMENT</div>
          <div className="text-right">OPERATION CONTROL</div>
        </div>

        {/* Dynamic Mapping Row Example */}
        <div className="grid grid-cols-5 p-4 items-center border-b border-zinc-900 hover:bg-zinc-900/30 transition-all">
          <div className="font-sans font-black text-white uppercase text-[12px]">Suite 4A — Twin Bungalow</div>
          <div className="font-mono text-zinc-300">₦2,500,000</div>
          <div>
            <span className="bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider">Vacant</span>
          </div>
          <div>
            <button 
              onClick={() => handleAdvertisePromotion("sample-uid-101")}
              disabled={processingId !== null}
              className="flex items-center gap-1.5 bg-teal-500/10 hover:bg-teal-500 text-teal-400 hover:text-black border border-teal-500/20 transition-all px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider"
            >
              {processingId === "sample-uid-101" ? <Loader2 size={10} className="animate-spin"/> : <Megaphone size={10} />} Advertise (₦5,000)
            </button>
          </div>
          <div className="flex gap-2 justify-end">
            <button className="p-2 border border-zinc-800 hover:border-zinc-700 rounded-lg text-zinc-400 transition-all"><Edit3 size={11}/></button>
            <button className="p-2 border border-zinc-800 hover:border-red-500/30 rounded-lg text-zinc-400 hover:text-red-400 transition-all"><Trash2 size={11}/></button>
          </div>
        </div>
      </div>
    </div>
  );
}
