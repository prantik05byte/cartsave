const { getDB } = require('./Session');

// Re-export getDB with a local alias so Message.js can be standalone
function _db() {
  // Session.js manages the singleton; we just call its exported getDB
  return require('./Session').initDB && require('better-sqlite3');
}

function saveMessage({ sessionId, role, content }) {
  // Use the same DB instance via Session module
  const Database = require('better-sqlite3');
  const path = require('path');
  const DB_PATH = path.join(__dirname, '../data/cartsave.db');

  // Lazy singleton — reuses file already created by Session.initDB
  if (!saveMessage._db) {
    saveMessage._db = new Database(DB_PATH);
  }
  const db = saveMessage._db;

  db.prepare(`
    INSERT INTO messages (session_id, role, content, created_at)
    VALUES (?, ?, ?, ?)
  `).run(sessionId, role, content, Date.now());
}

function getMessages(sessionId) {
  const Database = require('better-sqlite3');
  const path = require('path');
  const DB_PATH = path.join(__dirname, '../data/cartsave.db');
  if (!getMessages._db) {
    getMessages._db = new Database(DB_PATH);
  }
  return getMessages._db.prepare(`
    SELECT role, content, created_at
    FROM messages
    WHERE session_id = ?
    ORDER BY created_at ASC
  `).all(sessionId);
}

module.exports = { saveMessage, getMessages };
