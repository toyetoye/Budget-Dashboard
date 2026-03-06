const express = require('express');
const { pool } = require('../db');
const { authenticate, canEditBudgets } = require('../auth');
const multer = require('multer');
const XLSX = require('xlsx');
const router = express.Router();
const uploadMem = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/:vesselId', authenticate, async (req, res) => {
  try {
    const vid = req.params.vesselId;
    if (req.user.role === 'vessel' && req.user.vessel_id !== parseInt(vid)) return res.status(403).json({ error: 'Access denied' });
    const year = req.query.year || new Date().getFullYear();
    const budgets = await pool.query('SELECT * FROM budget_categories WHERE vessel_id=$1 AND year=$2 ORDER BY cost_group, sub_category', [vid, year]);
    const actuals = await pool.query(`
      SELECT sub_category,
        SUM(CASE WHEN source='HO' AND is_carried_forward=false THEN cost_usd ELSE 0 END) as ho_spent,
        SUM(CASE WHEN source='Outport' AND is_carried_forward=false THEN cost_usd ELSE 0 END) as outport_spent,
        SUM(CASE WHEN is_carried_forward=true THEN cost_usd ELSE 0 END) as cf_spent,
        SUM(cost_usd) as total_spent
      FROM indents WHERE vessel_id=$1 GROUP BY sub_category`, [vid]);
    const am = {}; actuals.rows.forEach(a => { am[a.sub_category] = a; });
    res.json(budgets.rows.map(b => ({
      ...b, annual_budget: parseFloat(b.annual_budget),
      ho_spent: parseFloat(am[b.sub_category]?.ho_spent||0),
      outport_spent: parseFloat(am[b.sub_category]?.outport_spent||0),
      cf_spent: parseFloat(am[b.sub_category]?.cf_spent||0),
      actual_spent: parseFloat(am[b.sub_category]?.total_spent||0),
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:vesselId', authenticate, canEditBudgets, async (req, res) => {
  const client = await pool.connect();
  try {
    const vid = req.params.vesselId; const { budgets, year } = req.body; const yr = year||new Date().getFullYear();
    await client.query('BEGIN');
    for (const b of budgets) {
      await client.query(`INSERT INTO budget_categories (vessel_id,cost_group,sub_category,annual_budget,year) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (vessel_id,sub_category,year) DO UPDATE SET annual_budget=$4, cost_group=$2`,
        [vid, b.cost_group||b.category, b.sub_category, b.annual_budget||0, yr]);
    }
    await client.query('COMMIT');
    const r = await pool.query('SELECT * FROM budget_categories WHERE vessel_id=$1 AND year=$2 ORDER BY cost_group, sub_category', [vid, yr]);
    res.json(r.rows);
  } catch (err) { await client.query('ROLLBACK'); res.status(500).json({ error: err.message }); }
  finally { client.release(); }
});

// ── Upload approved budget Excel ──

router.post('/:vesselId/upload', authenticate, canEditBudgets, uploadMem.single('file'), async (req, res) => {
  const client = await pool.connect();
  try {
    const vid = req.params.vesselId;
    const yr = parseInt(req.query.year) || new Date().getFullYear();
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    // Find header row
    let headerIdx = -1;
    for (let i = 0; i < Math.min(allRows.length, 10); i++) {
      if (allRows[i] && String(allRows[i][0]).toUpperCase().includes('COST ELEMENT')) { headerIdx = i; break; }
    }
    if (headerIdx < 0) headerIdx = 2;

    // Look up cost element -> cost group mapping
    const ceResult = await pool.query('SELECT ce.code, ce.name, cg.name as group_name FROM cost_elements ce JOIN cost_groups cg ON ce.cost_group_id = cg.id');
    const codeToGroup = {};
    const codeToName = {};
    ceResult.rows.forEach(ce => { codeToGroup[ce.code] = ce.group_name; codeToName[ce.code] = ce.name; });

    // Skip crew/manning codes
    const SKIP_PREFIXES = ['2224','22211','22213','22191','22214','22231','22322','22215','22185003','22185004','22185005','22185006'];

    // Detect which column has the budget - look for "APPROVED" or "BUDGET" in header
    let budgetCol = 2; // default column C
    if (allRows[headerIdx]) {
      for (let c = 0; c < allRows[headerIdx].length; c++) {
        const h = String(allRows[headerIdx][c]).toUpperCase();
        if (h.includes('APPROVED') || (h.includes('BUDGET') && !h.includes('MONTHLY') && !h.includes('YTD') && !h.includes('BALANCE'))) {
          budgetCol = c; break;
        }
      }
    }

    // Track current group from group header rows
    let currentGroup = '';
    const budgetLines = [];

    for (let i = headerIdx + 1; i < allRows.length; i++) {
      const row = allRows[i];
      if (!row) continue;
      const code = String(row[0] || '').trim();
      const name = String(row[1] || '').trim();
      const rawBudget = row[budgetCol];

      if (!name) continue;

      // Group header rows (no code, has name) — track for fallback grouping
      if (!code && name) {
        // Could be a group header like "Voyage Repairs & Services"
        currentGroup = name;
        continue;
      }

      // Only process rows with numeric codes
      if (!/^\d{5,}$/.test(code)) continue;

      // Skip crew/manning
      if (SKIP_PREFIXES.some(p => code.startsWith(p))) continue;

      // Parse budget amount
      let budget = 0;
      if (rawBudget !== undefined && rawBudget !== null && rawBudget !== '' && rawBudget !== ' - ' && rawBudget !== '-') {
        budget = parseFloat(rawBudget) || 0;
      }

      // Determine cost group from code lookup, fallback to current group header
      const costGroup = codeToGroup[code] || currentGroup || 'Other';
      // Use the name from our cost_elements table if available, else BPR name
      const subCategory = codeToName[code] || name;

      budgetLines.push({ cost_group: costGroup, sub_category: subCategory, annual_budget: budget, code });
    }

    // Upsert all budget lines
    await client.query('BEGIN');

    // Option: clear existing budgets for this vessel/year first
    const clearExisting = req.query.replace === 'true';
    if (clearExisting) {
      await client.query('DELETE FROM budget_categories WHERE vessel_id=$1 AND year=$2', [vid, yr]);
    }

    let imported = 0;
    for (const b of budgetLines) {
      await client.query(`
        INSERT INTO budget_categories (vessel_id, cost_group, sub_category, annual_budget, year)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (vessel_id, sub_category, year) DO UPDATE SET annual_budget = $4, cost_group = $2
      `, [vid, b.cost_group, b.sub_category, b.annual_budget, yr]);
      imported++;
    }
    await client.query('COMMIT');

    res.json({
      success: true,
      imported,
      year: yr,
      total_budget: budgetLines.reduce((s, b) => s + b.annual_budget, 0),
      lines: budgetLines.map(b => ({ code: b.code, name: b.sub_category, group: b.cost_group, budget: b.annual_budget })),
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Budget upload error:', err);
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

module.exports = router;
