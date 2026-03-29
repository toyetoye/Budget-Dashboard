const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticate, canEditBudgets } = require('../auth');

// Helper: recalculate indent totals from lines
async function recalcTotals(client, indentId) {
  await client.query(`
    UPDATE indents SET
      total_usd = COALESCE((SELECT SUM(cost_usd) FROM indent_lines WHERE indent_id = $1), 0),
      total_local = COALESCE((SELECT SUM(cost_local) FROM indent_lines WHERE indent_id = $1), 0),
      line_count = COALESCE((SELECT COUNT(*) FROM indent_lines WHERE indent_id = $1), 0),
      updated_at = NOW()
    WHERE id = $1
  `, [indentId]);
}

// GET all indents for a vessel (with lines)
router.get('/:vesselId', authenticate, async (req, res) => {
  try {
    const vesselId = req.params.vesselId;
    if (req.user.role === 'vessel' && req.user.vessel_id !== parseInt(vesselId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get indents
    const indents = await pool.query(`
      SELECT i.*, COALESCE(i.total_usd, 0) as total_usd, COALESCE(i.total_local, 0) as total_local, COALESCE(i.line_count, 1) as line_count
      FROM indents i
      WHERE i.vessel_id = $1
      ORDER BY i.created_at DESC
    `, [vesselId]);

    // Get all lines for these indents
    const indentIds = indents.rows.map(i => i.id);
    let linesMap = {};

    if (indentIds.length > 0) {
      const lines = await pool.query(`
        SELECT * FROM indent_lines WHERE indent_id = ANY($1) ORDER BY indent_id, line_number
      `, [indentIds]);

      lines.rows.forEach(l => {
        if (!linesMap[l.indent_id]) linesMap[l.indent_id] = [];
        linesMap[l.indent_id].push(l);
      });
    }

    // Attach lines to each indent
    const result = indents.rows.map(ind => ({
      ...ind,
      cost_usd: Number(ind.total_usd),
      cost_local: Number(ind.total_local),
      lines: linesMap[ind.id] || [],
      // Keep backward compat: primary cost_group/sub_category from first line
      cost_group: linesMap[ind.id]?.[0]?.cost_group || ind.cost_group || '',
      sub_category: linesMap[ind.id]?.[0]?.sub_category || ind.sub_category || '',
    }));

    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET indents with optional filters
router.get('/:vesselId/filter', authenticate, async (req, res) => {
  try {
    const vesselId = req.params.vesselId;
    if (req.user.role === 'vessel' && req.user.vessel_id !== parseInt(vesselId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const { status, source, cost_group } = req.query;
    let where = 'i.vessel_id = $1';
    const params = [vesselId];
    let idx = 2;

    if (status) { where += ` AND i.status = $${idx++}`; params.push(status); }
    if (source) { where += ` AND i.source = $${idx++}`; params.push(source); }

    const indents = await pool.query(`SELECT i.* FROM indents i WHERE ${where} ORDER BY i.created_at DESC`, params);
    const indentIds = indents.rows.map(i => i.id);
    let linesMap = {};

    if (indentIds.length > 0) {
      const lines = await pool.query(`SELECT * FROM indent_lines WHERE indent_id = ANY($1) ORDER BY indent_id, line_number`, [indentIds]);
      lines.rows.forEach(l => { if (!linesMap[l.indent_id]) linesMap[l.indent_id] = []; linesMap[l.indent_id].push(l); });
    }

    let result = indents.rows.map(ind => ({
      ...ind,
      cost_usd: Number(ind.total_usd || 0),
      cost_local: Number(ind.total_local || 0),
      lines: linesMap[ind.id] || [],
      cost_group: linesMap[ind.id]?.[0]?.cost_group || ind.cost_group || '',
      sub_category: linesMap[ind.id]?.[0]?.sub_category || ind.sub_category || '',
    }));

    // Filter by cost_group at line level
    if (cost_group) {
      result = result.filter(ind => ind.lines.some(l => l.cost_group === cost_group));
    }

    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// CREATE indent with lines
router.post('/:vesselId', authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    const vesselId = req.params.vesselId;
    if (req.user.role === 'vessel' && req.user.vessel_id !== parseInt(vesselId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { indent_number, title, source, status, location, notes, is_carried_forward, carried_forward_year, lines } = req.body;

    // Support both old single-line format and new multi-line format
    const lineItems = lines && lines.length > 0 ? lines : [{
      cost_group: req.body.cost_group || '',
      sub_category: req.body.sub_category || '',
      cost_element_code: req.body.cost_element_code || '',
      description: req.body.title || '',
      cost_usd: req.body.cost_usd || 0,
      cost_local: req.body.cost_local || 0,
      cost_marked_up: req.body.cost_marked_up || 0,
    }];

    await client.query('BEGIN');

    // Insert indent header
    const totalUsd = lineItems.reduce((s, l) => s + (parseFloat(l.cost_usd) || 0), 0);
    const totalLocal = lineItems.reduce((s, l) => s + (parseFloat(l.cost_local) || 0), 0);

    const indentResult = await client.query(`
      INSERT INTO indents (vessel_id, indent_number, title, cost_group, sub_category, cost_element_code, source, status,
        cost_usd, cost_local, cost_marked_up, total_usd, total_local, line_count, location, notes, is_carried_forward, carried_forward_year)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *
    `, [
      vesselId, indent_number, title,
      lineItems[0].cost_group || null, lineItems[0].sub_category || null, lineItems[0].cost_element_code || null,
      source || 'HO', status || 'Estimate',
      totalUsd, totalLocal, 0,
      totalUsd, totalLocal, lineItems.length,
      location || null, notes || null, is_carried_forward || false, carried_forward_year || null
    ]);

    const indentId = indentResult.rows[0].id;

    // Insert lines
    for (let i = 0; i < lineItems.length; i++) {
      const l = lineItems[i];
      await client.query(`
        INSERT INTO indent_lines (indent_id, line_number, cost_group, sub_category, cost_element_code, description, cost_usd, cost_local, cost_marked_up)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [indentId, i + 1, l.cost_group || null, l.sub_category || null, l.cost_element_code || null,
          l.description || '', parseFloat(l.cost_usd) || 0, parseFloat(l.cost_local) || 0, parseFloat(l.cost_marked_up) || 0]);
    }

    await client.query('COMMIT');

    // Return full indent with lines
    const fullIndent = indentResult.rows[0];
    fullIndent.lines = lineItems.map((l, i) => ({ ...l, line_number: i + 1, indent_id: indentId }));
    fullIndent.cost_usd = totalUsd;
    fullIndent.total_usd = totalUsd;
    fullIndent.total_local = totalLocal;
    fullIndent.line_count = lineItems.length;

    res.status(201).json(fullIndent);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// UPDATE indent with lines
router.put('/:vesselId/:id', authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    const { vesselId, id } = req.params;
    if (req.user.role === 'vessel' && req.user.vessel_id !== parseInt(vesselId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { indent_number, title, source, status, location, notes, is_carried_forward, carried_forward_year, lines } = req.body;

    await client.query('BEGIN');

    // Update indent header
    await client.query(`
      UPDATE indents SET indent_number=$1, title=$2, source=$3, status=$4,
        location=$5, notes=$6, is_carried_forward=$7, carried_forward_year=$8, updated_at=NOW()
      WHERE id=$9 AND vessel_id=$10
    `, [indent_number, title, source, status, location || null, notes || null,
        is_carried_forward || false, carried_forward_year || null, id, vesselId]);

    // If lines provided, replace them
    if (lines && lines.length > 0) {
      await client.query('DELETE FROM indent_lines WHERE indent_id = $1', [id]);

      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        await client.query(`
          INSERT INTO indent_lines (indent_id, line_number, cost_group, sub_category, cost_element_code, description, cost_usd, cost_local, cost_marked_up)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [id, i + 1, l.cost_group || null, l.sub_category || null, l.cost_element_code || null,
            l.description || '', parseFloat(l.cost_usd) || 0, parseFloat(l.cost_local) || 0, parseFloat(l.cost_marked_up) || 0]);
      }

      // Update primary cost_group/sub_category on indent header (first line)
      await client.query(`
        UPDATE indents SET cost_group=$1, sub_category=$2, cost_element_code=$3 WHERE id=$4
      `, [lines[0].cost_group || null, lines[0].sub_category || null, lines[0].cost_element_code || null, id]);
    }

    // Recalculate totals
    await recalcTotals(client, id);

    await client.query('COMMIT');

    // Return updated indent
    const updated = await pool.query('SELECT * FROM indents WHERE id = $1', [id]);
    const updatedLines = await pool.query('SELECT * FROM indent_lines WHERE indent_id = $1 ORDER BY line_number', [id]);
    const result = { ...updated.rows[0], lines: updatedLines.rows, cost_usd: Number(updated.rows[0].total_usd) };

    res.json(result);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// DELETE indent (cascade deletes lines)
router.delete('/:vesselId/:id', authenticate, canEditBudgets, async (req, res) => {
  try {
    await pool.query('DELETE FROM indents WHERE id = $1 AND vessel_id = $2', [req.params.id, req.params.vesselId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Carry forward
router.post('/:vesselId/carry-forward', authenticate, canEditBudgets, async (req, res) => {
  try {
    const { indent_ids, target_year } = req.body;
    const result = await pool.query(`
      UPDATE indents SET is_carried_forward = true, carried_forward_year = $1
      WHERE vessel_id = $2 AND id = ANY($3) AND status != 'Invoiced'
      RETURNING *
    `, [target_year, req.params.vesselId, indent_ids]);
    res.json({ updated: result.rowCount, indents: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Summary
router.get('/:vesselId/summary', authenticate, async (req, res) => {
  try {
    const vesselId = req.params.vesselId;
    if (req.user.role === 'vessel' && req.user.vessel_id !== parseInt(vesselId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const statusSummary = await pool.query(`
      SELECT status, COUNT(*) as count, SUM(total_usd) as total
      FROM indents WHERE vessel_id = $1 GROUP BY status
    `, [vesselId]);

    // Aggregate by sub_category from indent_lines
    const categorySummary = await pool.query(`
      SELECT il.sub_category, SUM(il.cost_usd) as total_spent, COUNT(DISTINCT il.indent_id) as indent_count
      FROM indent_lines il
      JOIN indents i ON il.indent_id = i.id
      WHERE i.vessel_id = $1
      GROUP BY il.sub_category ORDER BY total_spent DESC
    `, [vesselId]);

    res.json({ byStatus: statusSummary.rows, byCategory: categorySummary.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
