const express = require('express');
const { pool } = require('../db');
const { authenticate } = require('../auth');
const multer = require('multer');
const XLSX = require('xlsx');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/:vesselId/compare', authenticate, upload.single('file'), async (req, res) => {
  try {
    // Only admin and superintendent can upload
    if (!['admin','superintendent'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only admin and superintendent can upload BPR' });
    }
    const vid = req.params.vesselId;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    let headerIdx = -1;
    for (let i = 0; i < Math.min(allRows.length, 10); i++) {
      if (allRows[i] && String(allRows[i][0]).toUpperCase().includes('COST ELEMENT')) { headerIdx = i; break; }
    }
    if (headerIdx < 0) headerIdx = 3;

    const vesselName = allRows[0] ? (allRows[0][2] || allRows[0][1] || '') : '';

    const bprItems = [];
    for (let i = headerIdx + 1; i < allRows.length; i++) {
      const row = allRows[i];
      if (!row || !row[0]) continue;
      const codeRaw = String(row[0]).trim();
      if (!/^\d{5,}$/.test(codeRaw)) continue;
      // Skip crew/manning/salary/travel codes — not part of technical OPEX
      const SKIP_PREFIXES = ['2224','22211','22213','22191','22214','22231','22322','22215','22185003','22185004','22185005','22185006'];
      if (SKIP_PREFIXES.some(p => codeRaw.startsWith(p))) continue;
      // Skip delivery items (22187xxx) — zero-value project delivery lines
      if (codeRaw.startsWith('22187')) continue;
      const name = String(row[1] || '').trim();
      if (!name) continue;
      bprItems.push({
        code: codeRaw, name,
        approved_budget: parseFloat(row[2]) || 0,
        monthly_budget: parseFloat(row[3]) || 0,
        ytd_budget: parseFloat(row[4]) || 0,
        actual: parseFloat(row[5]) || 0,
        commitments: parseFloat(row[6]) || 0,
        budget_balance: parseFloat(row[7]) || 0,
        variance: parseFloat(row[8]) || 0,
      });
    }

    const budgets = await pool.query(
      `SELECT bc.cost_group, bc.sub_category, bc.annual_budget,
        COALESCE(SUM(il.cost_usd), 0) as actual_spent
      FROM budget_categories bc
      LEFT JOIN indents i ON i.vessel_id = bc.vessel_id
      LEFT JOIN indent_lines il ON il.indent_id = i.id AND il.sub_category = bc.sub_category
      WHERE bc.vessel_id = $1 AND bc.year = $2
      GROUP BY bc.cost_group, bc.sub_category, bc.annual_budget
      ORDER BY bc.cost_group, bc.sub_category`, [vid, req.query.year || 2024]);

    const budgetByName = {};
    budgets.rows.forEach(b => {
      const key = b.sub_category.toLowerCase().replace(/[^a-z0-9]/g, '');
      budgetByName[key] = { cost_group: b.cost_group, sub_category: b.sub_category, annual_budget: parseFloat(b.annual_budget), actual_spent: parseFloat(b.actual_spent) };
    });

    const costElements = await pool.query(`SELECT ce.code, ce.name, cg.name as group_name FROM cost_elements ce JOIN cost_groups cg ON ce.cost_group_id = cg.id`);
    const codeToElement = {};
    costElements.rows.forEach(ce => { codeToElement[ce.code] = ce; });

    const comparison = bprItems.map(bpr => {
      const normName = bpr.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      let match = budgetByName[normName];
      if (!match && codeToElement[bpr.code]) {
        const elName = codeToElement[bpr.code].name.toLowerCase().replace(/[^a-z0-9]/g, '');
        match = budgetByName[elName];
      }
      if (!match) {
        for (const [key, val] of Object.entries(budgetByName)) {
          if (normName.includes(key) || key.includes(normName)) { match = val; break; }
        }
      }
      if (match) {
        const diff = bpr.actual - match.actual_spent;
        return { code: bpr.code, sub_category: bpr.name, cost_group: match.cost_group, dashboard_sub: match.sub_category, bpr_budget: bpr.approved_budget, bpr_actual: bpr.actual, bpr_commitments: bpr.commitments, bpr_variance: bpr.variance, dashboard_budget: match.annual_budget, dashboard_actual: match.actual_spent, difference: diff, budget_diff: bpr.approved_budget - match.annual_budget, status: Math.abs(diff) < 1 ? 'match' : diff > 0 ? 'bpr_higher' : 'dashboard_higher', matched: true };
      }
      return { code: bpr.code, sub_category: bpr.name, cost_group: codeToElement[bpr.code]?.group_name || '', dashboard_sub: '', bpr_budget: bpr.approved_budget, bpr_actual: bpr.actual, bpr_commitments: bpr.commitments, bpr_variance: bpr.variance, dashboard_budget: 0, dashboard_actual: 0, difference: bpr.actual, budget_diff: bpr.approved_budget, status: 'unmatched', matched: false };
    });

    const matchedDashSubs = new Set(comparison.filter(c => c.matched).map(c => c.dashboard_sub.toLowerCase().replace(/[^a-z0-9]/g, '')));
    budgets.rows.forEach(b => {
      const key = b.sub_category.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!matchedDashSubs.has(key)) {
        comparison.push({ code: '', sub_category: b.sub_category, cost_group: b.cost_group, dashboard_sub: b.sub_category, bpr_budget: 0, bpr_actual: 0, bpr_commitments: 0, bpr_variance: 0, dashboard_budget: parseFloat(b.annual_budget), dashboard_actual: parseFloat(b.actual_spent || 0), difference: -parseFloat(b.actual_spent || 0), budget_diff: -parseFloat(b.annual_budget), status: 'missing_from_bpr', matched: false });
      }
    });

    const resultData = {
      vessel_name: vesselName, bpr_rows: bprItems.length, comparison,
      summary: {
        total_bpr_budget: bprItems.reduce((s, b) => s + b.approved_budget, 0),
        total_bpr_actual: bprItems.reduce((s, b) => s + b.actual, 0),
        total_dashboard_budget: budgets.rows.reduce((s, b) => s + parseFloat(b.annual_budget), 0),
        total_dashboard_actual: budgets.rows.reduce((s, b) => s + parseFloat(b.actual_spent), 0),
        matched: comparison.filter(c => c.matched).length,
        unmatched: comparison.filter(c => !c.matched && c.status === 'unmatched').length,
        missing: comparison.filter(c => c.status === 'missing_from_bpr').length,
      }
    };

    // Save to database so vessel users can view it
    await pool.query(`
      INSERT INTO bpr_uploads (vessel_id, uploaded_by, year, month, filename, summary, comparison, bpr_rows)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [vid, req.user.id, req.query.year || 2024, req.query.month || null, req.file.originalname, JSON.stringify(resultData.summary), JSON.stringify(comparison), bprItems.length]);

    res.json(resultData);
  } catch (err) { console.error('BPR error:', err); res.status(500).json({ error: err.message }); }
});

// Get latest saved BPR for a vessel — recomputes dashboard actuals live from indent_lines
router.get('/:vesselId/latest', authenticate, async (req, res) => {
  try {
    const vid = req.params.vesselId;
    const year = req.query.year || 2024;
    const r = await pool.query(`
      SELECT bp.*, u.display_name as uploaded_by_name
      FROM bpr_uploads bp 
      LEFT JOIN users u ON bp.uploaded_by = u.id
      WHERE bp.vessel_id = $1 AND bp.year = $2
      ORDER BY bp.uploaded_at DESC LIMIT 1
    `, [vid, year]);
    if (!r.rows.length) return res.json(null);
    const row = r.rows[0];

    // Always recompute dashboard actuals from live indent_lines — so deletions/additions reflect immediately
    const actualsResult = await pool.query(`
      SELECT il.sub_category, COALESCE(SUM(il.cost_usd), 0) as actual_spent
      FROM indent_lines il
      JOIN indents i ON il.indent_id = i.id
      WHERE i.vessel_id = $1
      GROUP BY il.sub_category
    `, [vid]);

    const liveActuals = {};
    actualsResult.rows.forEach(a => {
      liveActuals[a.sub_category.toLowerCase().replace(/[^a-z0-9]/g, '')] = parseFloat(a.actual_spent);
    });

    // Merge live actuals into stored comparison rows
    const comparison = row.comparison.map(c => {
      const lookupKey = (c.dashboard_sub || c.sub_category || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const liveActual = liveActuals[lookupKey] !== undefined ? liveActuals[lookupKey] : 0;
      const newDiff = (c.bpr_actual || 0) - liveActual;
      const newStatus = c.status === 'missing_from_bpr' ? 'missing_from_bpr'
        : Math.abs(newDiff) < 1 ? 'match'
        : newDiff > 0 ? 'bpr_higher' : 'dashboard_higher';
      return { ...c, dashboard_actual: liveActual, difference: newDiff, status: newStatus };
    });

    const totalDashActual = comparison.reduce((s, c) => s + (c.dashboard_actual || 0), 0);
    const summary = {
      ...row.summary,
      total_dashboard_actual: totalDashActual,
      matched: comparison.filter(c => c.status === 'match').length,
      unmatched: comparison.filter(c => c.status === 'unmatched').length,
      missing: comparison.filter(c => c.status === 'missing_from_bpr').length,
    };

    res.json({
      bpr_rows: row.bpr_rows,
      comparison,
      summary,
      vessel_name: '',
      uploaded_by: row.uploaded_by_name,
      uploaded_at: row.uploaded_at,
      filename: row.filename,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get all BPR upload history for a vessel
router.get('/:vesselId/history', authenticate, async (req, res) => {
  try {
    const vid = req.params.vesselId;
    const r = await pool.query(`
      SELECT bp.id, bp.year, bp.month, bp.filename, bp.bpr_rows, bp.summary, bp.uploaded_at, u.display_name as uploaded_by_name
      FROM bpr_uploads bp LEFT JOIN users u ON bp.uploaded_by = u.id
      WHERE bp.vessel_id = $1 ORDER BY bp.uploaded_at DESC LIMIT 20
    `, [vid]);
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Import unmatched BPR items as budget lines
router.post('/:vesselId/import', authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    const vid = req.params.vesselId;
    const { items, year } = req.body; // items: [{code, name, approved_budget, cost_group}]
    if (!items || !items.length) return res.status(400).json({ error: 'No items to import' });

    // Look up cost element -> cost group mapping
    const ceResult = await pool.query('SELECT ce.code, ce.name, cg.name as group_name FROM cost_elements ce JOIN cost_groups cg ON ce.cost_group_id = cg.id');
    const codeToGroup = {};
    ceResult.rows.forEach(ce => { codeToGroup[ce.code] = ce.group_name; });

    await client.query('BEGIN');
    let imported = 0;
    for (const item of items) {
      const costGroup = item.cost_group || codeToGroup[item.code] || 'Other';
      const subCategory = item.name;
      const budget = item.approved_budget || 0;
      const yr = year || 2024;

      await client.query(`
        INSERT INTO budget_categories (vessel_id, cost_group, sub_category, annual_budget, year)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (vessel_id, sub_category, year) DO UPDATE SET annual_budget = $4, cost_group = $2
      `, [vid, costGroup, subCategory, budget, yr]);
      imported++;
    }
    await client.query('COMMIT');
    res.json({ success: true, imported });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

module.exports = router;
