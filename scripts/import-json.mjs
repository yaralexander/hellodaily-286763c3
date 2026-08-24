// Import a JSON export created during the one-time Supabase migration.
import fs from "node:fs";
import { db, ensureProfile } from "../server/database.mjs";

const exportPath = process.argv[2];
if (!exportPath) throw new Error("Usage: npm run import:json -- /path/to/export.json");
const data = JSON.parse(fs.readFileSync(exportPath, "utf8"));
const jsonFields = new Set(["health_goals","ai_analysis","nutrition","ingredients","additives","positives","concerns","alternatives","ingredient_intelligence","allergens","things_to_know","analysis","messages"]);
const tables = ["profiles","food_logs","food_scans","wellness_points","lab_results","daily_metrics","habits","habit_logs","notes","coach_sessions","weight_logs","telegram_bot_settings"];

for (const user of data.users || []) {
  const metadata = user.user_metadata || {};
  db.prepare(`INSERT OR REPLACE INTO users (id,email,google_sub,name,avatar_url,created_at) VALUES (?,?,?,?,?,?)`).run(
    user.id, user.email, user.google_sub || null, metadata.full_name || metadata.name || "", metadata.avatar_url || null, user.created_at || new Date().toISOString(),
  );
  ensureProfile({ id: user.id, name: metadata.full_name || metadata.name || "", avatar_url: metadata.avatar_url || null });
}

db.exec("PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE;");
try {
  for (const table of tables) {
    const columns = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((item) => item.name));
    let count = 0;
    for (const source of data[table] || []) {
      const row = Object.fromEntries(Object.entries(source).filter(([key]) => columns.has(key)));
      for (const [key, value] of Object.entries(row)) {
        if (jsonFields.has(key) && value != null && typeof value !== "string") row[key] = JSON.stringify(value);
        if (typeof value === "boolean") row[key] = value ? 1 : 0;
      }
      const keys = Object.keys(row);
      if (!keys.length) continue;
      db.prepare(`INSERT OR REPLACE INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`).run(...keys.map((key) => row[key]));
      count += 1;
    }
    console.log(`${table}: ${count}`);
  }
  db.exec("COMMIT; PRAGMA foreign_keys=ON;");
} catch (error) {
  db.exec("ROLLBACK; PRAGMA foreign_keys=ON;");
  throw error;
}

console.log(`users: ${(data.users || []).length}`);
