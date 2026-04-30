
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let db;

function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const migrationsDir = path.join(__dirname, 'db', 'migrations');
  if (!fs.existsSync(migrationsDir)) return;

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const applied = db.prepare('SELECT name FROM migrations').all().map(m => m.name);

  for (const file of files) {
    if (!applied.includes(file)) {
      console.log(`[LOCAL DB] Aplicando migracao: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      
      db.transaction(() => {
        db.exec(sql);
        db.prepare('INSERT INTO migrations (name) VALUES (?)').run(file);
      })();
    }
  }
}

function initLocalDb(userDataPath) {
  const dbPath = path.join(userDataPath, 'ecosystem.local.db');
  console.log(`[LOCAL DB] Inicializando banco SQLite em: ${dbPath}`);
  
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL'); 
  
  runMigrations(db);

  return db;
}

function getLocalDb() {
  if (!db) throw new Error('Local DB not initialized. Call initLocalDb first.');
  return db;
}

module.exports = {
  initLocalDb,
  getLocalDb
};
