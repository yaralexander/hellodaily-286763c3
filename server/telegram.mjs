import crypto from "node:crypto";
import { db } from "./database.mjs";
import { calculateHealthScore } from "./health-score.mjs";

const goals = ["balanced","weight_loss","muscle_gain","high_protein","keto","low_carb","heart_health","diabetes_friendly","mediterranean","high_fiber","whole_food","low_sodium","plant_based"];
const labels = {
  balanced: ["Сбалансированное питание", "Balanced nutrition"], weight_loss: ["Снижение веса", "Weight loss"],
  muscle_gain: ["Набор мышц", "Muscle gain"], high_protein: ["Много белка", "High protein"], keto: ["Кето", "Keto"],
  low_carb: ["Мало углеводов", "Low carb"], heart_health: ["Здоровье сердца", "Heart health"],
  diabetes_friendly: ["При диабете", "Diabetes friendly"], mediterranean: ["Средиземноморская", "Mediterranean"],
  high_fiber: ["Много клетчатки", "High fiber"], whole_food: ["Натуральные продукты", "Whole food"],
  low_sodium: ["Мало соли", "Low sodium"], plant_based: ["Растительное", "Plant based"],
};

const token = process.env.TELEGRAM_BOT_TOKEN || "";
const api = `https://api.telegram.org/bot${token}`;
const secret = token ? crypto.createHash("sha256").update(`telegram-webhook:${token}`).digest("base64url") : "";
const keyboardLanguage = { inline_keyboard: [[{ text: "🇷🇺 Русский", callback_data: "lang:ru" }, { text: "🇬🇧 English", callback_data: "lang:en" }]] };
const goalKeyboard = (lang) => ({ inline_keyboard: goals.map((goal) => [{ text: labels[goal][lang === "ru" ? 0 : 1], callback_data: `goal:${goal}` }]) });
const tr = (lang, ru, en) => lang === "ru" ? ru : en;

