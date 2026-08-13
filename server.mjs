import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { OAuth2Client } from "google-auth-library";

const app = express();
const port = Number(process.env.PORT || 3000);
const siteUrl = new URL(process.env.SITE_URL || "http://localhost:3000").origin;
const googleClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const callbackUrl = `${siteUrl}/account/auth/google/callback`;
const oauthClient = new OAuth2Client(googleClientId, googleClientSecret, callbackUrl);
const distDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "dist");
const handoffs = new Map();

app.set("trust proxy", true);
app.disable("x-powered-by");

const cookieOptions = `Path=/account/auth/google/callback; HttpOnly; SameSite=Lax; Max-Age=600${siteUrl.startsWith("https://") ? "; Secure" : ""}`;

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

function requireOAuthConfig(res) {
  if (googleClientId && googleClientSecret && supabaseUrl && supabaseKey) return true;
  res.status(503).send("Google authentication is not configured");
  return false;
}

async function createSupabaseSession(idToken, nonce) {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=id_token`, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ provider: "google", id_token: idToken, nonce }),
  });

  const payload = await response.json();
  if (!response.ok || !payload.access_token || !payload.refresh_token) {
    throw new Error(payload.error_description || payload.msg || "Supabase rejected the Google identity");
  }
  return { access_token: payload.access_token, refresh_token: payload.refresh_token };
}

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.get("/account/login/start", (_req, res) => {
  if (!requireOAuthConfig(res)) return;

  const state = randomBase64Url();
  const nonce = randomBase64Url();
  const verifier = randomBase64Url(48);
  setOAuthCookie(res, "hd_oauth_state", state);
  setOAuthCookie(res, "hd_oauth_nonce", nonce);
  setOAuthCookie(res, "hd_oauth_verifier", verifier);

  res.redirect(oauthClient.generateAuthUrl({
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

    const session = await createSupabaseSession(tokens.id_token, cookies.hd_oauth_nonce);
    const handoff = randomBase64Url();
    handoffs.set(handoff, { session, expiresAt: Date.now() + 120_000 });
    res.redirect(303, `/auth?oauth_handoff=${encodeURIComponent(handoff)}`);
  } catch (error) {
    console.error("Google OAuth callback failed:", error instanceof Error ? error.message : error);
    res.redirect(303, "/auth?oauth_error=google");
  }
});

app.get("/account/auth/session", (req, res) => {
  const handoff = typeof req.query.handoff === "string" ? req.query.handoff : "";
  const record = handoffs.get(handoff);
  handoffs.delete(handoff);
  if (!record || record.expiresAt < Date.now()) {
    res.status(400).json({ error: "OAuth session expired" });
    return;
  }
  res.set("Cache-Control", "no-store").json(record.session);
});

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of handoffs) {
    if (record.expiresAt < now) handoffs.delete(key);
  }
}, 60_000).unref();

app.use(express.static(distDir, { index: false, maxAge: "1h" }));
app.use((_req, res) => res.sendFile(path.join(distDir, "index.html")));

app.listen(port, "0.0.0.0", () => {
  console.log(`Hello Daily listening on port ${port}`);
});
