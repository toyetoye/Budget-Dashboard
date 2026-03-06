import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api';
import CostElementPicker from '../components/CostElementPicker';

const fmt = n => '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
const fmtPct = n => isNaN(n)||!isFinite(n) ? '0%' : (n*100).toFixed(1)+'%';
const currentMonth = new Date().getMonth() + 1; // 1-12
const monthlyTarget = m => m / 12;

export default function AdminBudgets() {
  const [sp] = useSearchParams();
  const [vessels, setVessels] = useState([]); const [selVessel, setSelVessel] = useState(sp.get('vessel')||'');
  const [budgets, setBudgets] = useState([]); const [loading, setLoading] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear()); const [showAdd, setShowAdd] = useState(false);
  const [newRow, setNewRow] = useState({ cost_group:'', sub_category:'', annual_budget:0 });

  useEffect(() => { api.listVessels().then(setVessels); }, []);
  useEffect(() => { if (selVessel) { setLoading(true); api.getBudgets(selVessel, year).then(setBudgets).finally(()=>setLoading(false)); } }, [selVessel, year]);

  const handleChange = (i, v) => { const u=[...budgets]; u[i]={...u[i], annual_budget:parseFloat(v)||0}; setBudgets(u); };
  const save = async () => { try { await api.setBudgets(selVessel, budgets.map(b=>({cost_group:b.cost_group,sub_category:b.sub_category,annual_budget:b.annual_budget})), year); alert('Saved'); } catch(e){alert(e.message);} };
  const addLine = async () => { if(!newRow.sub_category) return; try { await api.setBudgets(selVessel,[newRow],year); setShowAdd(false); api.getBudgets(selVessel,year).then(setBudgets); }catch(e){alert(e.message);} };
  const [uploading, setUploading] = useState(false);
  const handleBudgetUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selVessel) return;
    const replace = confirm('Replace all existing budget lines for this vessel/year?\n\nOK = Replace all\nCancel = Merge (update existing, add new)');
    setUploading(true);
    try {
      const result = await api.uploadBudget(selVessel, file, year, replace);
      alert(`Imported ${result.imported} budget lines. Total: $${result.total_budget.toLocaleString()}`);
      api.getBudgets(selVessel, year).then(setBudgets);
    } catch (err) { alert('Upload failed: ' + err.message); }
    finally { setUploading(false); e.target.value = ''; }
  };

  const totalBudget = budgets.reduce((s,b)=>s+Number(b.annual_budget),0);
  const totalSpent = budgets.reduce((s,b)=>s+Number(b.actual_spent||0),0);
  const grouped = {}; budgets.forEach(b => { const k=b.cost_group||'Other'; if(!grouped[k])grouped[k]=[]; grouped[k].push(b); });
  const inp="px-3 py-2 rounded-lg bg-slate-800/50 border border-white/10 text-slate-200 text-sm focus:outline-none focus:border-cyan-600";

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div><h1 className="text-xl font-bold text-slate-100">Budget Management</h1></div>
      <div className="flex gap-4 items-end">
        <div><label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Vessel</label><select value={selVessel} onChange={e=>setSelVessel(e.target.value)} className={`${inp} min-w-[220px]`}><option value="">Select</option>{vessels.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
        <div><label className="block text-xs text-slate-400 mb-1 uppercase tracking-wider">Year</label><select value={year} onChange={e=>setYear(Number(e.target.value))} className={inp}>{Array.from({length:new Date().getFullYear()-2024+6},(_,i)=>2024+i).map(y=><option key={y}>{y}</option>)}</select></div>
        {selVessel && <><button onClick={save} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{background:'#0F766E'}}>Save All</button><button onClick={()=>setShowAdd(true)} className="px-4 py-2 rounded-lg text-sm text-cyan-300 bg-cyan-900/20 border border-cyan-800/30">+ Add Line</button>
          <label className="px-4 py-2 rounded-lg text-sm font-semibold text-amber-300 bg-amber-900/20 border border-amber-800/30 cursor-pointer hover:bg-amber-900/40 transition-colors">
            {uploading ? 'Uploading...' : '📁 Upload Budget Excel'}
            <input type="file" accept=".xlsx,.xls" onChange={handleBudgetUpload} className="hidden" disabled={uploading}/>
          </label></>}
      </div>
      {!selVessel && <div className="text-center py-16 text-slate-600 text-sm">Select a vessel</div>}
      {selVessel && <>
        <div className="grid grid-cols-3 gap-4">{[{l:'Budget',v:fmt(totalBudget),c:'#67E8F9'},{l:'Spent',v:fmt(totalSpent),c:'#34D399'},{l:'Util.',v:fmtPct(totalBudget>0?totalSpent/totalBudget:0),c:'#FBBF24'}].map((k,i)=>(
          <div key={i} className="rounded-xl p-4 border border-white/5" style={{background:'rgba(15,23,42,0.6)'}}><div className="text-xs text-slate-500 uppercase">{k.l}</div><div className="text-xl font-bold mt-1" style={{color:k.c}}>{k.v}</div></div>
        ))}</div>
        {showAdd && <div className="rounded-xl p-4 border border-cyan-800/30" style={{background:'rgba(14,116,144,0.05)'}}>
          <CostElementPicker value={newRow} onChange={v=>setNewRow({...newRow,...v})} />
          <div className="flex gap-3 mt-3 items-end"><div><label className="block text-xs text-slate-400 mb-1">Budget USD</label><input type="number" value={newRow.annual_budget} onChange={e=>setNewRow({...newRow,annual_budget:parseFloat(e.target.value)||0})} className={`w-40 ${inp}`}/></div>
            <button onClick={addLine} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{background:'#0F766E'}}>Add</button><button onClick={()=>setShowAdd(false)} className="px-4 py-2 text-sm text-slate-400">Cancel</button></div>
        </div>}
        {!loading && <div className="space-y-4">{Object.entries(grouped).map(([cat,items])=>{
          const cb=items.reduce((s,b)=>s+Number(b.annual_budget),0), cs=items.reduce((s,b)=>s+Number(b.actual_spent||0),0);
          return <div key={cat} className="rounded-xl border border-white/5 overflow-hidden" style={{background:'rgba(15,23,42,0.6)'}}>
            <div className="px-5 py-3 flex items-center justify-between border-b border-white/5" style={{background:'rgba(255,255,255,0.02)'}}>
              <span className="text-sm font-semibold text-slate-200">{cat}</span>
              <span className="text-xs text-slate-400">Budget: {fmt(cb)} · Spent: {fmt(cs)}</span>
            </div>
            <table className="w-full text-sm"><thead><tr className="border-b border-white/5">
              <th className="px-4 py-2 text-left text-xs text-slate-500 w-1/4">Sub-category</th>
              <th className="px-4 py-2 text-right text-xs text-blue-400">HO</th>
              <th className="px-4 py-2 text-right text-xs text-purple-400">Outport</th>
              <th className="px-4 py-2 text-right text-xs text-amber-400">C/F</th>
              <th className="px-4 py-2 text-right text-xs text-slate-300">Total</th>
              <th className="px-4 py-2 text-right text-xs text-slate-500">Monthly Target</th>
              <th className="px-4 py-2 text-right text-xs text-slate-500">Mth %</th>
              <th className="px-4 py-2 text-right text-xs text-slate-500">Budget</th>
              <th className="px-4 py-2 text-right text-xs text-slate-500">%</th>
            </tr></thead><tbody>{items.map((b,i)=>{
              const idx=budgets.indexOf(b);
              const pct=b.annual_budget>0?Number(b.actual_spent||0)/Number(b.annual_budget):0;
              const mTarget = Number(b.annual_budget) * monthlyTarget(currentMonth);
              const mPct = mTarget>0 ? Number(b.actual_spent||0)/mTarget : 0;
              const mColor = mPct>1?'#F87171':mPct>0.8?'#FBBF24':'#34D399';
              const tColor = pct>1?'#F87171':pct>0.5?'#FBBF24':'#34D399';
              return <tr key={i} className="border-b border-white/[0.03]">
                <td className="px-4 py-2 text-xs text-slate-300">{b.sub_category}</td>
                <td className="px-4 py-2 text-right text-xs font-mono text-blue-300">{fmt(Number(b.ho_spent||0))}</td>
                <td className="px-4 py-2 text-right text-xs font-mono text-purple-300">{fmt(Number(b.outport_spent||0))}</td>
                <td className="px-4 py-2 text-right text-xs font-mono text-amber-300">{fmt(Number(b.cf_spent||0))}</td>
                <td className="px-4 py-2 text-right text-xs font-mono font-semibold">{fmt(Number(b.actual_spent||0))}</td>
                <td className="px-4 py-2 text-right text-xs font-mono text-slate-500">{fmt(mTarget)}</td>
                <td className="px-4 py-2 text-right text-xs font-mono font-semibold" style={{color:mColor}}>{fmtPct(mPct)}</td>
                <td className="px-4 py-2 text-right"><input type="number" value={b.annual_budget} onChange={e=>handleChange(idx,e.target.value)} className="w-24 px-2 py-1 rounded bg-slate-800/50 border border-white/10 text-slate-200 text-xs text-right font-mono focus:outline-none focus:border-cyan-600"/></td>
                <td className="px-4 py-2 text-right text-xs font-mono font-semibold" style={{color:tColor}}>{fmtPct(pct)}</td>
              </tr>})}</tbody></table>
          </div>})}</div>}
      </>}
    </div>);
}
