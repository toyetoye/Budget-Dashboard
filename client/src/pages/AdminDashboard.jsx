import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../api';

const fmt = n => '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
const fmtPct = n => (n * 100).toFixed(1) + '%';
const Tip = ({ active, payload, label }) => !active || !payload?.length ? null : (
  <div className="rounded-lg px-3 py-2 text-xs border border-white/10" style={{ background: 'rgba(15,23,42,0.95)' }}>
    <div className="text-slate-400 mb-1">{label}</div>
    {payload.map((p, i) => <div key={i} style={{ color: p.color }} className="font-semibold">{p.name}: {fmt(p.value)}</div>)}
  </div>
);

export default function AdminDashboard() {
  const [fleet, setFleet] = useState([]); const [loading, setLoading] = useState(true);
  const nav = useNavigate();
  useEffect(() => { api.fleetOverview().then(setFleet).finally(() => setLoading(false)); }, []);
  const totalBudget = fleet.reduce((s, v) => s + Number(v.total_budget), 0);
  const totalSpent = fleet.reduce((s, v) => s + Number(v.total_spent), 0);
  const barData = fleet.map(v => ({ name: v.name.replace(/^(LPG|LNG)\s+/, ''), budget: Number(v.total_budget), spent: Number(v.total_spent) }));

  if (loading) return <div className="flex items-center justify-center h-screen text-slate-500 text-sm">Loading...</div>;
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div><h1 className="text-xl font-bold text-slate-100">Fleet Overview</h1></div>
      <div className="grid grid-cols-4 gap-4">
        {[{ l: 'Vessels', v: fleet.length, c: '#67E8F9' }, { l: 'Fleet Budget', v: fmt(totalBudget), c: '#A78BFA' }, { l: 'Total Spent', v: fmt(totalSpent), c: '#34D399' }, { l: 'Indents', v: fleet.reduce((s, v) => s + Number(v.indent_count), 0), c: '#FBBF24' }].map((k, i) => (
          <div key={i} className="rounded-xl p-5 border border-white/5" style={{ background: 'linear-gradient(135deg,rgba(15,23,42,0.9),rgba(30,41,59,0.7))' }}>
            <div className="text-xs uppercase tracking-widest text-slate-500 mb-2">{k.l}</div>
            <div className="text-2xl font-bold" style={{ color: k.c }}>{k.v}</div>
          </div>
        ))}
      </div>
      {barData.length > 0 && (
        <div className="rounded-xl p-5 border border-white/5" style={{ background: 'rgba(15,23,42,0.6)' }}>
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Budget vs Spend</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={barData}><XAxis dataKey="name" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} /><YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickFormatter={v => '$' + (v / 1000).toFixed(0) + 'k'} /><Tooltip content={<Tip />} /><Bar dataKey="budget" name="Budget" fill="#1E3A5F" radius={[4, 4, 0, 0]} /><Bar dataKey="spent" name="Spent" fill="#14B8A6" radius={[4, 4, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-300">Vessels — click to view details</h3>
        {fleet.map(v => {
          const pct = v.total_budget > 0 ? Number(v.total_spent) / Number(v.total_budget) : 0;
          return (
            <div key={v.id} onClick={() => nav(`/admin/vessel/${v.id}`)} className="rounded-xl p-5 border border-white/5 hover:border-cyan-800/40 cursor-pointer transition-all" style={{ background: 'rgba(15,23,42,0.6)' }}>
              <div className="flex items-center justify-between mb-3">
                <div><span className="text-sm font-semibold text-slate-100">{v.name}</span>{v.imo && <span className="text-xs text-slate-500 ml-2">IMO {v.imo}</span>}</div>
                <div className="text-right"><span className="text-sm font-bold font-mono" style={{ color: pct > 0.5 ? '#F87171' : '#34D399' }}>{fmtPct(pct)}</span><div className="text-xs text-slate-500">{fmt(Number(v.total_spent))} / {fmt(Number(v.total_budget))}</div></div>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden bg-white/5"><div className="h-full rounded-full" style={{ width: `${Math.min(pct * 100, 100)}%`, background: pct > 0.8 ? '#EF4444' : '#14B8A6' }} /></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
