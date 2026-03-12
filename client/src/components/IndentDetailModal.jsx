import React, { useState, useEffect } from 'react';

const STATUS_OPTIONS = ['Estimate', 'On Order', 'Received', 'Invoiced'];
const STATUS_COLORS = {
  'Estimate': { bg: 'rgba(148,163,184,0.15)', text: '#94A3B8', border: 'rgba(148,163,184,0.3)' },
  'On Order': { bg: 'rgba(251,191,36,0.15)', text: '#FBBF24', border: 'rgba(251,191,36,0.3)' },
  'Received': { bg: 'rgba(20,184,166,0.15)', text: '#14B8A6', border: 'rgba(20,184,166,0.3)' },
  'Invoiced': { bg: 'rgba(99,102,241,0.15)', text: '#818CF8', border: 'rgba(99,102,241,0.3)' },
};

export default function IndentDetailModal({ indent, costGroups, onClose, onSave, onDelete, vesselId }) {
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({});

  useEffect(() => {
    if (indent) {
      setForm({
        indent_number: indent.indent_number || '',
        title: indent.title || '',
        cost_group: indent.cost_group || '',
        sub_category: indent.sub_category || '',
        cost_element_code: indent.cost_element_code || '',
        source: indent.source || 'HO',
        status: indent.status || 'Estimate',
        cost_usd: indent.cost_usd || 0,
        cost_local: indent.cost_local || 0,
        cost_marked_up: indent.cost_marked_up || 0,
        location: indent.location || '',
        notes: indent.notes || '',
      });
      setIsEditing(false);
      setShowDeleteConfirm(false);
    }
  }, [indent]);

  if (!indent) return null;

  const subCategories = costGroups?.find(g => g.name === form.cost_group)?.sub_categories || [];

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(vesselId, indent.id, form);
      setIsEditing(false);
    } catch (e) {
      alert('Failed to save: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(vesselId, indent.id);
      onClose();
    } catch (e) {
      alert('Failed to delete: ' + e.message);
    } finally {
      setDeleting(false);
    }
  };

  const inp = "w-full px-3 py-2 rounded-lg bg-slate-800/50 border border-white/10 text-slate-200 text-sm focus:outline-none focus:border-cyan-500 transition-colors";
  const inpDisabled = "w-full px-3 py-2 rounded-lg bg-slate-800/20 border border-white/5 text-slate-400 text-sm cursor-default";
  const label = "text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1";

  const sc = STATUS_COLORS[indent.status] || STATUS_COLORS['Estimate'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-2xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
        style={{ background: 'linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(8,15,30,0.99) 100%)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-2 h-8 rounded-full" style={{ background: sc.text }} />
            <div>
              <h2 className="text-base font-bold text-slate-100">
                {indent.indent_number ? `#${indent.indent_number}` : 'Indent Detail'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">{indent.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="px-3 py-1 rounded-full text-xs font-semibold"
              style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}
            >
              {indent.status}
            </span>
            <button onClick={onClose} className="ml-2 w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all">
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto space-y-4">
          {/* Row 1: Indent # + Title */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className={label}>Indent #</div>
              <input
                className={isEditing ? inp : inpDisabled}
                value={form.indent_number}
                onChange={e => setForm({ ...form, indent_number: e.target.value })}
                readOnly={!isEditing}
              />
            </div>
            <div className="col-span-2">
              <div className={label}>Title / Description</div>
              <input
                className={isEditing ? inp : inpDisabled}
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                readOnly={!isEditing}
              />
            </div>
          </div>

          {/* Row 2: Cost Group + Sub-category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className={label}>Cost Group</div>
              {isEditing ? (
                <select className={inp} value={form.cost_group} onChange={e => setForm({ ...form, cost_group: e.target.value, sub_category: '' })}>
                  <option value="">Select...</option>
                  {costGroups?.map(g => <option key={g.name} value={g.name}>{g.name}</option>)}
                </select>
              ) : (
                <div className={inpDisabled}>{form.cost_group || '—'}</div>
              )}
            </div>
            <div>
              <div className={label}>Sub-Category</div>
              {isEditing ? (
                <select className={inp} value={form.sub_category} onChange={e => setForm({ ...form, sub_category: e.target.value })}>
                  <option value="">Select...</option>
                  {subCategories.map(s => <option key={s.code || s.name} value={s.name}>{s.code ? `${s.code} - ${s.name}` : s.name}</option>)}
                </select>
              ) : (
                <div className={inpDisabled}>{form.sub_category || '—'}</div>
              )}
            </div>
          </div>

          {/* Row 3: Source + Status */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className={label}>Source</div>
              {isEditing ? (
                <select className={inp} value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}>
                  <option value="HO">HO</option>
                  <option value="Outport">Outport</option>
                </select>
              ) : (
                <div className={inpDisabled}>{form.source}</div>
              )}
            </div>
            <div>
              <div className={label}>Status</div>
              {isEditing ? (
                <select className={inp} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <div className={inpDisabled}>{form.status}</div>
              )}
            </div>
            <div>
              <div className={label}>PO / Location</div>
              <input
                className={isEditing ? inp : inpDisabled}
                value={form.location}
                onChange={e => setForm({ ...form, location: e.target.value })}
                readOnly={!isEditing}
              />
            </div>
          </div>

          {/* Row 4: Costs */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className={label}>Cost USD</div>
              <input
                type="number"
                className={isEditing ? inp : inpDisabled}
                value={form.cost_usd}
                onChange={e => setForm({ ...form, cost_usd: parseFloat(e.target.value) || 0 })}
                readOnly={!isEditing}
              />
            </div>
            <div>
              <div className={label}>Cost Local (NGN)</div>
              <input
                type="number"
                className={isEditing ? inp : inpDisabled}
                value={form.cost_local}
                onChange={e => setForm({ ...form, cost_local: parseFloat(e.target.value) || 0 })}
                readOnly={!isEditing}
              />
            </div>
            <div>
              <div className={label}>Marked Up</div>
              <input
                type="number"
                className={isEditing ? inp : inpDisabled}
                value={form.cost_marked_up}
                onChange={e => setForm({ ...form, cost_marked_up: parseFloat(e.target.value) || 0 })}
                readOnly={!isEditing}
              />
            </div>
          </div>

          {/* Row 5: Notes */}
          <div>
            <div className={label}>Notes</div>
            <textarea
              rows={2}
              className={isEditing ? inp + ' resize-none' : inpDisabled + ' resize-none'}
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              readOnly={!isEditing}
            />
          </div>

          {/* Meta info */}
          <div className="flex items-center gap-4 text-[10px] text-slate-600 pt-2 border-t border-white/5">
            <span>Created: {indent.created_at ? new Date(indent.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span>
            <span>Updated: {indent.updated_at ? new Date(indent.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span>
            <span>ID: {indent.id}</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between">
          <div>
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 transition-all"
              >
                Delete
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-400">Are you sure?</span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-500 transition-all disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Yes, Delete'}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 transition-all"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={() => { setIsEditing(false); setForm({ ...indent, location: indent.location || '', notes: indent.notes || '' }); }}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-5 py-2 rounded-lg text-xs font-bold text-white transition-all disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #0F766E, #0E7490)' }}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="px-5 py-2 rounded-lg text-xs font-bold text-white transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #0F766E, #0E7490)' }}
              >
                Edit Indent
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
