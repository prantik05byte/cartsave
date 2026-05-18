require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const sessionRoutes = require('./routes/session');
const chatRoutes = require('./routes/chat');
const frictionRoutes = require('./routes/friction');
const analyticsRoutes = require('./routes/analytics');
const { initDB } = require('./models/Session');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ─────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '1mb' }));

// ─── DB Init ─────────────────────────────────────────────────────────────────
initDB();

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/session', sessionRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/friction', frictionRoutes);
app.use('/api/analytics', analyticsRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'CartSave API', timestamp: new Date().toISOString() });
});

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[CartSave Error]', err.message);
  res.status(500).json({ error: 'Internal server error', detail: err.message });
});

app.listen(PORT, () => {
  console.log(`🚀 CartSave backend running on http://localhost:${PORT}`);
  console.log(`   Mode: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
