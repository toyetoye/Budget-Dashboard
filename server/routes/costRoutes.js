const express = require('express');
const { pool } = require('../db');
const { authenticate } = require('../auth');
const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const groups = await pool.query('SELECT * FROM cost_groups ORDER BY sort_order, name');
    const elements = await pool.query('SELECT * FROM cost_elements ORDER BY sort_order, name');
    res.json(groups.rows.map(g => ({ ...g, elements: elements.rows.filter(e => e.cost_group_id === g.id) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
