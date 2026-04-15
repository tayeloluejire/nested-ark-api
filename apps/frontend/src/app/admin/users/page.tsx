'use client';
import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Users, Loader2, RefreshCw, ShieldCheck, Briefcase, TrendingUp, Crown } from 'lucide-react';

const ROLES = ['GOVERNMENT', 'INVESTOR', 'CONTRACTOR', 'ADMIN', 'VERIFIER'];
const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'text-red-400 border-red-500/30 bg-red-500/5',
  GOVERNMENT: 'text-teal-500 border-teal-500/30 bg-teal-500/5',
  CONTRACTOR: 'text-amber-400 border-amber-500/30 bg-amber-500/5',
  INVESTOR: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5',
  VERIFIER: 'text-purple-400 border-purple-500/30 bg-purple-500/5',
};

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [adminKey, setAdminKey] = useState('');

  const load = useCallback(async () => {
    try { const res = await api.get('/api/admin/users'); setUsers(res.data.users ?? []); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRoleChange = async (email: string, newRole: string) => {
    const key = adminKey || prompt('Enter admin key (ADMIN_KEY from Render):');
    if (!key) return;
    setAdminKey(key);
    setUpdating(email);
    try {
      await api.post('/api/auth/update-role', { email, new_role: newRole, admin_key: key });
      await load();
      alert(`${email} is now ${newRole}. They must sign out and back in to activate.`);
    } catch (err: any) {
      alert(err?.response?.data?.error ?? 'Update failed');
    } finally { setUpdating(null); }
  };

  const filtered = users.filter(u =>
    !filter || u.email.includes(filter) || u.full_name?.toLowerCase().includes(filter.toLowerCase()) || u.role === filter.toUpperCase()
  );

  const roleCount = (role: string) => users.filter(u => u.role === role).length;

  return (
    <div className="space-y-6">
      <header className="border-l-2 border-teal-500 pl-6">
        <p className="text-[10px] text-teal-500 uppercase font-bold tracking-[0.2em] mb-1">User Management</p>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase italic">All Users</h1>
            <p className="text-zinc-500 text-sm mt-1">{users.length} registered operators</p>
          </div>
          <button onClick={load} className="p-2 rounded-lg border border-zinc-800 text-zinc-500 hover:text-teal-500 hover:border-teal-500/50 transition-all"><RefreshCw size={14} /></button>
        </div>
      </header>

      {/* Role breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { role: 'ADMIN', icon: Crown }, { role: 'GOVERNMENT', icon: ShieldCheck },
          { role: 'CONTRACTOR', icon: Briefcase }, { role: 'INVESTOR', icon: TrendingUp },
          { role: 'VERIFIER', icon: Users },
        ].map(({ role, icon: Icon }) => (
          <div key={role} className={`p-4 rounded-xl border text-center cursor-pointer transition-all ${ROLE_COLORS[role]} ${filter === role ? 'ring-1 ring-current' : 'hover:opacity-80'}`} onClick={() => setFilter(filter === role ? '' : role)}>
            <Icon size={14} className="mx-auto mb-1" />
            <p className="text-xs font-black">{roleCount(role)}</p>
            <p className="text-[9px] uppercase font-bold tracking-widest">{role}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <input type="text" placeholder="Search by email, name, or role..." value={filter} onChange={e => setFilter(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-teal-500 transition-colors" />

      {loading ? <div className="py-20 text-center"><Loader2 className="animate-spin text-teal-500 mx-auto" size={24} /></div> : (
        <div className="space-y-2">
          {filtered.map(user => (
            <div key={user.id} className="flex items-center justify-between p-4 rounded-xl border border-zinc-800 bg-zinc-900/20 hover:border-zinc-700 transition-all gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{user.full_name || 'Unnamed'}</p>
                <p className="text-zinc-500 text-xs font-mono truncate">{user.email}</p>
                <p className="text-zinc-700 text-[9px] mt-0.5">{new Date(user.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className={`text-[9px] px-2 py-1 rounded border uppercase font-bold ${ROLE_COLORS[user.role] || 'text-zinc-500 border-zinc-700'}`}>{user.role}</span>
                {updating === user.email ? (
                  <Loader2 className="animate-spin text-teal-500" size={14} />
                ) : (
                  <select
                    defaultValue={user.role}
                    onChange={e => { if (e.target.value !== user.role) handleRoleChange(user.email, e.target.value); }}
                    className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-white text-[10px] font-bold outline-none focus:border-teal-500 transition-colors cursor-pointer"
                  >
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
