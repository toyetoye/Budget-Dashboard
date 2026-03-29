import React, { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useAuth } from '../App';
import api from '../api';
import IndentDetailModal from '../components/IndentDetailModal';
import CostElementPicker from '../components/CostElementPicker';

const fmt = n => '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
const fmtPct = n => isNaN(n)||!isFinite(n)?'0%':(n*100).toFixed(1)+'%';
const PALETTE = ['#0F766E','#0E7490','#1D4ED8','#6D28D9','#BE185D','#B45309','#047857','#4338CA','#9333EA','#DC2626','#0369A1','#15803D'];
const STATUS_COLORS = {Estimate:'#F59E0B','On Order':'#3B82F6',Received:'#10B981',Invoiced:'#6366F1'};
const week = Math.ceil((new Date()-new Date(new Date().getFullYear(),0,1))/(7*24*60*60*1000));
const currentMonth = new Date().getMonth()+1;
const targetPct = week/52;
function getAlert(p){if(p>1)return'critical';if(p>targetPct*1.3)return'warning';return'ok';}
const Tip=({active,payload,label})=>!active||!payload?.length?null:<div className="rounded-lg px-3 py-2 text-xs border border-white/10" style={{background:'rgba(15,23,42,0.95)'}}><div className="text-slate-400 mb-1">{label}</div>{payload.map((p,i)=><div key={i} style={{color:p.color}} className="font-semibold">{p.name}: {fmt(p.value)}</div>)}</div>;
const StatusBadge=({status})=>{const c={Estimate:'bg-amber-900/40 text-amber-300 border-amber-700/50','On Order':'bg-blue-900/40 text-blue-300 border-blue-700/50',Received:'bg-emerald-900/40 text-emerald-300 border-emerald-700/50',Invoiced:'bg-violet-900/40 text-violet-300 border-violet-700/50'};return<span className={`px-2 py-0.5 rounded text-xs font-medium border ${c[status]||'bg-gray-800 text-gray-400'}`}>{status}</span>;};
const AlertBadge=({level})=>level==='critical'?<span className="px-2 py-0.5 rounded text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse">OVER BUDGET</span>:level==='warning'?<span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">HIGH SPEND</span>:null;

const emptyLine = () => ({ cost_group: '', sub_category: '', cost_element_code: '', description: '', cost_usd: 0, cost_local: 0, cost_marked_up: 0 });

