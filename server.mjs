import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { OAuth2Client } from "google-auth-library";
import { backupDatabase, createPasswordUser, createSession, dataDir, db, deleteSession, getSessionUser, id, upsertGoogleUser, verifyPasswordUser } from "./server/database.mjs";
import { analyzeFood, analyzeFoodText, recalculateGoal, scanBarcode, scanImage, scanText } from "./server/food-ai.mjs";
import { telegramWebhook } from "./server/telegram.mjs";

const app = express();
const port = Number(process.env.PORT || 3000);
const siteUrl = new URL(process.env.SITE_URL || "http://localhost:3000").origin;
const allowedSiteUrls = new Set([siteUrl, "https://hellodaily.pages.dev"]);
const googleClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
function requestSiteUrl(req) {
  const forwarded = req.get("x-hellodaily-origin");
  if (!forwarded) return siteUrl;
  try {
    const origin = new URL(forwarded).origin;
    return allowedSiteUrls.has(origin) ? origin : siteUrl;
  } catch {
    return siteUrl;
  }
}

function oauthClientFor(origin) {
  return new OAuth2Client(googleClientId, googleClientSecret, `${origin}/account/auth/google/callback`);
}
const distDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "dist");

app.set("trust proxy", true);
app.disable("x-powered-by");
app.use(express.json({ limit: "25mb" }));

const cookieOptions = `Path=/account/auth/google/callback; HttpOnly; SameSite=Lax; Max-Age=600; Secure`;

function randomBase64Url(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function sha256Base64Url(value) {
  return crypto.createHash("sha256").update(value).digest("base64url");
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .map((part) => part.trim().split("="))
      .filter(([name, value]) => name && value)
      .map(([name, ...value]) => [name, decodeURIComponent(value.join("="))]),
  );
}

function setOAuthCookie(res, name, value) {
  res.append("Set-Cookie", `${name}=${encodeURIComponent(value)}; ${cookieOptions}`);
}

function clearOAuthCookies(res) {
  for (const name of ["hd_oauth_state", "hd_oauth_nonce", "hd_oauth_verifier"]) {
    res.append("Set-Cookie", `${name}=; ${cookieOptions}; Max-Age=0`);
  }
}

function sessionCookie(token, maxAge = 2_592_000) {
  return `hd_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${siteUrl.startsWith("https://") ? "; Secure" : ""}`;
}

function currentUser(req) {
  return getSessionUser(readCookies(req).hd_session);
}

function requireUser(req, res) {
  const user = currentUser(req);
  if (!user) res.status(401).json({ error: "Unauthorized" });
  return user;
}

function requireOAuthConfig(res) {
  if (googleClientId && googleClientSecret) return true;
  res.status(503).send("Google authentication is not configured");
  return false;
}

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.get("/account/login/start", (req, res) => {
  if (!requireOAuthConfig(res)) return;

  const state = randomBase64Url();
  const nonce = randomBase64Url();
  const verifier = randomBase64Url(48);
  setOAuthCookie(res, "hd_oauth_state", state);
  setOAuthCookie(res, "hd_oauth_nonce", nonce);
  setOAuthCookie(res, "hd_oauth_verifier", verifier);

  const origin = requestSiteUrl(req);
  res.redirect(oauthClientFor(origin).generateAuthUrl({
    access_type: "online",
    scope: ["openid", "email", "profile"],
    prompt: "select_account",
    state,
    nonce: sha256Hex(nonce),
    code_challenge_method: "S256",
    code_challenge: sha256Base64Url(verifier),
  }));
});

app.get("/account/auth/google/callback", async (req, res) => {
  if (!requireOAuthConfig(res)) return;
  const cookies = readCookies(req);
  clearOAuthCookies(res);

  try {
    if (typeof req.query.error === "string") throw new Error(req.query.error);
    if (typeof req.query.code !== "string" || typeof req.query.state !== "string") {
      throw new Error("Google did not return an authorization code");
    }
    if (!cookies.hd_oauth_state || !crypto.timingSafeEqual(Buffer.from(req.query.state), Buffer.from(cookies.hd_oauth_state))) {
      throw new Error("Invalid OAuth state");
    }
    if (!cookies.hd_oauth_nonce || !cookies.hd_oauth_verifier) throw new Error("OAuth session expired");

    const origin = requestSiteUrl(req);
    const callbackUrl = `${origin}/account/auth/google/callback`;
    const oauthClient = oauthClientFor(origin);
    const { tokens } = await oauthClient.getToken({
      code: req.query.code,
      codeVerifier: cookies.hd_oauth_verifier,
      redirect_uri: callbackUrl,
    });
    if (!tokens.id_token) throw new Error("Google did not return an ID token");

    const ticket = await oauthClient.verifyIdToken({ idToken: tokens.id_token, audience: googleClientId });
    const identity = ticket.getPayload();
    if (!identity?.email_verified || identity.nonce !== sha256Hex(cookies.hd_oauth_nonce)) {
      throw new Error("Google identity verification failed");
    }

    const localUser = upsertGoogleUser(identity);
    res.append("Set-Cookie", sessionCookie(createSession(localUser.id)));

    res.redirect(303, "/");
  } catch (error) {
    console.error("Google OAuth callback failed:", error instanceof Error ? error.message : error);
    res.redirect(303, "/auth?oauth_error=google");
  }
});

