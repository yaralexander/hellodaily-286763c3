import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const dataDir = process.env.DATA_DIR || path.resolve("data");
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(path.join(dataDir, "uploads"), { recursive: true });
fs.mkdirSync(path.join(dataDir, "backups"), { recursive: true });

export const db = new DatabaseSync(path.join(dataDir, "hellodaily.sqlite"));
db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT,
  google_sub TEXT UNIQUE,
  name TEXT,
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  id_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT, avatar_url TEXT, age INTEGER, gender TEXT,
  height_cm REAL, weight_kg REAL, health_goals TEXT NOT NULL DEFAULT '[]',
  daily_calorie_limit INTEGER NOT NULL DEFAULT 2200,
  calorie_input_mode TEXT NOT NULL DEFAULT 'auto', activity_level TEXT NOT NULL DEFAULT 'moderate',
  nutrition_goal TEXT NOT NULL DEFAULT 'balanced', target_weight_kg REAL, weekly_goal_kg REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS food_logs (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meal_type TEXT NOT NULL DEFAULT 'snack', food_name TEXT NOT NULL, calories INTEGER NOT NULL DEFAULT 0,
  protein_g REAL NOT NULL DEFAULT 0, carbs_g REAL NOT NULL DEFAULT 0, fat_g REAL NOT NULL DEFAULT 0,
  portion_size TEXT, image_url TEXT, ai_analysis TEXT,
  logged_at TEXT NOT NULL DEFAULT (datetime('now')), created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_food_logs_user_logged ON food_logs(user_id, logged_at DESC);
CREATE TABLE IF NOT EXISTS food_scans (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scan_type TEXT NOT NULL, source TEXT, barcode TEXT, product_name TEXT NOT NULL DEFAULT 'Unknown', brand TEXT,
  image_url TEXT, nutrition TEXT NOT NULL DEFAULT '{}', ingredients TEXT NOT NULL DEFAULT '[]', nova_group INTEGER,
  additives TEXT NOT NULL DEFAULT '[]', health_score INTEGER NOT NULL DEFAULT 0, score_category TEXT NOT NULL DEFAULT 'moderate',
  positives TEXT NOT NULL DEFAULT '[]', concerns TEXT NOT NULL DEFAULT '[]', alternatives TEXT NOT NULL DEFAULT '[]',
  ingredient_intelligence TEXT NOT NULL DEFAULT '[]', ai_summary TEXT, coach_tip TEXT,
  goal_fit_score INTEGER NOT NULL DEFAULT 0, goal_at_scan TEXT, category TEXT, allergens TEXT NOT NULL DEFAULT '[]',
  personalized_recommendation TEXT, things_to_know TEXT NOT NULL DEFAULT '[]', added_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), scanned_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_food_scans_user_created ON food_scans(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS wellness_points (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points INTEGER NOT NULL, reason TEXT NOT NULL, scan_id TEXT REFERENCES food_scans(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS lab_results (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL, file_url TEXT, status TEXT NOT NULL DEFAULT 'processing', analysis TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS daily_metrics (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, date TEXT NOT NULL,
  steps INTEGER DEFAULT 0, heart_rate INTEGER, sleep_hours REAL, calories_burned INTEGER DEFAULT 0,
  water_ml INTEGER DEFAULT 0, mood TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(user_id,date)
);
CREATE TABLE IF NOT EXISTS habits (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, target REAL NOT NULL DEFAULT 1, unit TEXT, category TEXT, icon TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS habit_logs (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE, date TEXT NOT NULL, value REAL NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(habit_id,date)
);
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '', content TEXT NOT NULL DEFAULT '', is_todo INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS coach_sessions (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New chat', messages TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS weight_logs (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weight_kg REAL NOT NULL, logged_at TEXT NOT NULL DEFAULT (datetime('now')), note TEXT
);
CREATE TABLE IF NOT EXISTS telegram_bot_settings (
  chat_id TEXT PRIMARY KEY, lang TEXT NOT NULL DEFAULT 'ru', goal TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

export const id = () => crypto.randomUUID();
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

export function ensureProfile(user) {
  db.prepare(`INSERT OR IGNORE INTO profiles (id,user_id,display_name,avatar_url) VALUES (?,?,?,?)`)
    .run(id(), user.id, user.name || "", user.avatar_url || null);
}

export function upsertGoogleUser(identity) {
  let user = db.prepare("SELECT * FROM users WHERE google_sub=? OR email=? COLLATE NOCASE").get(identity.sub, identity.email);
  if (!user) {
    const userId = id();
    db.prepare("INSERT INTO users (id,email,google_sub,name,avatar_url) VALUES (?,?,?,?,?)")
      .run(userId, identity.email, identity.sub, identity.name || "", identity.picture || null);
    user = db.prepare("SELECT * FROM users WHERE id=?").get(userId);
  } else {
    db.prepare("UPDATE users SET google_sub=?,name=?,avatar_url=?,updated_at=datetime('now') WHERE id=?")
      .run(identity.sub, identity.name || user.name, identity.picture || user.avatar_url, user.id);
    user = db.prepare("SELECT * FROM users WHERE id=?").get(user.id);
  }
  ensureProfile(user);
  return user;
}

function passwordHash(password, salt = crypto.randomBytes(16).toString("hex")) {
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString("hex")}`;
}

export function createPasswordUser(email, password) {
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 6) throw new Error("Invalid email or password");
  const userId = id();
  db.prepare("INSERT INTO users (id,email,password_hash,name) VALUES (?,?,?,?)")
    .run(userId, email.trim().toLowerCase(), passwordHash(password), email.split("@")[0]);
  const user = db.prepare("SELECT * FROM users WHERE id=?").get(userId);
  ensureProfile(user);
  return user;
}

export function verifyPasswordUser(email, password) {
  const user = db.prepare("SELECT * FROM users WHERE email=? COLLATE NOCASE").get(email.trim());
  if (!user?.password_hash) return null;
  const [salt, expected] = user.password_hash.split(":");
  const actual = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(actual, Buffer.from(expected, "hex")) ? user : null;
}

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString("base64url");
  db.prepare("INSERT INTO sessions (id_hash,user_id,expires_at) VALUES (?,?,datetime('now','+30 days'))")
    .run(sha256(token), userId);
  return token;
}

export function getSessionUser(token) {
  if (!token) return null;
  return db.prepare(`SELECT u.id,u.email,u.name,u.avatar_url FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.id_hash=? AND s.expires_at > datetime('now')`).get(sha256(token)) || null;
}

export function deleteSession(token) {
  if (token) db.prepare("DELETE FROM sessions WHERE id_hash=?").run(sha256(token));
}

export function backupDatabase() {
  const stamp = new Date().toISOString().slice(0, 10);
  db.exec("PRAGMA wal_checkpoint(FULL)");
  fs.copyFileSync(path.join(dataDir, "hellodaily.sqlite"), path.join(dataDir, "backups", `hellodaily-${stamp}.sqlite`));
}

export { dataDir };
