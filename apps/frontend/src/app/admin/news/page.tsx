'use client';
import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Loader2, RefreshCw, Zap, Globe, TrendingUp, ShieldCheck, Megaphone } from 'lucide-react';

const ITEM_TYPES = [
  { id: 'NEWS', label: 'News', icon: Globe, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  { id: 'UPDATE', label: 'Platform Update', icon: ShieldCheck, color: 'text-teal-400 bg-teal-500/10 border-teal-500/20' },
  { id: 'AD', label: 'Sponsored / Ad', icon: Zap, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  { id: 'ALERT', label: 'Market Alert', icon: TrendingUp, color: 'text-red-400 bg-red-500/10 border-red-500/20' },
  { id: 'RATE', label: 'Rate Update', icon: Megaphone, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
];

const typeInfo = (t: string) => ITEM_TYPES.find(x => x.id === t) || ITEM_TYPES[0];

interface NewsItem {
  id: string; content: string; item_type: string; sponsor_name: string | null;
  link_url: string | null; priority: number; is_active: boolean;
  auto_fetched: boolean; created_at: string;
}

const emptyForm = { content: '', item_type: 'NEWS', sponsor_name: '', link_url: '', priority: 1 };

export default function NewsManagerPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<NewsItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/ticker');
      setItems(res.data.news ?? []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.content.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/api/admin/ticker/${editing.id}`, form);
      } else {
        await api.post('/api/admin/ticker', form);
      }
      await load();
      setShowForm(false); setEditing(null); setForm(emptyForm);
    } catch (err: any) { alert(err?.response?.data?.error ?? 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleEdit = (item: NewsItem) => {
    setEditing(item);
    setForm({ content: item.content, item_type: item.item_type, sponsor_name: item.sponsor_name || '', link_url: item.link_url || '', priority: item.priority });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this ticker item?')) return;
    try { await api.delete(`/api/admin/ticker/${id}`); await load(); }
    catch (err: any) { alert(err?.response?.data?.error ?? 'Delete failed'); }
  };

  const handleToggle = async (id: string) => {
    try { await api.post(`/api/admin/ticker/${id}/toggle`); await load(); }
    catch (err: any) { alert(err?.response?.data?.error ?? 'Toggle failed'); }
  };

  const cancelEdit = () => { setEditing(null); setShowForm(false); setForm(emptyForm); };

  return (
    <div className="space-y-6">
      <header className="border-l-2 border-teal-500 pl-6">
        <p className="text-[10px] text-teal-500 uppercase font-bold tracking-[0.2em] mb-1">Content Management</p>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase italic">Market Ticker</h1>
            <p className="text-zinc-500 text-sm mt-1">Manage live scrolling content — push news, ads, and alerts to all users</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={load} className="p-2 rounded-lg border border-zinc-800 text-zinc-500 hover:text-teal-500 hover:border-teal-500/50 transition-all"><RefreshCw size={14} /></button>
            <button onClick={() => { setShowForm(true); setEditing(null); setForm(emptyForm); }} className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-black font-bold rounded-xl text-xs uppercase tracking-widest hover:bg-teal-400 transition-all">
              <Plus size={14} /> Push New Item
            </button>
          </div>
        </div>
      </header>

      {/* Form */}
      {showForm && (
        <div className="p-6 rounded-2xl border border-teal-500/30 bg-teal-500/5 space-y-5">
          <h2 className="text-lg font-bold uppercase tracking-tight">{editing ? 'Edit Item' : 'Push New Ticker Item'}</h2>
          <form onSubmit={handleSave} className="space-y-4">
            {/* Type selector */}
            <div>
              <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-2">Item Type</label>
              <div className="flex flex-wrap gap-2">
                {ITEM_TYPES.map(t => {
                  const Icon = t.icon;
                  return (
                    <button key={t.id} type="button" onClick={() => setForm({ ...form, item_type: t.id })}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all ${form.item_type === t.id ? t.color + ' ring-1 ring-current' : 'border-zinc-800 text-zinc-600 hover:text-white'}`}>
                      <Icon size={11} /> {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Content */}
            <div>
              <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-2">Content *</label>
              <textarea required rows={2} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })}
                placeholder="e.g. Lagos-Ibadan Phase 1 VERIFIED — $750k released to contractor..." className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-teal-500 transition-colors resize-none" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-2">Sponsor/Source (optional)</label>
                <input value={form.sponsor_name} onChange={e => setForm({ ...form, sponsor_name: e.target.value })} placeholder="e.g. Dangote Cement" className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-teal-500 transition-colors" />
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-2">Link URL (optional)</label>
                <input value={form.link_url} onChange={e => setForm({ ...form, link_url: e.target.value })} placeholder="https://..." className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-teal-500 transition-colors" />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-zinc-500 uppercase font-bold block mb-2">Priority (1 = highest)</label>
              <input type="number" min={1} max={10} value={form.priority} onChange={e => setForm({ ...form, priority: parseInt(e.target.value) || 1 })} className="w-24 bg-black border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-teal-500 transition-colors" />
            </div>

            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="flex items-center gap-2 px-6 py-3 bg-teal-500 text-black font-bold rounded-xl text-xs uppercase tracking-widest hover:bg-teal-400 transition-all disabled:opacity-50">
                {saving ? <Loader2 className="animate-spin" size={14} /> : <><Plus size={14} /> {editing ? 'Update Item' : 'Push to Ticker'}</>}
              </button>
              <button type="button" onClick={cancelEdit} className="px-4 py-3 border border-zinc-700 text-zinc-400 font-bold rounded-xl text-xs uppercase tracking-widest hover:text-white transition-all">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Live preview */}
      <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-900/20">
        <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest mb-2">Ticker Preview (active items only)</p>
        <div className="flex gap-4 overflow-x-auto pb-1">
          {items.filter(i => i.is_active).slice(0, 5).map(item => {
            const info = typeInfo(item.item_type);
            const Icon = info.icon;
            return (
              <span key={item.id} className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-mono font-bold uppercase tracking-widest ${info.color}`}>
                <Icon size={10} /> {item.content.slice(0, 40)}{item.content.length > 40 ? '…' : ''}
              </span>
            );
          })}
          {items.filter(i => i.is_active).length === 0 && <span className="text-zinc-600 text-[10px]">No active items yet</span>}
        </div>
      </div>

      {/* Items list */}
      {loading ? <div className="py-10 text-center"><Loader2 className="animate-spin text-teal-500 mx-auto" size={24} /></div> : (
        <div className="space-y-2">
          {items.length === 0 && (
            <div className="py-16 text-center border border-dashed border-zinc-800 rounded-2xl">
              <Megaphone className="mx-auto text-zinc-700 mb-3" size={24} />
              <p className="text-zinc-600 text-xs uppercase font-bold tracking-widest">No ticker items yet</p>
              <p className="text-zinc-700 text-[10px] mt-1">Push your first item to start broadcasting</p>
            </div>
          )}
          {items.map(item => {
            const info = typeInfo(item.item_type);
            const Icon = info.icon;
            return (
              <div key={item.id} className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${item.is_active ? 'border-zinc-800 bg-zinc-900/20' : 'border-zinc-800/50 bg-zinc-900/5 opacity-50'}`}>
                <div className={`p-2 rounded-lg border flex-shrink-0 ${info.color}`}>
                  <Icon size={12} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{item.content}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className={`text-[9px] font-bold uppercase ${info.color.split(' ')[0]}`}>{item.item_type}</span>
                    {item.sponsor_name && <span className="text-[9px] text-zinc-500">· {item.sponsor_name}</span>}
                    <span className="text-[9px] text-zinc-700">Priority {item.priority}</span>
                    <span className="text-[9px] text-zinc-700">{new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => handleToggle(item.id)} className={`p-2 rounded-lg transition-all ${item.is_active ? 'text-teal-500 hover:bg-teal-500/10' : 'text-zinc-600 hover:bg-zinc-800'}`} title={item.is_active ? 'Deactivate' : 'Activate'}>
                    {item.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                  </button>
                  <button onClick={() => handleEdit(item)} className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all">
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => handleDelete(item.id)} className="p-2 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