app.get("/api/auth/session", (req, res) => {
  const user = currentUser(req);
  res.set("Cache-Control", "no-store").json({ user });
});

app.post("/api/auth/signup", (req, res) => {
  try {
    const user = createPasswordUser(String(req.body.email || ""), String(req.body.password || ""));
    res.append("Set-Cookie", sessionCookie(createSession(user.id)));
    res.status(201).json({ user: { id: user.id, email: user.email, name: user.name, avatar_url: user.avatar_url } });
  } catch (error) {
    res.status(400).json({ error: String(error.message || error).includes("UNIQUE") ? "Email is already registered" : String(error.message || error) });
  }
});

app.post("/api/auth/password", (req, res) => {
  const user = verifyPasswordUser(String(req.body.email || ""), String(req.body.password || ""));
  if (!user) return res.status(401).json({ error: "Invalid email or password" });
  res.append("Set-Cookie", sessionCookie(createSession(user.id)));
  res.json({ user: { id: user.id, email: user.email, name: user.name, avatar_url: user.avatar_url } });
});

app.post("/api/auth/signout", (req, res) => {
  deleteSession(readCookies(req).hd_session);
  res.append("Set-Cookie", sessionCookie("", 0));
  res.json({ ok: true });
});

const jsonColumns = new Set(["health_goals", "ai_analysis", "nutrition", "ingredients", "additives", "positives", "concerns", "alternatives", "ingredient_intelligence", "allergens", "things_to_know", "analysis", "messages"]);
const allowedTables = new Set(["profiles", "food_logs", "food_scans", "wellness_points", "lab_results", "daily_metrics", "habits", "habit_logs", "notes", "coach_sessions", "weight_logs"]);
const tableColumns = new Map([...allowedTables].map((table) => [table, new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name))]));

function decodeRow(row) {
  if (!row) return row;
  return Object.fromEntries(Object.entries(row).map(([key, value]) => {
    if (jsonColumns.has(key) && typeof value === "string") {
      try { return [key, JSON.parse(value)]; } catch { return [key, value]; }
    }
    if (["is_todo", "completed"].includes(key)) return [key, !!value];
    return [key, value];
  }));
}

function encodeRecord(record, userId, table, includeId = true) {
  const columns = tableColumns.get(table);
  const result = Object.fromEntries(Object.entries(record).filter(([key]) => columns.has(key)));
  result.user_id = userId;
  if (includeId && !result.id) result.id = id();
  if (includeId) {
    const now = new Date().toISOString();
    if (columns.has("created_at") && !result.created_at) result.created_at = now;
    if (columns.has("logged_at") && !result.logged_at) result.logged_at = now;
    if (columns.has("scanned_at") && !result.scanned_at) result.scanned_at = now;
  }
  for (const key of Object.keys(result)) {
    if (jsonColumns.has(key) && result[key] != null && typeof result[key] !== "string") result[key] = JSON.stringify(result[key]);
    if (typeof result[key] === "boolean") result[key] = result[key] ? 1 : 0;
  }
  return result;
}

app.get("/api/data/:table", (req, res) => {
  const user = requireUser(req, res); if (!user) return;
  const { table } = req.params;
  if (!allowedTables.has(table)) return res.status(404).json({ error: "Unknown resource" });
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const orderColumn = ["created_at", "logged_at", "scanned_at", "date"].includes(String(req.query.order)) ? String(req.query.order) : "created_at";
  const direction = req.query.ascending === "true" ? "ASC" : "DESC";
  const rows = db.prepare(`SELECT * FROM ${table} WHERE user_id=? ORDER BY ${orderColumn} ${direction} LIMIT ?`).all(user.id, limit);
  res.json(rows.map(decodeRow));
});

