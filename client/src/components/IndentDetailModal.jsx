import React, { useState, useEffect } from 'react';
import CostElementPicker from './CostElementPicker';

const STATUS_OPTIONS = ['Estimate', 'On Order', 'Received', 'Invoiced'];
const STATUS_COLORS = {
  'Estimate': { bg: 'rgba(148,163,184,0.15)', text: '#94A3B8', border: 'rgba(148,163,184,0.3)' },
  'On Order': { bg: 'rgba(251,191,36,0.15)', text: '#FBBF24', border: 'rgba(251,191,36,0.3)' },
  'Received': { bg: 'rgba(20,184,166,0.15)', text: '#14B8A6', border: 'rgba(20,184,166,0.3)' },
  'Invoiced': { bg: 'rgba(99,102,241,0.15)', text: '#818CF8', border: 'rgba(99,102,241,0.3)' },
};

const fmt = n => '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

const emptyLine = () => ({ cost_group: '', sub_category: '', cost_element_code: '', description: '', cost_usd: 0, cost_local: 0, cost_marked_up: 0 });

export default function IndentDetailModal({ indent, costGroups, onClose, onSave, onDelete, vesselId }) {
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({});
  const [lines, setLines] = useState([]);

  useEffect(() => {
    if (indent) {
      setForm({
        indent_number: indent.indent_number || '',
        title: indent.title || '',
        source: indent.source || 'HO',
        status: indent.status || 'Estimate',
        location: indent.location || '',
        notes: indent.notes || '',
      });
      // Load lines from indent, or create one from legacy fields
      if (indent.lines && indent.lines.length > 0) {
        setLines(indent.lines.map(l => ({
          cost_group: l.cost_group || '',
          sub_category: l.sub_category || '',
          cost_element_code: l.cost_element_code || '',
          description: l.description || '',
          cost_usd: Number(l.cost_usd) || 0,
          cost_local: Number(l.cost_local) || 0,
          cost_marked_up: Number(l.cost_marked_up) || 0,
        })));
      } else {
        setLines([{
          cost_group: indent.cost_group || '',
          sub_category: indent.sub_category || '',
          cost_element_code: indent.cost_element_code || '',
          description: indent.title || '',
          cost_usd: Number(indent.cost_usd) || 0,
          cost_local: Number(indent.cost_local) || 0,
          cost_marked_up: Number(indent.cost_marked_up) || 0,
        }]);
      }
      setIsEditing(false);
      setShowDeleteConfirm(false);
    }
  }, [indent]);

  if (!indent) return null;

  const totalUsd = lines.reduce((s, l) => s + (parseFloat(l.cost_usd) || 0), 0);
  const totalLocal = lines.reduce((s, l) => s + (parseFloat(l.cost_local) || 0), 0);

  const updateLine = (idx, field, value) => {
    const updated = [...lines];
    updated[idx] = { ...updated[idx], [field]: value };
    setLines(updated);
  };

  const updateLinePicker = (idx, vals) => {
    const updated = [...lines];
    updated[idx] = { ...updated[idx], ...vals };
    setLines(updated);
  };

  const addLine = () => setLines([...lines, emptyLine()]);
  const removeLine = (idx) => { if (lines.length > 1) setLines(lines.filter((_, i) => i !== idx)); };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(vesselId, indent.id, { ...form, lines });
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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-3xl max-h-[90vh] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col"
        style={{ background: 'linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(8,15,30,0.99) 100%)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-2 h-8 rounded-full" style={{ background: sc.text }} />
            <div>
              <h2 className="text-base font-bold text-slate-100">
                {indent.indent_number ? `#${indent.indent_number}` : 'Indent Detail'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">{indent.title} · {lines.length} line{lines.length !== 1 ? 's' : ''} · {fmt(totalUsd)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>{indent.status}</span>
            <button onClick={onClose} className="ml-2 w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all">✕</button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1 space-y-4">
          {/* Indent header fields */}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <div className={label}>Indent #</div>
              <input className={isEditing ? inp : inpDisabled} value={form.indent_number} onChange={e => setForm({ ...form, indent_number: e.target.value })} readOnly={!isEditing} />
            </div>
            <div className="col-span-3">
              <div className={label}>Title / Description</div>
              <input className={isEditing ? inp : inpDisabled} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} readOnly={!isEditing} />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <div className={label}>Source</div>
              {isEditing ? <select className={inp} value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}><option>HO</option><option>Outport</option></select>
                : <div className={inpDisabled}>{form.source}</div>}
            </div>
            <div>
              <div className={label}>Status</div>
              {isEditing ? <select className={inp} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}</select>
                : <div className={inpDisabled}>{form.status}</div>}
            </div>
            <div>
              <div className={label}>PO / Location</div>
              <input className={isEditing ? inp : inpDisabled} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} readOnly={!isEditing} />
            </div>
            <div>
              <div className={label}>Notes</div>
              <input className={isEditing ? inp : inpDisabled} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} readOnly={!isEditing} />
            </div>
          </div>

          {/* Line Items */}
          <div className="border-t border-white/5 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-300">Line Items ({lines.length})</h3>
              {isEditing && <button onClick={addLine} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-cyan-300 bg-cyan-900/20 border border-cyan-800/30 hover:bg-cyan-900/40 transition-colors">+ Add Line</button>}
            </div>

            <div className="space-y-3">
              {lines.map((line, idx) => (
                <div key={idx} className="rounded-xl p-4 border border-white/5 relative" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  {/* Line number badge */}
                  <div className="absolute -top-2 left-3 px-2 py-0.5 rounded text-[10px] font-bold text-slate-500 bg-slate-800 border border-white/5">
                    LINE {idx + 1}
                  </div>
                  {/* Remove button */}
                  {isEditing && lines.length > 1 && (
                    <button onClick={() => removeLine(idx)} className="absolute -top-2 right-3 px-2 py-0.5 rounded text-[10px] font-bold text-red-400 bg-slate-800 border border-red-500/20 hover:bg-red-900/30 transition-colors">✕</button>
                  )}

                  {/* Cost group/sub-category picker */}
                  {isEditing ? (
                    <div className="mb-3">
                      <CostElementPicker
                        value={{ cost_group: line.cost_group, sub_category: line.sub_category }}
                        onChange={v => updateLinePicker(idx, v)}
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div><div className={label}>Cost Group</div><div className={inpDisabled}>{line.cost_group || '—'}</div></div>
                      <div><div className={label}>Sub-Category</div><div className={inpDisabled}>{line.sub_category || '—'}</div></div>
                    </div>
                  )}

                  {/* Description + amounts */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="col-span-1">
                      <div className={label}>Description</div>
                      <input className={isEditing ? inp : inpDisabled} value={line.description} onChange={e => updateLine(idx, 'description', e.target.value)} readOnly={!isEditing} />
                    </div>
                    <div>
                      <div className={label}>Cost USD</div>
                      <input type="number" className={isEditing ? inp : inpDisabled} value={line.cost_usd} onChange={e => updateLine(idx, 'cost_usd', parseFloat(e.target.value) || 0)} readOnly={!isEditing} />
                    </div>
                    <div>
                      <div className={label}>Cost NGN</div>
                      <input type="number" className={isEditing ? inp : inpDisabled} value={line.cost_local} onChange={e => updateLine(idx, 'cost_local', parseFloat(e.target.value) || 0)} readOnly={!isEditing} />
                    </div>
                    <div>
                      <div className={label}>Marked Up</div>
                      <input type="number" className={isEditing ? inp : inpDisabled} value={line.cost_marked_up} onChange={e => updateLine(idx, 'cost_marked_up', parseFloat(e.target.value) || 0)} readOnly={!isEditing} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="flex items-center justify-end gap-6 mt-3 px-4 py-3 rounded-lg" style={{ background: 'rgba(14,116,144,0.08)', border: '1px solid rgba(14,116,144,0.2)' }}>
              <span className="text-xs font-semibold uppercase text-slate-500">Total USD</span>
              <span className="text-lg font-bold text-cyan-300 font-mono">{fmt(totalUsd)}</span>
              {totalLocal > 0 && <>
                <span className="text-xs font-semibold uppercase text-slate-500">Total NGN</span>
                <span className="text-lg font-bold text-purple-300 font-mono">₦{Number(totalLocal).toLocaleString()}</span>
              </>}
            </div>
          </div>

          {/* Meta */}
          <div className="flex items-center gap-4 text-[10px] text-slate-600 pt-2 border-t border-white/5">
            <span>Created: {indent.created_at ? new Date(indent.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span>
            <span>Updated: {indent.updated_at ? new Date(indent.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span>
            <span>ID: {indent.id}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between flex-shrink-0">
          <div>
            {!showDeleteConfirm ? (
              <button onClick={() => setShowDeleteConfirm(true)} className="px-4 py-2 rounded-lg text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 transition-all">Delete</button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-400">Delete this indent and all its lines?</span>
                <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-500 transition-all disabled:opacity-50">{deleting ? 'Deleting...' : 'Yes, Delete'}</button>
                <button onClick={() => setShowDeleteConfirm(false)} className="px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 transition-all">Cancel</button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button onClick={() => { setIsEditing(false); /* reset from indent */ }} className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-lg text-xs font-bold text-white transition-all disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #0F766E, #0E7490)' }}>{saving ? 'Saving...' : 'Save Changes'}</button>
              </>
            ) : (
              <button onClick={() => setIsEditing(true)} className="px-5 py-2 rounded-lg text-xs font-bold text-white transition-all hover:opacity-90" style={{ background: 'linear-gradient(135deg, #0F766E, #0E7490)' }}>Edit Indent</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
