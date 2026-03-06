const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const { initDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/vessels', require('./routes/vesselRoutes'));
app.use('/api/budgets', require('./routes/budgetRoutes'));
app.use('/api/indents', require('./routes/indentRoutes'));
app.use('/api/costs', require('./routes/costRoutes'));
app.use('/api/bpr', require('./routes/bprRoutes'));
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const dist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(dist));
app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));

initDB().then(() => app.listen(PORT, () => console.log(`Running on port ${PORT}`))).catch(err => { console.error(err); process.exit(1); });