export default function VesselDashboard({ vesselIdProp, hideIndents = false }) {
  const { user } = useAuth();
  const vesselId = vesselIdProp || user?.vessel_id;
  const canEdit = ['admin','superintendent','vessel'].includes(user?.role);
  const canEditBudget = ['admin','superintendent'].includes(user?.role);
  const [tab, setTab] = useState('overview');
  const [vessel, setVessel] = useState(null);
  const [budgets, setBudgets] = useState([]);
  const [allIndents, setAllIndents] = useState([]);
  const [costGroups, setCostGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndent, setSelectedIndent] = useState(null);
  const [expandedIndent, setExpandedIndent] = useState(null);
  const [indentSrc, setIndentSrc] = useState('HO');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQ, setSearchQ] = useState('');
  const [selectedCat, setSelectedCat] = useState(null);
  const [drillSub, setDrillSub] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showAddBudget, setShowAddBudget] = useState(false);
  const [newBudget, setNewBudget] = useState({ cost_group:'', sub_category:'', annual_budget:0 });
  const [budgetDirty, setBudgetDirty] = useState(false);

  // Multi-line indent form state
  const [form, setForm] = useState({ indent_number:'', title:'', source:'HO', status:'Estimate', location:'', notes:'' });
  const [formLines, setFormLines] = useState([emptyLine()]);

  const [bprData, setBprData] = useState(null);
  const [bprLoading, setBprLoading] = useState(false);
  const [bprFilter, setBprFilter] = useState('All');
  const [bprSearch, setBprSearch] = useState('');
  const [bprMeta, setBprMeta] = useState(null);
  const [budgetYear, setBudgetYear] = useState(new Date().getFullYear());

  useEffect(()=>{if(vesselId)loadAll();},[vesselId, budgetYear]);
  const loadAll=async()=>{setLoading(true);try{const[v,b,i,cg]=await Promise.all([api.getVessel(vesselId),api.getBudgets(vesselId,budgetYear),api.getIndents(vesselId),api.getCostGroups()]);setVessel(v);setBudgets(b);setAllIndents(i);setCostGroups(cg);}catch(e){console.error(e);}finally{setLoading(false);}};

  const ho=allIndents.filter(i=>i.source==='HO'&&!i.is_carried_forward);
  const op=allIndents.filter(i=>i.source==='Outport'&&!i.is_carried_forward);
  const cf=allIndents.filter(i=>i.is_carried_forward);
  const srcIndents=indentSrc==='HO'?ho:indentSrc==='Outport'?op:cf;
  const filtered=srcIndents.filter(i=>{
    if(statusFilter!=='All'&&i.status!==statusFilter)return false;
    if(searchQ){const q=searchQ.toLowerCase();
      const lineMatch = (i.lines||[]).some(l=>(l.sub_category||'').toLowerCase().includes(q)||(l.cost_group||'').toLowerCase().includes(q));
      if(!((i.title||'').toLowerCase().includes(q)||(i.indent_number||'').toLowerCase().includes(q)||lineMatch))return false;
    }
    return true;
  });

  const drillIndents = drillSub ? allIndents.filter(i=>(i.lines||[]).some(l=>l.sub_category===drillSub)) : [];

  const categories=useMemo(()=>{
    const m={};budgets.forEach(b=>{const k=b.cost_group||'Other';if(!m[k])m[k]={category:k,annual:0,actual:0,ho:0,outport:0,cf:0,subs:[]};
    m[k].annual+=Number(b.annual_budget);m[k].actual+=Number(b.actual_spent||0);m[k].ho+=Number(b.ho_spent||0);m[k].outport+=Number(b.outport_spent||0);m[k].cf+=Number(b.cf_spent||0);
    m[k].subs.push({name:b.sub_category,annual:Number(b.annual_budget),actual:Number(b.actual_spent||0),ho:Number(b.ho_spent||0),outport:Number(b.outport_spent||0),cf:Number(b.cf_spent||0)});});
    return Object.values(m);
  },[budgets]);

  const totalBudget=categories.reduce((s,c)=>s+c.annual,0);
  const totalSpent=categories.reduce((s,c)=>s+c.actual,0);
  const overallPct=totalBudget>0?totalSpent/totalBudget:0;
  const alerts=categories.filter(c=>c.annual>0&&getAlert(c.actual/c.annual)!=='ok').sort((a,b)=>(b.actual/b.annual)-(a.actual/a.annual));
  const pieData=categories.filter(c=>c.actual>0).map((c,i)=>({name:c.category,value:c.actual,color:PALETTE[i%PALETTE.length]}));
  const barData=categories.map(c=>({name:c.category.length>14?c.category.slice(0,14)+'…':c.category,budget:c.annual,actual:c.actual}));
  const statusCounts=srcIndents.reduce((a,i)=>{a[i.status]=(a[i.status]||0)+1;return a;},{});
  const detail=selectedCat?categories.find(c=>c.category===selectedCat):null;

  const formTotal = formLines.reduce((s, l) => s + (parseFloat(l.cost_usd) || 0), 0);
  const formTotalLocal = formLines.reduce((s, l) => s + (parseFloat(l.cost_local) || 0), 0);

  const resetForm = () => {
    setForm({ indent_number:'', title:'', source:indentSrc==='CF'?'HO':indentSrc, status:'Estimate', location:'', notes:'' });
    setFormLines([emptyLine()]);
  };

  const submitIndent = async () => {
    if (!form.indent_number && !form.title) return alert('Enter an indent number or title');
    if (formLines.every(l => !l.sub_category)) return alert('Select at least one cost element');
    try {
      await api.createIndent(vesselId, { ...form, lines: formLines });
      setShowForm(false);
      resetForm();
      loadAll();
    } catch(e) { alert(e.message); }
  };

  const updateFormLine = (idx, field, value) => {
    const updated = [...formLines];
    updated[idx] = { ...updated[idx], [field]: value };
    setFormLines(updated);
  };
  const updateFormLinePicker = (idx, vals) => {
    const updated = [...formLines];
    updated[idx] = { ...updated[idx], ...vals };
    setFormLines(updated);
  };
  const addFormLine = () => setFormLines([...formLines, emptyLine()]);
  const removeFormLine = (idx) => { if (formLines.length > 1) setFormLines(formLines.filter((_, i) => i !== idx)); };

  const handleBudgetChange=(idx,val)=>{const u=[...budgets];u[idx]={...u[idx],annual_budget:parseFloat(val)||0};setBudgets(u);setBudgetDirty(true);};
  const saveBudgets=async()=>{try{await api.setBudgets(vesselId,budgets.map(b=>({cost_group:b.cost_group,sub_category:b.sub_category,annual_budget:b.annual_budget})),budgetYear);setBudgetDirty(false);alert('Budgets saved');loadAll();}catch(e){alert(e.message);}};
  const addBudgetLine=async()=>{if(!newBudget.sub_category)return alert('Select a cost element');try{await api.setBudgets(vesselId,[newBudget],budgetYear);setShowAddBudget(false);setNewBudget({cost_group:'',sub_category:'',annual_budget:0});loadAll();}catch(e){alert(e.message);}};

  const [budgetUploading, setBudgetUploading] = useState(false);
  const handleBudgetUpload=async(e)=>{
    const file=e.target.files?.[0]; if(!file)return;
    const replace=confirm('Replace all existing budget lines?\n\nOK = Replace all\nCancel = Merge');
    setBudgetUploading(true);
    try{const r=await api.uploadBudget(vesselId,file,budgetYear,replace);alert(`Imported ${r.imported} budget lines.`);loadAll();}
    catch(err){alert('Upload failed: '+err.message);}
    finally{setBudgetUploading(false);e.target.value='';}
  };
  const handleBPRUpload=async(e)=>{
    const file=e.target.files?.[0]; if(!file)return;
    setBprLoading(true);
    try{const data=await api.uploadBPR(vesselId,file,budgetYear);setBprData(data);setBprMeta({uploaded_by:user?.display_name,uploaded_at:new Date().toISOString(),filename:file.name});setTab('bpr');}
    catch(err){alert('BPR upload failed: '+err.message);}
    finally{setBprLoading(false);e.target.value='';}
  };
  const loadLatestBPR=async()=>{
    setBprLoading(true);
    try{const data=await api.getLatestBPR(vesselId,budgetYear);if(data){setBprData(data);setBprMeta({uploaded_by:data.uploaded_by,uploaded_at:data.uploaded_at,filename:data.filename});}else{setBprData(null);setBprMeta(null);}}catch(e){console.error(e);}finally{setBprLoading(false);}
  };

  const inp="w-full px-3 py-2 rounded-lg bg-slate-800/50 border border-white/10 text-slate-200 text-sm focus:outline-none focus:border-cyan-600";
  const tabs = hideIndents ? ['overview','categories','alerts'] : ['overview','categories','indents','bpr','alerts'];

  if(loading)return<div className="flex items-center justify-center h-screen text-slate-500 text-sm">Loading...</div>;
  if(!vesselId)return<div className="flex items-center justify-center h-screen text-slate-500 text-sm">No vessel assigned.</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-xl font-bold text-slate-100">{vessel?.name||'Dashboard'}</h1><div className="text-xs text-slate-500 mt-1">{vessel?.imo?`IMO ${vessel.imo}`:''} · {budgetYear} Budget · Week {week}/52 · Month {currentMonth}/12</div></div>
        <div className="flex items-center gap-3">
          <select value={budgetYear} onChange={e=>setBudgetYear(Number(e.target.value))} className="px-3 py-1.5 rounded-lg bg-slate-800/50 border border-white/10 text-slate-200 text-xs focus:outline-none focus:border-cyan-600">
            {Array.from({length:new Date().getFullYear()-2024+6},(_,i)=>2024+i).map(y=><option key={y}>{y}</option>)}
          </select>
          <div className="flex gap-1 rounded-lg p-1" style={{background:'rgba(255,255,255,0.04)'}}>
            {tabs.map(t=><button key={t} onClick={()=>{setTab(t);setDrillSub(null);if(t==='bpr'&&!bprData)loadLatestBPR();}} className="px-4 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider" style={{background:tab===t?'rgba(14,116,144,0.3)':'transparent',color:tab===t?'#67E8F9':'#94A3B8',border:tab===t?'1px solid rgba(14,116,144,0.4)':'1px solid transparent'}}>{t}</button>)}
          </div>
        </div>
      </div>

      {/* OVERVIEW */}
      {tab==='overview'&&<div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">{[{l:'Budget',v:fmt(totalBudget),c:'#67E8F9'},{l:'Spent',v:fmt(totalSpent),c:overallPct>targetPct?'#F87171':'#34D399'},{l:'Remaining',v:fmt(totalBudget-totalSpent),c:'#A78BFA'},{l:'Target',v:fmtPct(targetPct),c:'#FBBF24'}].map((k,i)=>(
          <div key={i} className="rounded-xl p-5 border border-white/5" style={{background:'linear-gradient(135deg,rgba(15,23,42,0.9),rgba(30,41,59,0.7))'}}><div className="text-xs uppercase tracking-widest text-slate-500 mb-2">{k.l}</div><div className="text-2xl font-bold" style={{color:k.c}}>{k.v}</div></div>
        ))}</div>
        <div className="rounded-xl p-5 border border-white/5" style={{background:'rgba(15,23,42,0.6)'}}>
          <div className="flex justify-between mb-3"><span className="text-sm font-semibold text-slate-300">Utilization</span><span className="text-xs text-slate-500">Target: {fmtPct(targetPct)} · Actual: {fmtPct(overallPct)}</span></div>
          <div className="relative w-full h-6 rounded-full overflow-hidden bg-white/5"><div className="h-full rounded-full" style={{width:`${Math.min(overallPct*100,100)}%`,background:overallPct>targetPct*1.3?'linear-gradient(90deg,#DC2626,#EF4444)':'linear-gradient(90deg,#0F766E,#0E7490)'}}/><div className="absolute top-0 h-full w-0.5 bg-amber-400" style={{left:`${targetPct*100}%`}}/></div>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div className="rounded-xl p-5 border border-white/5" style={{background:'rgba(15,23,42,0.6)'}}>
            <h3 className="text-sm font-semibold text-slate-300 mb-4">Spend Distribution</h3>
            {pieData.length>0?<ResponsiveContainer width="100%" height={240}><PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2} dataKey="value">{pieData.map((e,i)=><Cell key={i} fill={e.color} stroke="transparent"/>)}</Pie><Tooltip content={<Tip/>}/></PieChart></ResponsiveContainer>:<div className="flex items-center justify-center h-40 text-slate-600 text-sm">No data</div>}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">{pieData.map((d,i)=><div key={i} className="flex items-center gap-1.5 text-xs text-slate-400"><div className="w-2 h-2 rounded-full" style={{background:d.color}}/>{d.name}</div>)}</div>
          </div>
          <div className="rounded-xl p-5 border border-white/5" style={{background:'rgba(15,23,42,0.6)'}}>
            <h3 className="text-sm font-semibold text-slate-300 mb-4">Budget vs Actual</h3>
            <ResponsiveContainer width="100%" height={270}><BarChart data={barData}><CartesianGrid stroke="rgba(255,255,255,0.04)"/><XAxis dataKey="name" tick={{fill:'#64748B',fontSize:9}} axisLine={false} angle={-35} textAnchor="end" height={60}/><YAxis tick={{fill:'#64748B',fontSize:11}} axisLine={false} tickFormatter={v=>'$'+(v/1000).toFixed(0)+'k'}/><Tooltip content={<Tip/>}/><Bar dataKey="budget" name="Budget" fill="#1E3A5F" radius={[4,4,0,0]}/><Bar dataKey="actual" name="Actual" fill="#14B8A6" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer>
          </div>
        </div>
        {alerts.length>0&&<div className="rounded-xl p-5 border border-red-500/10" style={{background:'rgba(127,29,29,0.1)'}}>
          <h3 className="text-sm font-semibold text-red-300 mb-3">⚠ Spending Alerts</h3>
          {alerts.map((a,i)=>{const p=a.actual/a.annual,l=getAlert(p);return<div key={i} className="flex items-center justify-between px-4 py-2.5 rounded-lg mb-2" style={{background:'rgba(255,255,255,0.03)'}}><div className="flex items-center gap-3"><AlertBadge level={l}/><span className="text-sm font-medium">{a.category}</span></div><div className="text-right"><span className="text-sm font-semibold" style={{color:l==='critical'?'#F87171':'#FBBF24'}}>{fmtPct(p)}</span><span className="text-xs text-slate-500 ml-2">{fmt(a.actual)} / {fmt(a.annual)}</span></div></div>;})}
        </div>}
      </div>}

      {/* CATEGORIES with drill-down */}
      {tab==='categories'&&!drillSub&&<div className="space-y-6">
        {canEditBudget && <div className="flex items-center gap-3">
          {budgetDirty && <button onClick={saveBudgets} className="px-4 py-2 rounded-lg text-sm font-semibold text-white animate-pulse" style={{background:'#0F766E'}}>Save Budget Changes</button>}
          <button onClick={()=>setShowAddBudget(!showAddBudget)} className="px-4 py-2 rounded-lg text-sm text-cyan-300 bg-cyan-900/20 border border-cyan-800/30">+ Add Budget Line</button>
          <label className="px-4 py-2 rounded-lg text-sm font-semibold text-amber-300 bg-amber-900/20 border border-amber-800/30 cursor-pointer hover:bg-amber-900/40 transition-colors">
            {budgetUploading ? 'Uploading...' : '📁 Upload Budget Excel'}
            <input type="file" accept=".xlsx,.xls" onChange={handleBudgetUpload} className="hidden" disabled={budgetUploading}/>
          </label>
        </div>}
        {showAddBudget && canEditBudget && <div className="rounded-xl p-4 border border-cyan-800/30" style={{background:'rgba(14,116,144,0.05)'}}>
          <CostElementPicker value={newBudget} onChange={v=>setNewBudget({...newBudget,...v})} />
          <div className="flex gap-3 mt-3 items-end"><div><label className="block text-xs text-slate-400 mb-1">Annual Budget USD</label><input type="number" value={newBudget.annual_budget} onChange={e=>setNewBudget({...newBudget,annual_budget:parseFloat(e.target.value)||0})} className={`w-40 ${inp}`}/></div>
            <button onClick={addBudgetLine} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{background:'#0F766E'}}>Add</button><button onClick={()=>setShowAddBudget(false)} className="px-4 py-2 text-sm text-slate-400">Cancel</button></div>
        </div>}
        <div className="grid gap-3" style={{gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))'}}>
          {categories.map((cat,idx)=>{const p=cat.annual>0?cat.actual/cat.annual:0;const l=getAlert(p);const sel=selectedCat===cat.category;return(
            <div key={idx} onClick={()=>setSelectedCat(sel?null:cat.category)} className="rounded-xl p-4 border cursor-pointer transition-all hover:border-white/15" style={{background:sel?'rgba(14,116,144,0.1)':'rgba(15,23,42,0.6)',borderColor:sel?'rgba(14,116,144,0.4)':'rgba(255,255,255,0.05)'}}>
              <div className="flex items-center justify-between mb-3"><span className="text-sm font-semibold">{cat.category}</span><AlertBadge level={l}/></div>
              <div className="flex justify-between text-xs text-slate-500 mb-2"><span>Spent: {fmt(cat.actual)}</span><span>Budget: {fmt(cat.annual)}</span></div>
              <div className="w-full h-2 rounded-full overflow-hidden bg-white/5"><div className="h-full rounded-full" style={{width:`${Math.min(p*100,100)}%`,background:l==='critical'?'#EF4444':l==='warning'?'#F59E0B':'#14B8A6'}}/></div>
              <div className="text-right text-xs mt-1 font-mono" style={{color:l==='critical'?'#F87171':l==='warning'?'#FBBF24':'#5EEAD4'}}>{fmtPct(p)}</div>
            </div>);})}
        </div>
        {detail&&detail.subs.length>0&&<div className="rounded-xl p-5 border border-cyan-800/30" style={{background:'rgba(14,116,144,0.05)'}}>
          <h3 className="text-sm font-semibold text-cyan-300 mb-4">{detail.category} — click sub-category to see indents</h3>
          <table className="w-full text-xs"><thead><tr className="border-b border-white/10">
            <th className="px-3 py-2 text-left text-slate-500">Sub-category</th><th className="px-3 py-2 text-right text-blue-400">HO</th><th className="px-3 py-2 text-right text-purple-400">Outport</th><th className="px-3 py-2 text-right text-amber-400">C/F</th><th className="px-3 py-2 text-right text-slate-300">Total</th>
            <th className="px-3 py-2 text-right text-slate-500">Mth Target</th><th className="px-3 py-2 text-right text-slate-500">Mth %</th>
            <th className="px-3 py-2 text-right text-slate-500">Budget</th><th className="px-3 py-2 text-right text-slate-400">%</th>
          </tr></thead><tbody>{detail.subs.map((s,i)=>{
            const sp=s.annual>0?s.actual/s.annual:0;const mT=s.annual*(currentMonth/12);const mP=mT>0?s.actual/mT:0;
            const mC=mP>1?'#F87171':mP>0.8?'#FBBF24':'#34D399';const tC=sp>1?'#F87171':sp>0.5?'#FBBF24':'#34D399';
            const budgetIdx=budgets.findIndex(b=>b.sub_category===s.name);
            return<tr key={i} className="border-b border-white/[0.03] hover:bg-cyan-900/10 cursor-pointer">
              <td className="px-3 py-2 text-cyan-300 underline decoration-dotted" onClick={()=>setDrillSub(s.name)}>{s.name||'—'}</td>
              <td className="px-3 py-2 text-right font-mono text-blue-300">{fmt(s.ho)}</td>
              <td className="px-3 py-2 text-right font-mono text-purple-300">{fmt(s.outport)}</td>
              <td className="px-3 py-2 text-right font-mono text-amber-300">{fmt(s.cf)}</td>
              <td className="px-3 py-2 text-right font-mono text-slate-200 font-semibold">{fmt(s.actual)}</td>
              <td className="px-3 py-2 text-right font-mono text-slate-500">{fmt(mT)}</td>
              <td className="px-3 py-2 text-right font-mono font-semibold" style={{color:mC}}>{fmtPct(mP)}</td>
              <td className="px-3 py-2 text-right">{canEditBudget && budgetIdx>=0 ?
                <input type="number" value={budgets[budgetIdx].annual_budget} onChange={e=>{handleBudgetChange(budgetIdx,e.target.value);}} onClick={e=>e.stopPropagation()}
                  className="w-24 px-2 py-1 rounded bg-slate-800/50 border border-white/10 text-slate-200 text-xs text-right font-mono focus:outline-none focus:border-cyan-600"/>
                : <span className="font-mono text-slate-500">{fmt(s.annual)}</span>}</td>
              <td className="px-3 py-2 text-right font-mono font-semibold" style={{color:tC}}>{fmtPct(sp)}</td>
            </tr>})}</tbody></table>
        </div>}
      </div>}

      {/* SUB-CATEGORY DRILL-DOWN */}
      {tab==='categories'&&drillSub&&<div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={()=>setDrillSub(null)} className="px-3 py-1.5 rounded-lg text-xs text-cyan-300 bg-cyan-900/20 border border-cyan-800/30">← Back</button>
          <h2 className="text-lg font-bold text-slate-100">{drillSub}</h2>
          <span className="text-xs text-slate-500">{drillIndents.length} indent(s)</span>
        </div>
        <div className="rounded-xl border border-white/5 overflow-hidden" style={{background:'rgba(15,23,42,0.6)'}}>
          <table className="w-full text-sm"><thead><tr className="border-b border-white/6">
            {['Indent #','Title','Lines','Source','Status','Cost USD'].map(h=><th key={h} className="px-4 py-3 text-left text-xs text-slate-600 uppercase">{h}</th>)}
          </tr></thead><tbody>{drillIndents.map((ind,i)=>(
            <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.03] cursor-pointer transition-colors" onClick={()=>setSelectedIndent(ind)}>
              <td className="px-4 py-3 font-mono text-xs text-cyan-300">{ind.indent_number}</td>
              <td className="px-4 py-3 text-xs">{ind.title}</td>
              <td className="px-4 py-3 text-xs"><span className="px-2 py-0.5 rounded bg-slate-700/50 text-slate-400 text-[10px] font-mono">{ind.lines?.length || 1}</span></td>
              <td className="px-4 py-3 text-xs"><span className={`px-2 py-0.5 rounded text-xs ${ind.source==='HO'?'bg-blue-900/30 text-blue-300':'bg-purple-900/30 text-purple-300'}`}>{ind.source}{ind.is_carried_forward?' (C/F)':''}</span></td>
              <td className="px-4 py-3"><StatusBadge status={ind.status}/></td>
              <td className="px-4 py-3 text-right font-mono text-xs font-semibold">{fmt(Number(ind.cost_usd))}</td>
            </tr>
          ))}</tbody></table>
          <div className="px-4 py-3 text-xs text-right text-slate-600" style={{borderTop:'1px solid rgba(255,255,255,0.04)'}}>Total: {fmt(drillIndents.reduce((s,i)=>s+Number(i.cost_usd),0))}</div>
        </div>
      </div>}

      {/* INDENTS */}
      {tab==='indents'&&!hideIndents&&<div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex gap-1 rounded-lg p-1" style={{background:'rgba(255,255,255,0.04)'}}>
            {[{k:'HO',l:'HO Indents',c:ho.length},{k:'Outport',l:'Outport',c:op.length},{k:'CF',l:'Carried Forward',c:cf.length}].map(t=>(
              <button key={t.k} onClick={()=>{setIndentSrc(t.k);setStatusFilter('All');setSearchQ('');}} className="px-4 py-1.5 rounded-md text-xs font-semibold" style={{background:indentSrc===t.k?'rgba(14,116,144,0.3)':'transparent',color:indentSrc===t.k?'#67E8F9':'#94A3B8'}}>{t.l} ({t.c})</button>
            ))}
          </div>
          {canEdit&&<button onClick={()=>{resetForm();setForm(f=>({...f,source:indentSrc==='CF'?'HO':indentSrc}));setShowForm(!showForm);}} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{background:'linear-gradient(135deg,#0F766E,#0E7490)'}}>+ New Indent</button>}
        </div>

        <div className="grid grid-cols-4 gap-4">{Object.entries(STATUS_COLORS).map(([st,cl])=>(
          <div key={st} className="rounded-xl p-4 border border-white/5 text-center" style={{background:'rgba(15,23,42,0.6)'}}><div className="text-2xl font-bold" style={{color:cl}}>{statusCounts[st]||0}</div><div className="text-xs mt-1 uppercase text-slate-600">{st}</div></div>
        ))}</div>

        <div className="flex items-center gap-3 flex-wrap">
          <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Search by title, indent #, sub-category..." className={`${inp} max-w-xs`}/>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600">Status:</span>
            {['All','Estimate','On Order','Received','Invoiced'].map(s=><button key={s} onClick={()=>setStatusFilter(s)} className="px-3 py-1 rounded-md text-xs font-medium" style={{background:statusFilter===s?'rgba(14,116,144,0.3)':'rgba(255,255,255,0.04)',color:statusFilter===s?'#67E8F9':'#94A3B8'}}>{s}</button>)}
          </div>
        </div>

        {/* NEW INDENT FORM — MULTI-LINE */}
        {showForm&&canEdit&&<div className="rounded-xl p-5 border border-cyan-800/30" style={{background:'rgba(14,116,144,0.05)'}}>
          <h4 className="text-sm font-semibold text-cyan-300 mb-4">New Indent</h4>
          {/* Header fields */}
          <div className="grid grid-cols-5 gap-3 mb-4">
            <div><label className="block text-xs text-slate-400 mb-1">Indent #</label><input value={form.indent_number} onChange={e=>setForm({...form,indent_number:e.target.value})} className={inp}/></div>
            <div className="col-span-2"><label className="block text-xs text-slate-400 mb-1">Title</label><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} className={inp}/></div>
            <div><label className="block text-xs text-slate-400 mb-1">Source</label><select value={form.source} onChange={e=>setForm({...form,source:e.target.value})} className={inp}><option>HO</option><option>Outport</option></select></div>
            <div><label className="block text-xs text-slate-400 mb-1">Status</label><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} className={inp}><option>Estimate</option><option>On Order</option><option>Received</option><option>Invoiced</option></select></div>
          </div>

          {/* Line items */}
          <div className="flex items-center justify-between mb-3">
            <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Line Items ({formLines.length})</h5>
            <button onClick={addFormLine} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-cyan-300 bg-cyan-900/20 border border-cyan-800/30 hover:bg-cyan-900/40 transition-colors">+ Add Line</button>
          </div>

          <div className="space-y-3">
            {formLines.map((line, idx) => (
              <div key={idx} className="rounded-xl p-4 border border-white/5 relative" style={{background:'rgba(255,255,255,0.02)'}}>
                <div className="absolute -top-2 left-3 px-2 py-0.5 rounded text-[10px] font-bold text-slate-500 bg-slate-800 border border-white/5">LINE {idx+1}</div>
                {formLines.length > 1 && <button onClick={()=>removeFormLine(idx)} className="absolute -top-2 right-3 px-2 py-0.5 rounded text-[10px] font-bold text-red-400 bg-slate-800 border border-red-500/20 hover:bg-red-900/30 transition-colors">✕ Remove</button>}
                <div className="mb-3"><CostElementPicker value={{cost_group:line.cost_group,sub_category:line.sub_category}} onChange={v=>updateFormLinePicker(idx,v)}/></div>
                <div className="grid grid-cols-4 gap-3">
                  <div><label className="block text-xs text-slate-400 mb-1">Description</label><input value={line.description} onChange={e=>updateFormLine(idx,'description',e.target.value)} className={inp} placeholder="Optional"/></div>
                  <div><label className="block text-xs text-slate-400 mb-1">Cost USD</label><input type="number" value={line.cost_usd} onChange={e=>updateFormLine(idx,'cost_usd',parseFloat(e.target.value)||0)} className={inp}/></div>
                  {form.source==='Outport'&&<div><label className="block text-xs text-slate-400 mb-1">Cost NGN</label><input type="number" value={line.cost_local} onChange={e=>updateFormLine(idx,'cost_local',parseFloat(e.target.value)||0)} className={inp}/></div>}
                  <div><label className="block text-xs text-slate-400 mb-1">Marked Up</label><input type="number" value={line.cost_marked_up} onChange={e=>updateFormLine(idx,'cost_marked_up',parseFloat(e.target.value)||0)} className={inp}/></div>
                </div>
              </div>
            ))}
          </div>

          {/* Totals + submit */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
            <div className="flex items-center gap-4">
              <span className="text-xs text-slate-500">Indent Total:</span>
              <span className="text-lg font-bold text-cyan-300 font-mono">{fmt(formTotal)}</span>
              {formTotalLocal > 0 && <span className="text-sm font-bold text-purple-300 font-mono">₦{Number(formTotalLocal).toLocaleString()}</span>}
            </div>
            <div className="flex gap-3">
              <button onClick={submitIndent} className="px-5 py-2 rounded-lg text-sm font-semibold text-white" style={{background:'#0F766E'}}>Submit Indent</button>
              <button onClick={()=>{setShowForm(false);resetForm();}} className="px-4 py-2 text-sm text-slate-400">Cancel</button>
            </div>
          </div>
        </div>}

        {/* INDENT TABLE — EXPANDABLE ROWS */}
        <div className="rounded-xl border border-white/5 overflow-hidden" style={{background:'rgba(15,23,42,0.6)'}}>
          <table className="w-full text-sm"><thead><tr style={{borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
            {['','Indent #','Title','Lines','Status',indentSrc==='Outport'?'NGN':'','Cost USD'].filter(Boolean).map(h=><th key={h} className="px-4 py-3 text-left text-xs text-slate-600 uppercase">{h}</th>)}
          </tr></thead><tbody>{filtered.map((ind,i)=>{
            const isExpanded = expandedIndent === ind.id;
            const lineCount = ind.lines?.length || 1;
            return <React.Fragment key={ind.id}>
              {/* Main indent row */}
              <tr className="hover:bg-white/[0.03] transition-colors" style={{borderBottom: isExpanded ? 'none' : '1px solid rgba(255,255,255,0.03)'}}>
                <td className="px-2 py-3 w-8">
                  {lineCount > 1 && <button onClick={()=>setExpandedIndent(isExpanded?null:ind.id)} className="w-6 h-6 rounded flex items-center justify-center text-xs text-slate-500 hover:text-cyan-300 hover:bg-white/5 transition-colors">
                    {isExpanded ? '▾' : '▸'}
                  </button>}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-cyan-300 cursor-pointer" onClick={()=>setSelectedIndent(ind)}>{ind.indent_number}</td>
                <td className="px-4 py-3 text-xs max-w-xs truncate cursor-pointer" onClick={()=>setSelectedIndent(ind)}>{ind.title}</td>
                <td className="px-4 py-3 text-xs">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${lineCount>1?'bg-cyan-900/30 text-cyan-300 border border-cyan-800/30':'bg-slate-700/50 text-slate-500'}`}>
                    {lineCount} {lineCount>1?'lines':'line'}
                  </span>
                </td>
                <td className="px-4 py-3"><StatusBadge status={ind.status}/></td>
                {indentSrc==='Outport'&&<td className="px-4 py-3 text-right text-xs font-mono text-slate-400">{Number(ind.cost_local||ind.total_local||0).toLocaleString()}</td>}
                <td className="px-4 py-3 text-right font-mono text-xs font-semibold">{fmt(Number(ind.cost_usd))}</td>
              </tr>
              {/* Expanded line items */}
              {isExpanded && (ind.lines||[]).map((line, li) => (
                <tr key={`${ind.id}-L${li}`} className="bg-white/[0.01]" style={{borderBottom: li === (ind.lines.length-1) ? '1px solid rgba(255,255,255,0.03)' : '1px solid rgba(255,255,255,0.01)'}}>
                  <td className="pl-6 pr-2 py-2 text-right"><span className="text-[9px] text-slate-600 font-mono">L{li+1}</span></td>
                  <td className="px-4 py-2 text-[11px] text-slate-600 font-mono">{line.cost_element_code||''}</td>
                  <td className="px-4 py-2 text-[11px] text-slate-400">{line.cost_group} → {line.sub_category}</td>
                  <td className="px-4 py-2 text-[11px] text-slate-500">{line.description||''}</td>
                  <td></td>
                  {indentSrc==='Outport'&&<td className="px-4 py-2 text-right text-[11px] font-mono text-slate-500">{Number(line.cost_local||0).toLocaleString()}</td>}
                  <td className="px-4 py-2 text-right font-mono text-[11px] text-slate-400">{fmt(Number(line.cost_usd))}</td>
                </tr>
              ))}
            </React.Fragment>;
          })}</tbody></table>
          <div className="px-4 py-3 text-xs text-right text-slate-600" style={{borderTop:'1px solid rgba(255,255,255,0.04)'}}>{filtered.length} indent(s) · Total: {fmt(filtered.reduce((s,i)=>s+Number(i.cost_usd),0))}</div>
        </div>
      </div>}

      {/* ALERTS */}
      {tab==='alerts'&&<div className="space-y-6">
        <div className="rounded-xl p-5 border border-white/5" style={{background:'rgba(15,23,42,0.6)'}}>
          <p className="text-xs text-slate-500">Week {week}: target {fmtPct(targetPct)}. Month {currentMonth}: monthly target {fmtPct(currentMonth/12)}. Warning at 130% of weekly target. Critical at 100%+ annual.</p>
        </div>
        {categories.map((cat,idx)=>{const p=cat.annual>0?cat.actual/cat.annual:0;const l=getAlert(p);const d=cat.actual-(cat.annual*targetPct);return(
          <div key={idx} className="rounded-xl p-4 border flex items-center gap-4" style={{background:l==='critical'?'rgba(127,29,29,0.1)':l==='warning'?'rgba(120,83,9,0.08)':'rgba(15,23,42,0.6)',borderColor:l==='critical'?'rgba(239,68,68,0.2)':l==='warning'?'rgba(245,158,11,0.2)':'rgba(255,255,255,0.05)'}}>
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{background:l==='critical'?'#EF4444':l==='warning'?'#F59E0B':'#10B981'}}/>
            <div className="flex-1"><div className="text-sm font-semibold">{cat.category}</div><div className="text-xs text-slate-600">{fmt(cat.actual)} of {fmt(cat.annual)}</div></div>
            <div className="text-right"><div className="text-sm font-bold font-mono" style={{color:l==='critical'?'#F87171':l==='warning'?'#FBBF24':'#34D399'}}>{fmtPct(p)}</div><div className="text-xs font-mono" style={{color:d>0?'#F87171':'#34D399'}}>{d>0?'+':''}{fmt(d)} vs target</div></div>
          </div>);})}
      </div>}

      {/* BPR */}
      {tab==='bpr'&&<div className="space-y-5">
        <div className="rounded-xl p-5 border border-white/5" style={{background:'rgba(15,23,42,0.6)'}}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-300">BPR Comparison</h3>
              {bprMeta && <p className="text-xs text-slate-500 mt-1">Uploaded by {bprMeta.uploaded_by||'Unknown'} · {bprMeta.filename||''} · {bprMeta.uploaded_at?new Date(bprMeta.uploaded_at).toLocaleDateString():''}</p>}
              {!bprMeta && !bprLoading && <p className="text-xs text-slate-500 mt-1">{canEditBudget?'Upload a monthly BPR Excel to compare':'No BPR data yet. Contact superintendent.'}</p>}
            </div>
            {canEditBudget&&<label className="px-4 py-2 rounded-lg text-sm font-semibold text-white cursor-pointer hover:opacity-90" style={{background:'linear-gradient(135deg,#0F766E,#0E7490)'}}>{bprLoading?'Processing...':'📁 Upload BPR Excel'}<input type="file" accept=".xlsx,.xls,.csv" onChange={handleBPRUpload} className="hidden" disabled={bprLoading}/></label>}
            {!canEditBudget&&!bprData&&!bprLoading&&<button onClick={loadLatestBPR} className="px-4 py-2 rounded-lg text-sm text-cyan-300 bg-cyan-900/20 border border-cyan-800/30">Refresh</button>}
          </div>
          {bprData&&<div className="grid grid-cols-5 gap-3 mt-4">
            <div className="rounded-lg p-3 bg-white/[0.03]"><div className="text-[10px] text-slate-500 uppercase">BPR Budget</div><div className="text-lg font-bold text-cyan-300 mt-1">{fmt(bprData.summary.total_bpr_budget)}</div></div>
            <div className="rounded-lg p-3 bg-white/[0.03]"><div className="text-[10px] text-slate-500 uppercase">BPR Actual</div><div className="text-lg font-bold text-cyan-200 mt-1">{fmt(bprData.summary.total_bpr_actual)}</div></div>
            <div className="rounded-lg p-3 bg-white/[0.03]"><div className="text-[10px] text-slate-500 uppercase">Dashboard Actual</div><div className="text-lg font-bold text-emerald-300 mt-1">{fmt(bprData.summary.total_dashboard_actual)}</div></div>
            <div className="rounded-lg p-3 bg-white/[0.03]"><div className="text-[10px] text-slate-500 uppercase">Matched</div><div className="text-lg font-bold text-blue-300 mt-1">{bprData.summary.matched}</div></div>
            <div className="rounded-lg p-3 bg-white/[0.03]"><div className="text-[10px] text-slate-500 uppercase">Unmatched</div><div className="text-lg font-bold text-amber-300 mt-1">{bprData.summary.unmatched+bprData.summary.missing}</div></div>
          </div>}
        </div>
        {bprData&&<>
          <div className="flex items-center gap-3 flex-wrap">
            <input value={bprSearch} onChange={e=>setBprSearch(e.target.value)} placeholder="Search..." className={`${inp} max-w-xs`}/>
            <div className="flex items-center gap-1 flex-wrap">
              {['All','match','bpr_higher','dashboard_higher','unmatched','missing_from_bpr'].map(s=>(
                <button key={s} onClick={()=>setBprFilter(s)} className="px-2.5 py-1 rounded-md text-xs font-medium" style={{background:bprFilter===s?'rgba(14,116,144,0.3)':'rgba(255,255,255,0.04)',color:bprFilter===s?'#67E8F9':'#94A3B8'}}>
                  {s==='All'?'All':s==='match'?'Match':s==='bpr_higher'?'BPR Higher':s==='dashboard_higher'?'Dash Higher':s==='unmatched'?'Not in Dash':'Not in BPR'}
                </button>))}
            </div>
            {canEditBudget&&bprData.comparison.filter(c=>c.status==='unmatched').length>0&&(
              <button onClick={async()=>{const u=bprData.comparison.filter(c=>c.status==='unmatched');if(!confirm(`Import ${u.length} unmatched items?`))return;try{await api.importBPRItems(vesselId,u.map(c=>({code:c.code,name:c.sub_category,approved_budget:c.bpr_budget,cost_group:c.cost_group})),budgetYear);alert(`${u.length} items imported.`);loadAll();}catch(e){alert(e.message);}}} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-300 bg-emerald-900/20 border border-emerald-800/30 hover:bg-emerald-900/40 ml-auto">Import All Unmatched ({bprData.comparison.filter(c=>c.status==='unmatched').length})</button>
            )}
          </div>
          <div className="rounded-xl border border-white/5 overflow-x-auto" style={{background:'rgba(15,23,42,0.6)'}}>
            <table className="w-full text-xs"><thead><tr className="border-b border-white/6">
              {['Code','Sub-Category','Cost Group','BPR Budget','BPR Actual','Dash Budget','Dash Actual','Actual Diff','Budget Diff','Status',''].map(h=>(
                <th key={h} className="px-3 py-3 text-left text-[10px] text-slate-500 uppercase whitespace-nowrap">{h}</th>))}
            </tr></thead><tbody>{
              bprData.comparison.filter(c=>bprFilter==='All'||c.status===bprFilter).filter(c=>!bprSearch||c.sub_category.toLowerCase().includes(bprSearch.toLowerCase())||(c.code||'').includes(bprSearch)||(c.cost_group||'').toLowerCase().includes(bprSearch.toLowerCase())).map((c,i)=>{
                const diffColor=c.status==='match'?'#34D399':c.status==='bpr_higher'?'#F59E0B':c.status==='dashboard_higher'?'#3B82F6':'#F87171';
                const statusLabel=c.status==='match'?'Match':c.status==='bpr_higher'?'BPR Higher':c.status==='dashboard_higher'?'Dash Higher':c.status==='unmatched'?'Not in Dash':'Not in BPR';
                const statusBg=c.status==='match'?'bg-emerald-900/30 text-emerald-300':c.status==='bpr_higher'?'bg-amber-900/30 text-amber-300':c.status==='dashboard_higher'?'bg-blue-900/30 text-blue-300':'bg-red-900/30 text-red-300';
                const bdColor=c.budget_diff>1?'#F59E0B':c.budget_diff<-1?'#3B82F6':'#34D399';
                return(<tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  <td className="px-3 py-2 font-mono text-slate-500">{c.code}</td><td className="px-3 py-2 text-slate-200 max-w-[200px] truncate">{c.sub_category}</td><td className="px-3 py-2 text-slate-500">{c.cost_group}</td>
                  <td className="px-3 py-2 text-right font-mono text-cyan-300">{fmt(c.bpr_budget)}</td><td className="px-3 py-2 text-right font-mono text-cyan-200">{fmt(c.bpr_actual)}</td>
                  <td className="px-3 py-2 text-right font-mono text-slate-400">{fmt(c.dashboard_budget)}</td><td className="px-3 py-2 text-right font-mono text-emerald-300">{fmt(c.dashboard_actual)}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold" style={{color:diffColor}}>{c.difference>0?'+':''}{fmt(c.difference)}</td>
                  <td className="px-3 py-2 text-right font-mono" style={{color:bdColor}}>{c.budget_diff>0?'+':''}{fmt(c.budget_diff)}</td>
                  <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${statusBg}`}>{statusLabel}</span></td>
                  <td className="px-3 py-2">{c.status==='unmatched'&&canEditBudget&&(
                    <button onClick={async()=>{try{await api.importBPRItems(vesselId,[{code:c.code,name:c.sub_category,approved_budget:c.bpr_budget,cost_group:c.cost_group}],budgetYear);const u={...bprData};const idx=u.comparison.findIndex(x=>x.code===c.code&&x.sub_category===c.sub_category);if(idx>=0)u.comparison[idx]={...u.comparison[idx],status:'match',dashboard_budget:c.bpr_budget};setBprData({...u});loadAll();}catch(e){alert(e.message);}}} className="px-2 py-0.5 rounded text-[10px] font-medium text-emerald-300 bg-emerald-900/30 border border-emerald-800/30 hover:bg-emerald-900/50 whitespace-nowrap">+ Add</button>
                  )}</td>
                </tr>);})
            }</tbody></table>
            <div className="px-3 py-3 text-xs text-right text-slate-600" style={{borderTop:'1px solid rgba(255,255,255,0.04)'}}>{bprData.comparison.filter(c=>bprFilter==='All'||c.status===bprFilter).length} items</div>
          </div>
        </>}
        {!bprData&&!bprLoading&&<div className="text-center py-16 text-slate-600 text-sm">{canEditBudget?'Upload a BPR Excel to begin':'No BPR data yet. Contact superintendent.'}</div>}
        {bprLoading&&<div className="text-center py-16 text-slate-500 text-sm">Loading...</div>}
      </div>}

      {/* INDENT EDIT/DELETE MODAL */}
      <IndentDetailModal
        indent={selectedIndent}
        costGroups={costGroups}
        vesselId={vesselId}
        onClose={()=>setSelectedIndent(null)}
        onSave={async(vId,indentId,data)=>{await api.updateIndent(vId,indentId,data);setSelectedIndent(null);loadAll();}}
        onDelete={async(vId,indentId)=>{await api.deleteIndent(vId,indentId);setSelectedIndent(null);loadAll();}}
      />
    </div>
  );
}
