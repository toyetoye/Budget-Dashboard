const express = require('express');
const { pool } = require('../db');
const { authenticate, canEditBudgets } = require('../auth');
const router = express.Router();

router.get('/:vesselId', authenticate, async (req, res) => {
  try {
    const vid = req.params.vesselId;
    if (req.user.role === 'vessel' && req.user.vessel_id !== parseInt(vid)) return res.status(403).json({ error: 'Access denied' });
    const { status, source, sub_category, carried_forward, search } = req.query;
    let q = 'SELECT * FROM indents WHERE vessel_id = $1'; const p = [vid]; let idx = 2;
    if (status) { q += ` AND status=$${idx++}`; p.push(status); }
    if (source) { q += ` AND source=$${idx++}`; p.push(source); }
    if (sub_category) { q += ` AND sub_category=$${idx++}`; p.push(sub_category); }
    if (carried_forward === 'true') q += ' AND is_carried_forward=true';
    else if (carried_forward === 'false') q += ' AND is_carried_forward=false';
    if (search) { q += ` AND (title ILIKE $${idx} OR indent_number ILIKE $${idx} OR sub_category ILIKE $${idx} OR cost_group ILIKE $${idx})`; p.push(`%${search}%`); idx++; }
    q += ' ORDER BY created_at DESC';
    res.json((await pool.query(q, p)).rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:vesselId', authenticate, async (req, res) => {
  try {
    const vid = req.params.vesselId;
    // Admin, superintendent, and vessel users can create indents
    if (req.user.role === 'vessel' && req.user.vessel_id !== parseInt(vid)) return res.status(403).json({ error: 'Access denied' });
    if (req.user.role === 'manager') return res.status(403).json({ error: 'Read-only access' });
    const { indent_number, title, cost_group, sub_category, cost_element_code, source, status, cost_usd, cost_local, cost_marked_up, location, notes, is_carried_forward, carried_forward_year } = req.body;
    const r = await pool.query(`INSERT INTO indents (vessel_id,indent_number,title,cost_group,sub_category,cost_element_code,source,status,cost_usd,cost_local,cost_marked_up,location,notes,is_carried_forward,carried_forward_year)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [vid, indent_number, title, cost_group||null, sub_category||null, cost_element_code||null, source||'HO', status||'Estimate', cost_usd||0, cost_local||0, cost_marked_up||0, location||null, notes||null, is_carried_forward||false, carried_forward_year||null]);
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:vesselId/:id', authenticate, async (req, res) => {
  try {
    const { vesselId, id } = req.params;
    if (req.user.role === 'vessel' && req.user.vessel_id !== parseInt(vesselId)) return res.status(403).json({ error: 'Access denied' });
    if (req.user.role === 'manager') return res.status(403).json({ error: 'Read-only access' });
    const { indent_number, title, cost_group, sub_category, cost_element_code, source, status, cost_usd, cost_local, cost_marked_up, location, notes, is_carried_forward, carried_forward_year } = req.body;
    const r = await pool.query(`UPDATE indents SET indent_number=$1,title=$2,cost_group=$3,sub_category=$4,cost_element_code=$5,source=$6,status=$7,cost_usd=$8,cost_local=$9,cost_marked_up=$10,location=$11,notes=$12,is_carried_forward=$13,carried_forward_year=$14,updated_at=NOW() WHERE id=$15 AND vessel_id=$16 RETURNING *`,
      [indent_number, title, cost_group, sub_category, cost_element_code, source, status, cost_usd||0, cost_local||0, cost_marked_up||0, location, notes, is_carried_forward||false, carried_forward_year||null, id, vesselId]);
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:vesselId/:id', authenticate, canEditBudgets, async (req, res) => {
  try { await pool.query('DELETE FROM indents WHERE id=$1 AND vessel_id=$2', [req.params.id, req.params.vesselId]); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:vesselId/carry-forward', authenticate, canEditBudgets, async (req, res) => {
  try {
    const { indent_ids, target_year } = req.body;
    const r = await pool.query(`UPDATE indents SET is_carried_forward=true, carried_forward_year=$1 WHERE vessel_id=$2 AND id=ANY($3) AND status!='Invoiced' RETURNING *`, [target_year, req.params.vesselId, indent_ids]);
    res.json({ updated: r.rowCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
