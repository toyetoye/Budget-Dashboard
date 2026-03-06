import React, { useState, useEffect } from 'react';
import api from '../api';

export default function CostElementPicker({ value, onChange }) {
  const [groups, setGroups] = useState([]);
  const [selGroup, setSelGroup] = useState(value?.cost_group || '');
  const [selElement, setSelElement] = useState(value?.sub_category || '');
  useEffect(() => { api.getCostGroups().then(setGroups).catch(console.error); }, []);
  useEffect(() => { if (value?.cost_group) setSelGroup(value.cost_group); if (value?.sub_category) setSelElement(value.sub_category); }, [value]);
  const els = groups.find(g => g.name === selGroup)?.elements || [];
  const cls = "w-full px-3 py-2 rounded-lg bg-slate-800/50 border border-white/10 text-slate-200 text-sm focus:outline-none focus:border-cyan-600";
  return (
    <div className="grid grid-cols-2 gap-3">
      <div><label className="block text-xs text-slate-400 mb-1">Cost Group</label>
        <select value={selGroup} onChange={e => { setSelGroup(e.target.value); setSelElement(''); onChange({ cost_group: e.target.value, sub_category: '', cost_element_code: '' }); }} className={cls}>
          <option value="">Select cost group</option>{groups.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
        </select></div>
      <div><label className="block text-xs text-slate-400 mb-1">Cost Element</label>
        <select value={selElement} onChange={e => { setSelElement(e.target.value); const el = els.find(x => x.name === e.target.value); onChange({ cost_group: selGroup, sub_category: e.target.value, cost_element_code: el?.code || '' }); }} className={cls} disabled={!selGroup}>
          <option value="">Select element</option>{els.map(e => <option key={e.id} value={e.name}>{e.code} — {e.name}</option>)}
        </select></div>
    </div>
  );
}
