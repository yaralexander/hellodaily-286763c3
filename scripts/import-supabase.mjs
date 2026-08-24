// One-time importer. Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATA_DIR.
import { db, ensureProfile } from "../server/database.mjs";

const baseUrl = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!baseUrl || !serviceKey) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");

const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
const jsonFields = new Set(["health_goals","ai_analysis","nutrition","ingredients","additives","positives","concerns","alternatives","ingredient_intelligence","allergens","things_to_know","analysis","messages"]);
const tables = ["profiles","food_logs","food_scans","wellness_points","lab_results","daily_metrics","habits","habit_logs","notes","coach_sessions","weight_logs","telegram_bot_settings"];

async function fetchJson(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${response.status} ${url}: ${(await response.text()).slice(0, 300)}`);
  return response.json();
}

async function authUsers() {
  const users = [];
  for (let page = 1; ; page += 1) {
    const payload = await fetchJson(`${baseUrl}/auth/v1/admin/users?page=${page}&per_page=1000`);
    const batch = payload.users || payload;
    users.push(...batch);
    if (batch.length < 1000) return users;
  }
}

function insertRows(table, rows) {
  const columns = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((item) => item.name));
  let imported = 0;
  for (const source of rows) {
    const row = Object.fromEntries(Object.entries(source).filter(([key]) => columns.has(key)));
    for (const [key, value] of Object.entries(row)) {
      if (jsonFields.has(key) && value != null && typeof value !== "string") row[key] = JSON.stringify(value);
      if (typeof value === "boolean") row[key] = value ? 1 : 0;
    }
    const keys = Object.keys(row);
    if (!keys.length) continue;
    db.prepare(`INSERT OR REPLACE INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`).run(...keys.map((key) => row[key]));
    imported += 1;
  }
  console.log(`${table}: ${imported}`);
}

const users = await authUsers();
for (const user of users) {
  const googleIdentity = user.identities?.find((identity) => identity.provider === "google");
  db.prepare(`INSERT OR IGNORE INTO users (id,email,google_sub,name,avatar_url,created_at) VALUES (?,?,?,?,?,?)`).run(
    user.id, user.email, googleIdentity?.identity_data?.sub || googleIdentity?.id || null,
    user.user_metadata?.full_name || user.user_metadata?.name || "", user.user_metadata?.avatar_url || null,
    user.created_at || new Date().toISOString(),
  );
  ensureProfile({ id: user.id, name: user.user_metadata?.full_name || "", avatar_url: user.user_metadata?.avatar_url || null });
}
console.log(`users: ${users.length}`);

db.exec("PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE;");
try {
  for (const table of tables) insertRows(table, await fetchJson(`${baseUrl}/rest/v1/${table}?select=*`));
  db.exec("COMMIT; PRAGMA foreign_keys=ON;");
} catch (error) {
  db.exec("ROLLBACK; PRAGMA foreign_keys=ON;");
  throw error;
}

console.log("Supabase import complete");
