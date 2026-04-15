import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "data.db");
const db = new Database(dbPath);

// Enable WAL mode for better concurrent performance
db.pragma("journal_mode = WAL");

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password TEXT NOT NULL DEFAULT '',
    kakao_id TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS worries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL,
    size REAL NOT NULL DEFAULT 85,
    float_phase REAL NOT NULL DEFAULT 0,
    float_speed REAL NOT NULL DEFAULT 0.007,
    float_amplitude_x REAL NOT NULL DEFAULT 10,
    float_amplitude_y REAL NOT NULL DEFAULT 8,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS solutions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    worry_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (worry_id) REFERENCES worries(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Migration: add kakao_id column if missing (for existing databases)
try {
  db.exec(`ALTER TABLE users ADD COLUMN kakao_id TEXT`);
} catch {
  // Column already exists
}

// Create unique index on kakao_id if not exists
try {
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_kakao_id ON users(kakao_id)`);
} catch {
  // Index already exists
}

export default db;
