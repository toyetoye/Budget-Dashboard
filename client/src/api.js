const BASE = '/api';
const getToken = () => localStorage.getItem('token');
const setToken = t => localStorage.setItem('token', t);
const getUser = () => { const u = localStorage.getItem('user'); return u ? JSON.parse(u) : null; };
const setUser = u => localStorage.setItem('user', JSON.stringify(u));

async function apiFetch(path, opts = {}) {
  const token = getToken();
  const res = await fetch(BASE + path, { ...opts, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers } });
  if (res.status === 401) { localStorage.clear(); window.location.href = '/login'; throw new Error('Unauthorized'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const api = {
  login: async (u, p) => { const d = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }) }); setToken(d.token); setUser(d.user); return d; },
  logout: () => { localStorage.clear(); window.location.href = '/login'; },
  getUser, getToken,
  listUsers: () => apiFetch('/auth/users'),
  createUser: u => apiFetch('/auth/users', { method: 'POST', body: JSON.stringify(u) }),
  updateUser: (id, u) => apiFetch(`/auth/users/${id}`, { method: 'PUT', body: JSON.stringify(u) }),
  deleteUser: id => apiFetch(`/auth/users/${id}`, { method: 'DELETE' }),
  listVessels: () => apiFetch('/vessels'),
  getVessel: id => apiFetch(`/vessels/${id}`),
  createVessel: v => apiFetch('/vessels', { method: 'POST', body: JSON.stringify(v) }),
  updateVessel: (id, v) => apiFetch(`/vessels/${id}`, { method: 'PUT', body: JSON.stringify(v) }),
  deleteVessel: id => apiFetch(`/vessels/${id}`, { method: 'DELETE' }),
  fleetOverview: () => apiFetch('/vessels/admin/fleet-overview'),
  getBudgets: (vid, yr) => apiFetch(`/budgets/${vid}?year=${yr || 2024}`),
  setBudgets: (vid, budgets, yr) => apiFetch(`/budgets/${vid}`, { method: 'POST', body: JSON.stringify({ budgets, year: yr }) }),
  uploadBudget: async (vesselId, file, year, replace) => {
    const token = getToken();
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`/api/budgets/${vesselId}/upload?year=${year || 2024}&replace=${replace ? 'true' : 'false'}`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data;
  },
  getIndents: (vid, filters = {}) => { const p = new URLSearchParams(filters).toString(); return apiFetch(`/indents/${vid}${p ? '?' + p : ''}`); },
  createIndent: (vid, i) => apiFetch(`/indents/${vid}`, { method: 'POST', body: JSON.stringify(i) }),
  updateIndent: (vid, id, i) => apiFetch(`/indents/${vid}/${id}`, { method: 'PUT', body: JSON.stringify(i) }),
  getCostGroups: () => apiFetch('/costs'),

  // BPR
  uploadBPR: async (vesselId, file, year) => {
    const token = getToken();
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`/api/bpr/${vesselId}/compare?year=${year || 2024}`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data;
  },
  importBPRItems: (vesselId, items, year) => apiFetch(`/api/bpr/${vesselId}/import`, { method: 'POST', body: JSON.stringify({ items, year }) }),
  getLatestBPR: (vesselId, year) => apiFetch(`/bpr/${vesselId}/latest?year=${year || 2024}`),
};export default api;
