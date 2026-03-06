const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { generateToken, authenticate, adminOnly } = require('../auth');
const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const r = await pool.query('SELECT * FROM users WHERE username = $1 AND active = true', [username]);
    if (!r.rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const user = r.rows[0];
    if (!(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: 'Invalid credentials' });

    // Get assigned vessel IDs for superintendent
    let vessel_ids = [];
    if (user.role === 'superintendent') {
      const vr = await pool.query('SELECT vessel_id FROM user_vessels WHERE user_id = $1', [user.id]);
      vessel_ids = vr.rows.map(r => r.vessel_id);
      // Fallback to legacy vessel_id if no user_vessels entries
      if (!vessel_ids.length && user.vessel_id) vessel_ids = [user.vessel_id];
    } else if (user.vessel_id) {
      vessel_ids = [user.vessel_id];
    }

    const token = generateToken({ ...user, vessel_ids });
    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role, vessel_id: user.vessel_id, vessel_ids, display_name: user.display_name }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/me', authenticate, (req, res) => res.json(req.user));

router.get('/users', authenticate, adminOnly, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT u.id, u.username, u.role, u.vessel_id, u.display_name, u.active, v.name as vessel_name
      FROM users u LEFT JOIN vessels v ON u.vessel_id = v.id ORDER BY u.role, u.display_name
    `);
    // Get vessel assignments for all users
    const uv = await pool.query(`
      SELECT uv.user_id, uv.vessel_id, v.name as vessel_name 
      FROM user_vessels uv JOIN vessels v ON uv.vessel_id = v.id
    `);
    const vesselMap = {};
    uv.rows.forEach(row => {
      if (!vesselMap[row.user_id]) vesselMap[row.user_id] = [];
      vesselMap[row.user_id].push({ vessel_id: row.vessel_id, vessel_name: row.vessel_name });
    });
    const users = r.rows.map(u => ({
      ...u,
      vessel_ids: vesselMap[u.id]?.map(v => v.vessel_id) || (u.vessel_id ? [u.vessel_id] : []),
      vessel_names: vesselMap[u.id]?.map(v => v.vessel_name) || (u.vessel_name ? [u.vessel_name] : []),
    }));
    res.json(users);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/users', authenticate, adminOnly, async (req, res) => {
  const client = await pool.connect();
  try {
    const { username, password, role, vessel_id, vessel_ids, display_name } = req.body;
    const hash = await bcrypt.hash(password, 10);
    // For vessel users, use single vessel_id; for superintendent, use first vessel_id as primary
    const primaryVesselId = vessel_id || (vessel_ids?.length ? vessel_ids[0] : null);
    const r = await client.query(
      'INSERT INTO users (username, password, role, vessel_id, display_name) VALUES ($1,$2,$3,$4,$5) RETURNING id, username, role, vessel_id, display_name',
      [username, hash, role || 'vessel', primaryVesselId, display_name || username]
    );
    const newUser = r.rows[0];

    // Insert multi-vessel assignments for superintendent
    if (role === 'superintendent' && vessel_ids?.length) {
      for (const vid of vessel_ids) {
        await client.query('INSERT INTO user_vessels (user_id, vessel_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [newUser.id, vid]);
      }
    } else if (primaryVesselId) {
      await client.query('INSERT INTO user_vessels (user_id, vessel_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [newUser.id, primaryVesselId]);
    }

    res.status(201).json({ ...newUser, vessel_ids: vessel_ids || (primaryVesselId ? [primaryVesselId] : []) });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Username exists' });
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

router.put('/users/:id', authenticate, adminOnly, async (req, res) => {
  const client = await pool.connect();
  try {
    const { username, password, role, vessel_id, vessel_ids, display_name, active } = req.body;
    const userId = req.params.id;
    const primaryVesselId = vessel_id || (vessel_ids?.length ? vessel_ids[0] : null);

    let q, p;
    if (password) {
      const h = await bcrypt.hash(password, 10);
      q = 'UPDATE users SET username=$1,password=$2,role=$3,vessel_id=$4,display_name=$5,active=$6 WHERE id=$7 RETURNING id,username,role,vessel_id,display_name,active';
      p = [username, h, role, primaryVesselId, display_name, active !== false, userId];
    } else {
      q = 'UPDATE users SET username=$1,role=$2,vessel_id=$3,display_name=$4,active=$5 WHERE id=$6 RETURNING id,username,role,vessel_id,display_name,active';
      p = [username, role, primaryVesselId, display_name, active !== false, userId];
    }
    const r = await client.query(q, p);

    // Update vessel assignments
    await client.query('DELETE FROM user_vessels WHERE user_id = $1', [userId]);
    if (role === 'superintendent' && vessel_ids?.length) {
      for (const vid of vessel_ids) {
        await client.query('INSERT INTO user_vessels (user_id, vessel_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, vid]);
      }
    } else if (primaryVesselId) {
      await client.query('INSERT INTO user_vessels (user_id, vessel_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, primaryVesselId]);
    }

    res.json({ ...r.rows[0], vessel_ids: vessel_ids || (primaryVesselId ? [primaryVesselId] : []) });
  } catch (err) { res.status(500).json({ error: err.message }); }
  finally { client.release(); }
});

module.exports = router;
