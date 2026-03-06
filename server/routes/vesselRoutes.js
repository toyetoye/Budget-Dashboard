const express = require('express');
const { pool } = require('../db');
const { authenticate, adminOnly, canEditBudgets, canViewFleet } = require('../auth');
const router = express.Router();

router.get('/admin/fleet-overview', authenticate, canViewFleet, async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear();
    let r;
    if (req.user.role === 'superintendent') {
      const ids = req.user.vessel_ids || (req.user.vessel_id ? [req.user.vessel_id] : []);
      if (!ids.length) return res.json([]);
      r = await pool.query(`
        SELECT v.id, v.name, v.imo, v.vessel_type,
          COALESCE(b.total_budget,0) as total_budget, COALESCE(i.total_spent,0) as total_spent, COALESCE(i.indent_count,0) as indent_count
        FROM vessels v
        LEFT JOIN (SELECT vessel_id, SUM(annual_budget) as total_budget FROM budget_categories WHERE year=$1 GROUP BY vessel_id) b ON v.id=b.vessel_id
        LEFT JOIN (SELECT vessel_id, SUM(cost_usd) as total_spent, COUNT(*) as indent_count FROM indents GROUP BY vessel_id) i ON v.id=i.vessel_id
        WHERE v.active=true AND v.id = ANY($2) ORDER BY v.name`, [year, ids]);
    } else {
      r = await pool.query(`
        SELECT v.id, v.name, v.imo, v.vessel_type,
          COALESCE(b.total_budget,0) as total_budget, COALESCE(i.total_spent,0) as total_spent, COALESCE(i.indent_count,0) as indent_count
        FROM vessels v
        LEFT JOIN (SELECT vessel_id, SUM(annual_budget) as total_budget FROM budget_categories WHERE year=$1 GROUP BY vessel_id) b ON v.id=b.vessel_id
        LEFT JOIN (SELECT vessel_id, SUM(cost_usd) as total_spent, COUNT(*) as indent_count FROM indents GROUP BY vessel_id) i ON v.id=i.vessel_id
        WHERE v.active=true ORDER BY v.name`, [year]);
    }
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/', authenticate, async (req, res) => {
  try {
    let r;
    if (['admin','manager'].includes(req.user.role)) r = await pool.query('SELECT * FROM vessels WHERE active=true ORDER BY name');
    else if (req.user.role === 'superintendent') {
      const ids = req.user.vessel_ids || (req.user.vessel_id ? [req.user.vessel_id] : []);
      if (ids.length) r = await pool.query('SELECT * FROM vessels WHERE id = ANY($1) AND active=true ORDER BY name', [ids]);
      else r = { rows: [] };
    }
    else r = await pool.query('SELECT * FROM vessels WHERE id=$1 AND active=true', [req.user.vessel_id]);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const vid = parseInt(req.params.id);
    if (req.user.role === 'vessel' && req.user.vessel_id !== vid) return res.status(403).json({ error: 'Access denied' });
    if (req.user.role === 'superintendent') {
      const ids = req.user.vessel_ids || (req.user.vessel_id ? [req.user.vessel_id] : []);
      if (!ids.includes(vid)) return res.status(403).json({ error: 'Access denied' });
    }
    const r = await pool.query('SELECT * FROM vessels WHERE id=$1', [vid]);
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authenticate, adminOnly, async (req, res) => {
  try { const { name, imo, vessel_type } = req.body; res.status(201).json((await pool.query('INSERT INTO vessels (name,imo,vessel_type) VALUES ($1,$2,$3) RETURNING *', [name, imo||null, vessel_type||null])).rows[0]); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', authenticate, adminOnly, async (req, res) => {
  try { const { name, imo, vessel_type, active } = req.body; res.json((await pool.query('UPDATE vessels SET name=$1,imo=$2,vessel_type=$3,active=$4 WHERE id=$5 RETURNING *', [name, imo, vessel_type, active!==false, req.params.id])).rows[0]); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// Delete vessel and all associated data
router.delete('/:id', authenticate, adminOnly, async (req, res) => {
  const client = await pool.connect();
  try {
    const vid = req.params.id;
    await client.query('BEGIN');
    await client.query('DELETE FROM indents WHERE vessel_id=$1', [vid]);
    await client.query('DELETE FROM budget_categories WHERE vessel_id=$1', [vid]);
    await client.query('UPDATE users SET vessel_id=NULL WHERE vessel_id=$1', [vid]);
    await client.query('DELETE FROM vessels WHERE id=$1', [vid]);
    await client.query('COMMIT');
    res.json({ success: true, message: 'Vessel and all associated data deleted' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

module.exports = router;
