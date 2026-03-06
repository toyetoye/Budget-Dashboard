import React, { useState, createContext, useContext } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import api from './api';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import AdminVessels from './pages/AdminVessels';
import AdminBudgets from './pages/AdminBudgets';
import AdminUsers from './pages/AdminUsers';
import VesselDashboard from './pages/VesselDashboard';
import VesselDetail from './pages/VesselDetail';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

function ProtectedRoute({ children, roles }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to={user.role === 'vessel' ? '/vessel' : '/admin'} />;
  return children;
}

function Sidebar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const r = user?.role;
  const links = r === 'admin' ? [
    { path: '/admin', label: 'Fleet Overview', icon: '⊞' },
    { path: '/admin/vessels', label: 'Manage Vessels', icon: '⚓' },
    { path: '/admin/budgets', label: 'Budgets', icon: '◉' },
    { path: '/admin/users', label: 'Users', icon: '◈' },
  ] : r === 'superintendent' ? [
    { path: '/admin', label: 'Fleet Overview', icon: '⊞' },
    { path: '/admin/budgets', label: 'Budgets', icon: '◉' },
  ] : r === 'manager' ? [
    { path: '/admin', label: 'Fleet Overview', icon: '⊞' },
  ] : [
    { path: '/vessel', label: 'Dashboard', icon: '⊞' },
  ];

  return (
    <div className="w-56 min-h-screen flex flex-col border-r border-white/5 sticky top-0 h-screen overflow-y-auto" style={{ background: 'rgba(8,15,30,0.95)' }}>
      <div className="p-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg,#0F766E,#0E7490)' }}>FB</div>
          <div><div className="text-sm font-bold text-slate-100">Fleet Budget</div><div className="text-[10px] text-slate-500 uppercase tracking-widest">{r}</div></div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {links.map(l => (
          <button key={l.path} onClick={() => navigate(l.path)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${loc.pathname === l.path ? 'bg-cyan-900/30 text-cyan-300' : 'text-slate-400 hover:bg-white/5'}`}>
            <span className="text-base">{l.icon}</span>{l.label}
          </button>
        ))}
      </nav>
      <div className="p-4 border-t border-white/5">
        <div className="text-xs text-slate-500 mb-1">{user?.display_name}</div>
        <button onClick={api.logout} className="text-xs text-red-400 hover:text-red-300">Sign Out</button>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(api.getUser());
  const loc = useLocation();
  return (
    <AuthContext.Provider value={{ user, setUser }}>
      <div className="flex min-h-screen font-sans text-slate-200" style={{ background: 'linear-gradient(180deg,#0B1120 0%,#0F172A 40%,#111827 100%)' }}>
        {user && loc.pathname !== '/login' && <Sidebar />}
        <div className="flex-1 overflow-auto">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/admin" element={<ProtectedRoute roles={['admin','superintendent','manager']}><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/vessels" element={<ProtectedRoute roles={['admin']}><AdminVessels /></ProtectedRoute>} />
            <Route path="/admin/budgets" element={<ProtectedRoute roles={['admin','superintendent']}><AdminBudgets /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute roles={['admin']}><AdminUsers /></ProtectedRoute>} />
            <Route path="/admin/vessel/:id" element={<ProtectedRoute roles={['admin','superintendent','manager']}><VesselDetail /></ProtectedRoute>} />
            <Route path="/vessel" element={<ProtectedRoute roles={['vessel']}><VesselDashboard /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to={user?.role === 'vessel' ? '/vessel' : user ? '/admin' : '/login'} />} />
          </Routes>
        </div>
      </div>
    </AuthContext.Provider>
  );
}
