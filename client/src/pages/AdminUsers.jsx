import React, { useState, useEffect } from 'react';
import api from '../api';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [vessels, setVessels] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ username: '', password: '', role: 'vessel', vessel_id: '', vessel_ids: [], display_name: '' });

  useEffect(() => { loadData(); }, []);
  const loadData = () => Promise.all([api.listUsers(), api.listVessels()]).then(([u, v]) => { setUsers(u); setVessels(v); });

  const save = async () => {
    try {
      const payload = { ...form };
      if (form.role === 'superintendent') {
        payload.vessel_ids = form.vessel_ids;
        payload.vessel_id = form.vessel_ids[0] || null;
      } else if (form.role === 'vessel') {
        payload.vessel_id = form.vessel_id || null;
        payload.vessel_ids = form.vessel_id ? [parseInt(form.vessel_id)] : [];
      } else {
        payload.vessel_id = null;
        payload.vessel_ids = [];
      }
      if (editing) {
        if (!payload.password) delete payload.password;
        await api.updateUser(editing.id, payload);
      } else {
        if (!payload.password) return alert('Password required');
        await api.createUser(payload);
      }
      setShowForm(false); setEditing(null);
      setForm({ username: '', password: '', role: 'vessel', vessel_id: '', vessel_ids: [], display_name: '' });
      loadData();
    } catch (e) { alert(e.message); }
  };

  const toggleVessel = (vid) => {
    const id = parseInt(vid);
    setForm(f => ({
      ...f,
      vessel_ids: f.vessel_ids.includes(id) ? f.vessel_ids.filter(v => v !== id) : [...f.vessel_ids, id]
    }));
  };

  const startEdit = (u) => {
    setEditing(u);
    setForm({
      username: u.username,
      password: '',
      role: u.role,
      vessel_id: u.vessel_id || '',
      vessel_ids: u.vessel_ids || (u.vessel_id ? [u.vessel_id] : []),
      display_name: u.display_name || ''
    });
    setShowForm(true);
  };

  const inp = "w-full px-3 py-2 rounded-lg bg-slate-800/50 border border-white/10 text-slate-200 text-sm focus:outline-none focus:border-cyan-600";
  const roleCls = { admin: 'bg-violet-900/30 text-violet-300', superintendent: 'bg-amber-900/30 text-amber-300', manager: 'bg-teal-900/30 text-teal-300', vessel: 'bg-blue-900/30 text-blue-300' };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-100">User Management</h1>
        <button onClick={() => { setEditing(null); setForm({ username: '', password: '', role: 'vessel', vessel_id: '', vessel_ids: [], display_name: '' }); setShowForm(true); }}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg,#0F766E,#0E7490)' }}>+ Add User</button>
      </div>

      {showForm && (
        <div className="rounded-xl p-5 border border-cyan-800/30" style={{ background: 'rgba(14,116,144,0.05)' }}>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs text-slate-400 mb-1">Username *</label><input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} className={inp} /></div>
            <div><label className="block text-xs text-slate-400 mb-1">Password {editing ? '(blank=keep)' : '*'}</label><input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className={inp} /></div>
            <div><label className="block text-xs text-slate-400 mb-1">Display Name</label><input value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} className={inp} /></div>
            <div><label className="block text-xs text-slate-400 mb-1">Role</label>
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value, vessel_ids: [], vessel_id: '' })} className={inp}>
                <option value="admin">Admin</option><option value="superintendent">Superintendent</option><option value="manager">Manager</option><option value="vessel">Vessel User</option>
              </select></div>

            {/* Single vessel for vessel users */}
            {form.role === 'vessel' && (
              <div className="col-span-2"><label className="block text-xs text-slate-400 mb-1">Assigned Vessel</label>
                <select value={form.vessel_id} onChange={e => setForm({ ...form, vessel_id: e.target.value })} className={inp}>
                  <option value="">Select vessel</option>
                  {vessels.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select></div>
            )}

            {/* Multi-vessel for superintendent */}
            {form.role === 'superintendent' && (
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-2">Assigned Vessels (select multiple)</label>
                <div className="grid grid-cols-2 gap-2">
                  {vessels.map(v => {
                    const selected = form.vessel_ids.includes(v.id);
                    return (
                      <button key={v.id} type="button" onClick={() => toggleVessel(v.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-all border ${
                          selected ? 'bg-cyan-900/30 text-cyan-300 border-cyan-700/40' : 'bg-slate-800/30 text-slate-400 border-white/5 hover:border-white/10'
                        }`}>
                        <div className={`w-4 h-4 rounded flex items-center justify-center text-xs ${selected ? 'bg-cyan-600 text-white' : 'bg-slate-700'}`}>
                          {selected ? '✓' : ''}
                        </div>
                        <div>
                          <div className="font-medium">{v.name}</div>
                          {v.imo && <div className="text-[10px] text-slate-500">IMO {v.imo}</div>}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {form.vessel_ids.length > 0 && (
                  <div className="text-xs text-cyan-400 mt-2">{form.vessel_ids.length} vessel(s) selected</div>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={save} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: '#0F766E' }}>{editing ? 'Update' : 'Create'}</button>
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="px-4 py-2 text-sm text-slate-400">Cancel</button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-white/5 overflow-hidden" style={{ background: 'rgba(15,23,42,0.6)' }}>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-white/5">
            {['User', 'Role', 'Vessel(s)', 'Status', ''].map(h => <th key={h} className="px-5 py-3 text-left text-xs text-slate-500 uppercase">{h}</th>)}
          </tr></thead>
          <tbody>{users.map(u => (
            <tr key={u.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
              <td className="px-5 py-3">
                <div className="text-sm text-slate-200">{u.display_name || u.username}</div>
                <div className="text-xs text-slate-500">{u.username}</div>
              </td>
              <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${roleCls[u.role] || ''}`}>{u.role}</span></td>
              <td className="px-5 py-3 text-xs text-slate-400">
                {u.vessel_names?.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {u.vessel_names.map((name, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">{name}</span>
                    ))}
                  </div>
                ) : '—'}
              </td>
              <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded text-xs ${u.active ? 'bg-emerald-900/30 text-emerald-300' : 'bg-red-900/30 text-red-300'}`}>{u.active ? 'Active' : 'Inactive'}</span></td>
              <td className="px-5 py-3"><button onClick={() => startEdit(u)} className="text-xs text-cyan-400">Edit</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
