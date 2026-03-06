const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'fleet-budget-secret-change-me';

function generateToken(user) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role, vessel_id: user.vessel_id, vessel_ids: user.vessel_ids || [], display_name: user.display_name }, SECRET, { expiresIn: '24h' });
}
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token' });
  try { req.user = jwt.verify(header.replace('Bearer ', ''), SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid token' }); }
}
function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}
function canEditBudgets(req, res, next) {
  if (['admin', 'superintendent'].includes(req.user.role)) return next();
  res.status(403).json({ error: 'Admin or Superintendent required' });
}
function canViewFleet(req, res, next) {
  if (['admin', 'superintendent', 'manager'].includes(req.user.role)) return next();
  res.status(403).json({ error: 'Access denied' });
}
module.exports = { generateToken, authenticate, adminOnly, canEditBudgets, canViewFleet, SECRET };
