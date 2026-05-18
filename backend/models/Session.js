const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/cartsave.db');
let db;

function getDB() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

function initDB() {
  const database = getDB();

  // Sessions table
  database.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      shop_domain TEXT NOT NULL,
      cart_token TEXT,
      page_url TEXT,
      user_agent TEXT,
      friction_type TEXT,
      outcome TEXT DEFAULT 'pending',
      cart_data TEXT,
      started_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // Messages table
  database.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(session_id) REFERENCES sessions(id)
    );
  `);

  console.log('[DB] SQLite initialized at', DB_PATH);
}

// ─── Session CRUD ─────────────────────────────────────────────────────────────

function createSession({ id, shopDomain, cartToken, pageUrl, userAgent }) {
  const db = getDB();
  const now = Date.now();
  db.prepare(`
    INSERT INTO sessions (id, shop_domain, cart_token, page_url, user_agent, started_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, shopDomain, cartToken || null, pageUrl || null, userAgent || null, now, now);
  return getSession(id);
}

function getSession(id) {
  return getDB().prepare('SELECT * FROM sessions WHERE id = ?').get(id);
}

function updateSession(id, fields) {
  const db = getDB();
  const allowed = ['friction_type', 'outcome', 'cart_data', 'updated_at'];
  const updates = Object.entries(fields)
    .filter(([k]) => allowed.includes(k))
    .map(([k]) => `${k} = ?`).join(', ');
  const values = Object.entries(fields)
    .filter(([k]) => allowed.includes(k))
    .map(([, v]) => v);
  if (!updates) return;
  db.prepare(`UPDATE sessions SET ${updates}, updated_at = ? WHERE id = ?`)
    .run(...values, Date.now(), id);
}

// ─── Analytics Queries ────────────────────────────────────────────────────────

function getAnalyticsSummary() {
  const db = getDB();
  const total = db.prepare('SELECT COUNT(*) as count FROM sessions').get().count;
  const recovered = db.prepare("SELECT COUNT(*) as count FROM sessions WHERE outcome = 'recovered'").get().count;
  const abandoned = db.prepare("SELECT COUNT(*) as count FROM sessions WHERE outcome = 'abandoned'").get().count;
  const escalated = db.prepare("SELECT COUNT(*) as count FROM sessions WHERE outcome = 'escalated'").get().count;

  const frictions = db.prepare(`
    SELECT friction_type, COUNT(*) as count
    FROM sessions
    WHERE friction_type IS NOT NULL
    GROUP BY friction_type
    ORDER BY count DESC
  `).all();

  const avgMsgLength = db.prepare(`
    SELECT AVG(msg_count) as avg FROM (
      SELECT COUNT(*) as msg_count FROM messages GROUP BY session_id
    )
  `).get().avg || 0;

  return {
    totalSessions: total,
    recoveryRate: total > 0 ? ((recovered / total) * 100).toFixed(1) + '%' : '0%',
    recovered,
    abandoned,
    escalated,
    pending: total - recovered - abandoned - escalated,
    topFrictions: frictions,
    avgConversationLength: Math.round(avgMsgLength),
  };
}

module.exports = { initDB, createSession, getSession, updateSession, getAnalyticsSummary };
