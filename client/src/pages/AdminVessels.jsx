import React, { useState, useEffect } from 'react';
import api from '../api';

export default function AdminVessels() {
  const [vessels, setVessels] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', imo: '', vessel_type: '' });
  const [deleteStep, setDeleteStep] = useState(0); // 0=none, 1=first prompt, 2=final confirm
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');

  useEffect(() => { api.listVessels().then(setVessels); }, []);

  const save = async () => {
    try {
      if (editing) await api.updateVessel(editing.id, form);
      else await api.createVessel(form);
      setShowForm(false); setEditing(null);
      setForm({ name: '', imo: '', vessel_type: '' });
      api.listVessels().then(setVessels);
    } catch (e) { alert(e.message); }
  };

  const startDelete = (v) => {
    setDeleteTarget(v);
    setDeleteStep(1);
    setDeleteConfirmName('');
  };

  const confirmDelete = async () => {
    if (deleteConfirmName !== deleteTarget.name) {
      alert('Vessel name does not match. Please type the exact name.');
      return;
    }
    try {
      await api.deleteVessel(deleteTarget.id);
      setDeleteStep(0); setDeleteTarget(null); setDeleteConfirmName('');
      setShowForm(false); setEditing(null);
      api.listVessels().then(setVessels);
    } catch (e) { alert(e.message); }
  };

  const cancelDelete = () => { setDeleteStep(0); setDeleteTarget(null); setDeleteConfirmName(''); };

  const inp = "w-full px-3 py-2 rounded-lg bg-slate-800/50 border border-white/10 text-slate-200 text-sm focus:outline-none focus:border-cyan-600";

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-100">Manage Vessels</h1>
        <button onClick={() => { setEditing(null); setForm({ name: '', imo: '', vessel_type: '' }); setShowForm(true); cancelDelete(); }}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg,#0F766E,#0E7490)' }}>+ Add Vessel</button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="rounded-xl p-5 border border-cyan-800/30" style={{ background: 'rgba(14,116,144,0.05)' }}>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="block text-xs text-slate-400 mb-1">Name *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inp} /></div>
            <div><label className="block text-xs text-slate-400 mb-1">IMO</label><input value={form.imo} onChange={e => setForm({ ...form, imo: e.target.value })} className={inp} /></div>
            <div><label className="block text-xs text-slate-400 mb-1">Type</label>
              <select value={form.vessel_type} onChange={e => setForm({ ...form, vessel_type: e.target.value })} className={inp}>
                <option value="">Select</option><option>LPG Carrier</option><option>LNG Carrier</option><option>Oil Tanker</option><option>Bulk Carrier</option><option>Other</option>
              </select></div>
          </div>
          <div className="flex items-center justify-between mt-4">
            <div className="flex gap-3">
              <button onClick={save} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: '#0F766E' }}>{editing ? 'Update' : 'Create'}</button>
              <button onClick={() => { setShowForm(false); setEditing(null); }} className="px-4 py-2 text-sm text-slate-400">Cancel</button>
            </div>
            {editing && (
              <button onClick={() => startDelete(editing)} className="px-4 py-2 rounded-lg text-sm font-semibold text-red-400 bg-red-900/20 border border-red-800/30 hover:bg-red-900/40 transition-colors">
                Delete Vessel
              </button>
            )}
          </div>
        </div>
      )}

      {/* Delete Step 1: Are you sure? */}
      {deleteStep === 1 && deleteTarget && (
        <div className="rounded-xl p-5 border border-red-500/30" style={{ background: 'rgba(127,29,29,0.15)' }}>
          <h3 className="text-sm font-bold text-red-400 mb-2">⚠ Delete {deleteTarget.name}?</h3>
          <p className="text-xs text-slate-400 mb-4">
            This will permanently delete the vessel and ALL associated data including budgets, indents, and carried forward items. 
            User accounts assigned to this vessel will be unlinked (not deleted). This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteStep(2)} className="px-4 py-2 rounded-lg text-sm font-semibold text-red-400 bg-red-900/30 border border-red-700/40 hover:bg-red-900/50">
              Yes, I want to delete this vessel
            </button>
            <button onClick={cancelDelete} className="px-4 py-2 rounded-lg text-sm text-slate-400">Cancel</button>
          </div>
        </div>
      )}

      {/* Delete Step 2: Type vessel name to confirm */}
      {deleteStep === 2 && deleteTarget && (
        <div className="rounded-xl p-5 border border-red-500/40" style={{ background: 'rgba(127,29,29,0.2)' }}>
          <h3 className="text-sm font-bold text-red-400 mb-2">⚠ Final Confirmation</h3>
          <p className="text-xs text-slate-400 mb-3">
            Type the vessel name <span className="text-red-300 font-semibold">"{deleteTarget.name}"</span> to confirm deletion.
          </p>
          <input value={deleteConfirmName} onChange={e => setDeleteConfirmName(e.target.value)}
            placeholder="Type vessel name here..."
            className="w-full px-3 py-2 rounded-lg bg-red-950/50 border border-red-700/40 text-red-200 text-sm focus:outline-none focus:border-red-500 mb-4" />
          <div className="flex gap-3">
            <button onClick={confirmDelete}
              disabled={deleteConfirmName !== deleteTarget.name}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              style={{ background: deleteConfirmName === deleteTarget.name ? '#DC2626' : '#7F1D1D' }}>
              Permanently Delete
            </button>
            <button onClick={cancelDelete} className="px-4 py-2 rounded-lg text-sm text-slate-400">Cancel</button>
          </div>
        </div>
      )}

      {/* Vessel List */}
      <div className="space-y-3">
        {vessels.map(v => (
          <div key={v.id} className="rounded-xl p-5 border border-white/5 flex items-center justify-between" style={{ background: 'rgba(15,23,42,0.6)' }}>
            <div>
              <div className="text-sm font-semibold text-slate-100">{v.name}</div>
              <div className="text-xs text-slate-500">{v.imo ? `IMO ${v.imo}` : ''} · {v.vessel_type || ''}</div>
            </div>
            <button onClick={() => { setEditing(v); setForm({ name: v.name, imo: v.imo || '', vessel_type: v.vessel_type || '' }); setShowForm(true); cancelDelete(); }}
              className="px-3 py-1.5 text-xs text-cyan-300 bg-cyan-900/20 border border-cyan-800/30 rounded-lg">Edit</button>
          </div>
        ))}
      </div>
    </div>
  );
}
