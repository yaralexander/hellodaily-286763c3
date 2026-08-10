import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { analyzeProduct } from "../_shared/analyzePipeline.ts";
import type { NormalizedProduct } from "../_shared/foodAdapters.ts";
import type { NutritionGoal } from "../_shared/goalFit.ts";

const GATEWAY = "https://connector-gateway.lovable.dev/telegram";
const AI = "https://ai.gateway.lovable.dev/v1/chat/completions";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");

function tgHeaders() {
  return {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": TELEGRAM_API_KEY!,
    "Content-Type": "application/json",
  };
}

async function deriveSecret(key: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`telegram-webhook:${key}`));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function safeEqual(a: string | null, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function sendMessage(chatId: number, text: string, replyMarkup?: unknown) {
  const r = await fetch(`${GATEWAY}/sendMessage`, {
    method: "POST",
    headers: tgHeaders(),
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", reply_markup: replyMarkup }),
  });
  if (!r.ok) console.error("sendMessage failed", r.status, await r.text());
}

async function answerCallback(id: string) {
  await fetch(`${GATEWAY}/answerCallbackQuery`, {
    method: "POST", headers: tgHeaders(), body: JSON.stringify({ callback_query_id: id }),
  });
}

// ---- language ----
type Lang = "ru" | "en";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

type Settings = { lang: Lang; goal: NutritionGoal | null } | null;

async function getSettings(chatId: number): Promise<Settings> {
  const { data } = await supabase
    .from("telegram_bot_settings").select("lang, goal").eq("chat_id", chatId).maybeSingle();
  if (!data) return null;
  return { lang: (data.lang as Lang) ?? "ru", goal: (data.goal as NutritionGoal) ?? null };
}

async function saveSettings(chatId: number, patch: { lang?: Lang; goal?: NutritionGoal }) {
  await supabase.from("telegram_bot_settings")
    .upsert({ chat_id: chatId, ...patch, updated_at: new Date().toISOString() }, { onConflict: "chat_id" });
}

const LANG_KEYBOARD = {
  inline_keyboard: [[
    { text: "🇷🇺 Русский", callback_data: "lang:ru" },
    { text: "🇬🇧 English", callback_data: "lang:en" },
  ]],
};

// ---- goals (same list & scoring as the website) ----
const GOALS: { id: NutritionGoal; emoji: string; ru: string; en: string }[] = [
  { id: "balanced", emoji: "⚖️", ru: "Сбалансированное питание", en: "Balanced Nutrition" },
  { id: "weight_loss", emoji: "🔥", ru: "Снижение веса", en: "Weight Loss" },
  { id: "muscle_gain", emoji: "💪", ru: "Набор мышц", en: "Muscle Gain" },
  { id: "high_protein", emoji: "🥩", ru: "Много белка", en: "High Protein" },
  { id: "keto", emoji: "🥑", ru: "Кето", en: "Keto Diet" },
  { id: "low_carb", emoji: "🌾", ru: "Мало углеводов", en: "Low Carb" },
  { id: "heart_health", emoji: "❤️", ru: "Здоровье сердца", en: "Heart Health" },
  { id: "diabetes_friendly", emoji: "🩺", ru: "При диабете", en: "Diabetes Friendly" },
  { id: "mediterranean", emoji: "🫒", ru: "Средиземноморская", en: "Mediterranean" },
  { id: "high_fiber", emoji: "🌿", ru: "Много клетчатки", en: "High Fiber" },
  { id: "whole_food", emoji: "🥗", ru: "Натуральные продукты", en: "Whole Food" },
  { id: "low_sodium", emoji: "🧂", ru: "Мало соли", en: "Low Sodium" },
  { id: "plant_based", emoji: "🌱", ru: "Растительное", en: "Plant Based" },
];

function goalLabel(id: NutritionGoal, lang: Lang) {
  const g = GOALS.find((x) => x.id === id) ?? GOALS[0];
  return `${g.emoji} ${lang === "ru" ? g.ru : g.en}`;
}

function goalKeyboard(lang: Lang) {
  const rows: unknown[][] = [];
  for (let i = 0; i < GOALS.length; i += 2) {
    rows.push(GOALS.slice(i, i + 2).map((g) => ({
      text: `${g.emoji} ${lang === "ru" ? g.ru : g.en}`,
      callback_data: `goal:${g.id}`,
    })));
  }
  return { inline_keyboard: rows };
}

const T = {
  ru: {
    choose: "🌍 <b>Шаг 1 из 2.</b> Выбери язык бота:\n\nChoose your language:",
    saved: "✅ Язык: Русский.",
    chooseGoal: `🎯 <b>Шаг 2 из 2.</b> Выбери свою цель питания.

От неё зависит <b>Goal Fit</b> — насколько продукт подходит именно тебе.`,
    goalSaved: (g: string) => `✅ Цель: <b>${g}</b>\n\nМожно поменять командой /goal.`,
    help: `👋 Привет! Я бот <b>Hello Daily</b>.

📸 Отправь мне <b>фото еды</b> — я оценю блюдо так же, как на сайте: Health Score, Goal Fit, калории, БЖУ и советы.
✍️ Можно и просто описать блюдо текстом.
🎯 /goal — сменить цель питания.
🌍 /language — сменить язык.
📊 /criteria — как я ставлю оценку.

⚠️ Оценки приблизительные и не являются медицинской рекомендацией.`,
    criteria: `📊 <b>Как я ставлю оценку</b> (та же логика, что на сайте)

<b>Health Score 0–100</b> — качество продукта само по себе:
• 🍬 сахар и добавленный сахар
• 🧂 соль / натрий
• 🥓 насыщенные и транс-жиры
• 🔥 калорийность на 100 г
• 🌿 клетчатка, белок, витамины и минералы
• 🏭 степень переработки (NOVA 1–4) и добавки E-***
• 🧪 качество ингредиентов (подсластители, красители, масла)

🟢 80–100 отлично · 🟡 60–79 хорошо · 🟠 40–59 средне · 🔴 0–39 лучше избегать

<b>Goal Fit 0–100</b> — насколько продукт подходит <i>твоей цели</i>:
• Снижение веса — меньше калорий и сахара, больше клетчатки и белка
• Набор мышц / много белка — доля белка на калорию
• Кето / мало углеводов — чистые углеводы и сахар
• Здоровье сердца — насыщенные жиры, натрий, клетчатка
• При диабете — сахар, чистые углеводы, клетчатка
• Средиземноморская, много клетчатки, натуральные продукты, мало соли, растительное — по своим критериям

⚠️ Оценки приблизительные и не являются медицинской рекомендацией.`,
    analyzing: "🔍 Анализирую…",
    error: "😕 Не удалось проанализировать. Попробуй ещё раз — лучше при хорошем освещении и крупным планом.",
    dish: "Блюдо",
    portion: "Порция",
    goalLine: "Цель",
    good: "<b>✅ Плюсы</b>",
    know: "<b>ℹ️ Стоит знать</b>",
    kcal: "ккал", p: "Б", c: "У", f: "Ж",
    disclaimer: "<i>Оценка приблизительная и не является медицинской рекомендацией.</i>",
    textPrompt: (t: string) => `Блюдо: ${t}.`,
  },
  en: {
    choose: "🌍 <b>Step 1 of 2.</b> Choose your language:\n\nВыбери язык бота:",
    saved: "✅ Language: English.",
    chooseGoal: `🎯 <b>Step 2 of 2.</b> Pick your nutrition goal.

It drives your <b>Goal Fit</b> — how well a food matches you personally.`,
    goalSaved: (g: string) => `✅ Goal: <b>${g}</b>\n\nChange it anytime with /goal.`,
    help: `👋 Hi! I'm the <b>Hello Daily</b> bot.

📸 Send me a <b>photo of your food</b> — I'll rate it just like on the website: Health Score, Goal Fit, calories, macros and tips.
✍️ You can also just describe the dish in text.
🎯 /goal — change your nutrition goal.
🌍 /language — change language.
📊 /criteria — how I score food.

⚠️ Estimates are approximate and not medical advice.`,
    criteria: `📊 <b>How I score food</b> (same logic as the website)

<b>Health Score 0–100</b> — the quality of the food itself:
• 🍬 sugar and added sugar
• 🧂 salt / sodium
• 🥓 saturated and trans fats
• 🔥 calorie density per 100 g
• 🌿 fiber, protein, vitamins and minerals
• 🏭 processing level (NOVA 1–4) and E-additives
• 🧪 ingredient quality (sweeteners, colorings, oils)

🟢 80–100 excellent · 🟡 60–79 good · 🟠 40–59 moderate · 🔴 0–39 avoid

<b>Goal Fit 0–100</b> — how well it matches <i>your goal</i>:
• Weight loss — fewer calories and sugar, more fiber and protein
• Muscle gain / high protein — protein per calorie
• Keto / low carb — net carbs and sugar
• Heart health — saturated fat, sodium, fiber
• Diabetes friendly — sugar, net carbs, fiber
• Mediterranean, high fiber, whole food, low sodium, plant based — each by its own criteria

⚠️ Estimates are approximate and not medical advice.`,
    analyzing: "🔍 Analyzing…",
    error: "😕 Couldn't analyze that. Please try again — good lighting and a close-up help.",
    dish: "Dish",
    portion: "Portion",
    goalLine: "Goal",
    good: "<b>✅ What's good</b>",
    know: "<b>ℹ️ Things to know</b>",
    kcal: "kcal", p: "P", c: "C", f: "F",
    disclaimer: "<i>This estimate is approximate and not medical advice.</i>",
    textPrompt: (t: string) => `Dish: ${t}.`,
  },
} as const;

async function downloadPhoto(fileId: string): Promise<{ base64: string; mimeType: string }> {
  const fr = await fetch(`${GATEWAY}/getFile`, {
    method: "POST", headers: tgHeaders(), body: JSON.stringify({ file_id: fileId }),
  });
  if (!fr.ok) throw new Error(`getFile failed [${fr.status}]: ${await fr.text()}`);
  const fd = await fr.json();
  const path = fd?.result?.file_path;
  if (!path) throw new Error(`getFile: no file_path (${JSON.stringify(fd)})`);

  const dr = await fetch(`${GATEWAY}/file/${path}`, {
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": TELEGRAM_API_KEY! },
  });
  if (!dr.ok) throw new Error(`download failed [${dr.status}]`);
  const buf = new Uint8Array(await dr.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  const mimeType = path.endsWith(".png") ? "image/png" : "image/jpeg";
  return { base64: btoa(bin), mimeType };
}

async function visionAnalyze(base64: string, mimeType: string, lang: "ru" | "en" = "ru") {
  const r = await fetch(AI, {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "You estimate nutrition of meals from photos. Output JSON only." },
        {
          role: "user",
          content: [
            { type: "text", text: `Identify and estimate. dish_name and portion_estimate must be in ${lang === "ru" ? "Russian" : "English"}. Return JSON:
{"dish_name":"","portion_estimate":"","ingredients":["..."],
"nutrition":{"calories":0,"protein_g":0,"carbs_g":0,"sugar_g":0,"fiber_g":0,"fat_g":0,"saturated_fat_g":0,"salt_g":0},
"nova_group":1,"additives":[]}` },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
          ],
        },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!r.ok) throw new Error(`Vision failed [${r.status}]: ${await r.text()}`);
  const v = await r.json();
  return JSON.parse(v.choices?.[0]?.message?.content || "{}");
}

function esc(s: string) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function scoreEmoji(s: number) {
  return s >= 80 ? "🟢" : s >= 60 ? "🟡" : s >= 40 ? "🟠" : "🔴";
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!LOVABLE_API_KEY || !TELEGRAM_API_KEY) return new Response("Not configured", { status: 500 });

  const expected = await deriveSecret(TELEGRAM_API_KEY);
  if (!safeEqual(req.headers.get("X-Telegram-Bot-Api-Secret-Token"), expected)) {
    return new Response("Unauthorized", { status: 401 });
  }

  let update: any;
  try { update = await req.json(); } catch { return new Response(JSON.stringify({ ok: true }), { status: 200 }); }

  const ok = () => new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });

  // inline keyboard buttons
  const cq = update.callback_query;
  if (cq?.data) {
    const cid = cq.message?.chat?.id;
    await answerCallback(cq.id);
    if (!cid) return ok();

    if (cq.data.startsWith("lang:")) {
      const lang = (cq.data.split(":")[1] === "en" ? "en" : "ru") as Lang;
      await saveSettings(cid, { lang });
      const s = await getSettings(cid);
      await sendMessage(cid, T[lang].saved);
      if (!s?.goal) {
        await sendMessage(cid, T[lang].chooseGoal, goalKeyboard(lang));
      } else {
        await sendMessage(cid, T[lang].help);
      }
      return ok();
    }

    if (cq.data.startsWith("goal:")) {
      const id = cq.data.split(":")[1] as NutritionGoal;
      const goal = GOALS.some((g) => g.id === id) ? id : "balanced";
      const s = await getSettings(cid);
      const lang = s?.lang ?? "ru";
      await saveSettings(cid, { goal });
      await sendMessage(cid, T[lang].goalSaved(goalLabel(goal, lang)));
      await sendMessage(cid, T[lang].help);
      return ok();
    }
    return ok();
  }

  const msg = update.message ?? update.edited_message;
  const chatId = msg?.chat?.id;
  if (!chatId) return ok();

  const settings = await getSettings(chatId);
  let lang: Lang | null = settings?.lang ?? null;

  try {
    const photos = msg.photo as Array<{ file_id: string }> | undefined;
    const text: string | undefined = msg.text ?? msg.caption;

    // explicit commands
    if (text && (text.startsWith("/language") || text.startsWith("/lang"))) {
      await sendMessage(chatId, T[lang ?? "ru"].choose, LANG_KEYBOARD);
      return ok();
    }
    if (text && text.startsWith("/goal")) {
      await sendMessage(chatId, T[lang ?? "ru"].chooseGoal, goalKeyboard(lang ?? "ru"));
      return ok();
    }
    if (text && text.startsWith("/criteria")) {
      await sendMessage(chatId, T[lang ?? "ru"].criteria);
      return ok();
    }

    // onboarding — step 1: language
    if (!lang) {
      await sendMessage(chatId, T.ru.choose, LANG_KEYBOARD);
      return ok();
    }
    // onboarding — step 2: goal
    if (!settings?.goal) {
      await sendMessage(chatId, T[lang].chooseGoal, goalKeyboard(lang));
      return ok();
    }

    const t = T[lang];


    if (!photos?.length) {
      if (!text || text.startsWith("/start") || text.startsWith("/help")) {
        await sendMessage(chatId, t.help);
        return ok();
      }
    }

    await sendMessage(chatId, t.analyzing);

    let parsed: any;
    if (photos?.length) {
      const best = photos[photos.length - 1];
      const { base64, mimeType } = await downloadPhoto(best.file_id);
      parsed = await visionAnalyze(base64, mimeType, lang);
    } else {
      const r = await fetch(AI, {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You estimate nutrition of meals from text descriptions. Output JSON only." },
            { role: "user", content: `${t.textPrompt(text!)} Return JSON (dish_name and portion_estimate in ${lang === "ru" ? "Russian" : "English"}):
{"dish_name":"","portion_estimate":"","ingredients":["..."],
"nutrition":{"calories":0,"protein_g":0,"carbs_g":0,"sugar_g":0,"fiber_g":0,"fat_g":0,"saturated_fat_g":0,"salt_g":0},
"nova_group":1,"additives":[]}` },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (!r.ok) throw new Error(`Text analysis failed [${r.status}]: ${await r.text()}`);
      const v = await r.json();
      parsed = JSON.parse(v.choices?.[0]?.message?.content || "{}");
    }

    const product: NormalizedProduct = {
      source: "ai_vision",
      product_name: parsed.dish_name || t.dish,
      brand: null, image_url: null, barcode: null,
      nutrition: parsed.nutrition || {},
      ingredients: parsed.ingredients || [],
      nova_group: parsed.nova_group ?? null,
      additives: parsed.additives || [],
    };

    const goal: NutritionGoal = settings.goal;
    const { universal, goalFit, insights } = await analyzeProduct(product, goal, lang);
    const n = product.nutrition;

    const lines: string[] = [
      `${scoreEmoji(universal.score)} <b>${esc(product.product_name)}</b>`,
      parsed.portion_estimate ? `${t.portion}: ${esc(parsed.portion_estimate)}` : "",
      "",
      `<b>Health Score:</b> ${universal.score}/100 (${esc(universal.category_label)})`,
      `<b>Goal Fit:</b> ${goalFit}/100 — ${esc(goalLabel(goal, lang))}`,
      "",
      `🔥 ${Math.round(n.calories ?? 0)} ${t.kcal}  •  ${t.p} ${Math.round(n.protein_g ?? 0)}g  •  ${t.c} ${Math.round(n.carbs_g ?? 0)}g  •  ${t.f} ${Math.round(n.fat_g ?? 0)}g`,
    ];

    if (insights.whats_good?.length) {
      lines.push("", t.good, ...insights.whats_good.slice(0, 4).map((s) => `• ${esc(s)}`));
    }
    if (insights.things_to_know?.length) {
      lines.push("", t.know, ...insights.things_to_know.slice(0, 3).map((s) => `• ${esc(s)}`));
    }
    if (insights.personalized_recommendation) {
      lines.push("", `💡 ${esc(insights.personalized_recommendation)}`);
    }
    lines.push("", t.disclaimer);

    await sendMessage(chatId, lines.filter((l) => l !== undefined).join("\n"));
  } catch (e) {
    console.error("telegram-webhook error", e);
    await sendMessage(chatId, T[lang ?? "ru"].error);
  }

  return ok();
});