app.get("/api/data/:table/:recordId", (req, res) => {
  const user = requireUser(req, res); if (!user) return;
  const { table, recordId } = req.params;
  if (!allowedTables.has(table)) return res.status(404).json({ error: "Unknown resource" });
  const row = db.prepare(`SELECT * FROM ${table} WHERE id=? AND user_id=?`).get(recordId, user.id);
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(decodeRow(row));
});

app.post("/api/data/:table", (req, res) => {
  const user = requireUser(req, res); if (!user) return;
  const { table } = req.params;
  if (!allowedTables.has(table)) return res.status(404).json({ error: "Unknown resource" });
  const records = (Array.isArray(req.body) ? req.body : [req.body]).map((row) => encodeRecord(row, user.id, table));
  const inserted = [];
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const record of records) {
      const keys = Object.keys(record);
      db.prepare(`INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`).run(...keys.map((key) => record[key]));
      inserted.push(decodeRow(db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(record.id)));
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  res.status(201).json(inserted);
});

app.patch("/api/data/:table/:recordId", (req, res) => {
  const user = requireUser(req, res); if (!user) return;
  const { table, recordId } = req.params;
  if (!allowedTables.has(table)) return res.status(404).json({ error: "Unknown resource" });
  const record = encodeRecord(req.body, user.id, table, false);
  delete record.user_id; delete record.id; delete record.created_at;
  const keys = Object.keys(record);
  if (keys.length) db.prepare(`UPDATE ${table} SET ${keys.map((key) => `${key}=?`).join(",")} WHERE id=? AND user_id=?`).run(...keys.map((key) => record[key]), recordId, user.id);
  res.json(decodeRow(db.prepare(`SELECT * FROM ${table} WHERE id=? AND user_id=?`).get(recordId, user.id)));
});

app.delete("/api/data/:table/:recordId", (req, res) => {
  const user = requireUser(req, res); if (!user) return;
  const { table, recordId } = req.params;
  if (!allowedTables.has(table)) return res.status(404).json({ error: "Unknown resource" });
  db.prepare(`DELETE FROM ${table} WHERE id=? AND user_id=?`).run(recordId, user.id);
  res.json({ ok: true });
});

app.post("/api/uploads", async (req, res) => {
  const user = requireUser(req, res); if (!user) return;
  const bucket = String(req.body.bucket || "").replace(/[^a-z0-9_-]/gi, "");
  const relativePath = String(req.body.path || "").split("/").map((part) => part.replace(/[^a-z0-9._-]/gi, "")).filter(Boolean).join("/");
  const content = String(req.body.base64 || "");
  if (!bucket || !relativePath || !content || content.length > 20_000_000) return res.status(400).json({ error: "Invalid upload" });
  const target = path.join(dataDir, "uploads", bucket, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, Buffer.from(content, "base64"));
  res.status(201).json({ path: relativePath });
});

app.post("/api/functions/:name", async (req, res) => {
  const user = requireUser(req, res); if (!user) return;
  try {
    const handlers = {
      "scan-text": () => scanText(user.id, req.body),
      "scan-meal": () => scanImage(user.id, req.body, "meal"),
      "scan-package": () => scanImage(user.id, req.body, "package"),
      "scan-barcode": () => scanBarcode(user.id, req.body),
      "analyze-food": () => analyzeFood(req.body),
      "analyze-food-text": () => analyzeFoodText(req.body),
      "recalc-goal-fit": () => recalculateGoal(user.id, req.body.goal),
    };
    const handler = handlers[req.params.name];
    if (!handler) return res.status(404).json({ error: "Unknown function" });
    res.json(await handler());
  } catch (error) {
    console.error(`${req.params.name} failed`, error instanceof Error ? error.message : error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Request failed" });
  }
});

app.post("/api/telegram/webhook", telegramWebhook);

app.use("/uploads", express.static(path.join(dataDir, "uploads"), { immutable: true, maxAge: "1y" }));
setInterval(() => { try { backupDatabase(); } catch (error) { console.error("SQLite backup failed", error); } }, 86_400_000).unref();

app.use((error, _req, res, _next) => {
  console.error("API request failed", error instanceof Error ? error.message : error);
  res.status(500).json({ error: "Internal server error" });
});

app.use(express.static(distDir, { index: false, maxAge: "1h" }));
app.use((_req, res) => res.sendFile(path.join(distDir, "index.html")));

const server = app.listen(port, "0.0.0.0", () => {
  console.log(`Hello Daily listening on port ${port}`);
});
server.ref();