async function tg(method, body) {
  const response = await fetch(`${api}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`Telegram ${method} failed`);
  return response.json();
}

async function send(chatId, text, replyMarkup) { return tg("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", reply_markup: replyMarkup }); }
const settings = (chatId) => db.prepare("SELECT * FROM telegram_bot_settings WHERE chat_id=?").get(String(chatId));
function save(chatId, patch) {
  const old = settings(chatId) || {};
  db.prepare(`INSERT OR REPLACE INTO telegram_bot_settings (chat_id,lang,goal,created_at,updated_at) VALUES (?,?,?,?,?)`).run(String(chatId), patch.lang || old.lang || "ru", patch.goal ?? old.goal ?? null, old.created_at || new Date().toISOString(), new Date().toISOString());
}

async function imageData(fileId) {
  const info = await tg("getFile", { file_id: fileId });
  const filePath = info.result?.file_path;
  if (!filePath) throw new Error("Telegram image is unavailable");
  const response = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
  return { base64: Buffer.from(await response.arrayBuffer()).toString("base64"), mimeType: filePath.endsWith(".png") ? "image/png" : "image/jpeg" };
}

async function analyze(content, lang) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OpenAI is not configured");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4.1-mini", response_format: { type: "json_object" }, messages: [
      { role: "system", content: `Analyze meals. Write in ${lang === "ru" ? "Russian" : "English"}. Return JSON: {"dish_name":"","portion":"","portion_grams":100,"is_beverage":false,"has_sweeteners":false,"fruit_vegetable_legume_percent":0,"nutrition":{"calories":0,"protein_g":0,"carbs_g":0,"fat_g":0,"sugar_g":0,"fiber_g":0,"saturated_fat_g":0,"salt_g":0},"nova_group":1,"additives":[],"good":[],"know":[],"tip":""}. Nutrition is for the complete stated portion. portion_grams is edible mass. Do not assign a health score and do not treat digestive sensitivity as poor food quality.` },
      { role: "user", content },
    ] }),
  });
  if (!response.ok) throw new Error("AI analysis failed");
  const payload = await response.json();
  return JSON.parse(payload.choices?.[0]?.message?.content || "{}");
}

function escapeHtml(value) { return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

export async function telegramWebhook(req, res) {
  if (!token || !secret) return res.status(503).json({ error: "Telegram is not configured" });
  const supplied = String(req.get("X-Telegram-Bot-Api-Secret-Token") || "");
  if (supplied.length !== secret.length || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(secret))) return res.status(401).json({ error: "Unauthorized" });
  res.json({ ok: true });
  try {
    const update = req.body || {};
    const callback = update.callback_query;
    if (callback?.data) {
      await tg("answerCallbackQuery", { callback_query_id: callback.id });
      const chatId = callback.message?.chat?.id; if (!chatId) return;
      if (callback.data.startsWith("lang:")) { const lang = callback.data.endsWith("en") ? "en" : "ru"; save(chatId, { lang }); await send(chatId, tr(lang, "🎯 Выберите цель питания", "🎯 Choose your nutrition goal"), goalKeyboard(lang)); }
      if (callback.data.startsWith("goal:")) { const goal = callback.data.slice(5); const cfg = settings(chatId); if (goals.includes(goal)) save(chatId, { goal }); await send(chatId, tr(cfg?.lang, "✅ Готово. Отправьте фото или описание еды.", "✅ Done. Send a food photo or description.")); }
      return;
    }
    const message = update.message || update.edited_message;
    const chatId = message?.chat?.id; if (!chatId) return;
    const cfg = settings(chatId);
    const text = message.text || message.caption || "";
    if (!cfg || text.startsWith("/language") || text.startsWith("/lang")) return void await send(chatId, "🌍 Выберите язык / Choose language", keyboardLanguage);
    const lang = cfg.lang || "ru";
    if (!cfg.goal || text.startsWith("/goal")) return void await send(chatId, tr(lang, "🎯 Выберите цель питания", "🎯 Choose your nutrition goal"), goalKeyboard(lang));
    if (text.startsWith("/start") || text.startsWith("/help") || (!text && !message.photo?.length)) return void await send(chatId, tr(lang, "👋 Отправьте фото или описание еды — я оценю калории, БЖУ и качество.", "👋 Send a food photo or description for calories, macros and quality."));
    await send(chatId, tr(lang, "🔍 Анализирую…", "🔍 Analyzing…"));
    let content = text;
    if (message.photo?.length) { const photo = await imageData(message.photo.at(-1).file_id); content = [{ type: "text", text: "Analyze this meal photo" }, { type: "image_url", image_url: { url: `data:${photo.mimeType};base64,${photo.base64}` } }]; }
    const result = await analyze(content, lang);
    const nutrition = result.nutrition || {};
    const score = calculateHealthScore(nutrition, { portionGrams: result.portion_grams, novaGroup: result.nova_group, additives: result.additives, isBeverage: result.is_beverage, hasSweeteners: result.has_sweeteners, fruitVegetableLegumePercent: result.fruit_vegetable_legume_percent });
    const lines = [`${score >= 80 ? "🟢" : score >= 60 ? "🟡" : score >= 40 ? "🟠" : "🔴"} <b>${escapeHtml(result.dish_name)}</b>`, result.portion ? escapeHtml(result.portion) : "", "", `<b>Health Score:</b> ${score}/100`, `🔥 ${Math.round(nutrition.calories || 0)} kcal · P ${Math.round(nutrition.protein_g || 0)}g · C ${Math.round(nutrition.carbs_g || 0)}g · F ${Math.round(nutrition.fat_g || 0)}g`, ...(result.good || []).slice(0, 3).map((x) => `✅ ${escapeHtml(x)}`), ...(result.know || []).slice(0, 3).map((x) => `ℹ️ ${escapeHtml(x)}`), result.tip ? `💡 ${escapeHtml(result.tip)}` : ""].filter(Boolean);
    await send(chatId, lines.join("\n"));
  } catch (error) { console.error("Telegram webhook failed", error instanceof Error ? error.message : error); }
}
