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

async function getLang(chatId: number): Promise<Lang | null> {
  const { data } = await supabase
    .from("telegram_bot_settings").select("lang").eq("chat_id", chatId).maybeSingle();
  return (data?.lang as Lang) ?? null;
}

async function setLang(chatId: number, lang: Lang) {
  await supabase.from("telegram_bot_settings")
    .upsert({ chat_id: chatId, lang, updated_at: new Date().toISOString() }, { onConflict: "chat_id" });
}

const LANG_KEYBOARD = {
  inline_keyboard: [[
    { text: "🇷🇺 Русский", callback_data: "lang:ru" },
    { text: "🇬🇧 English", callback_data: "lang:en" },
  ]],
};

const T = {
  ru: {
    choose: "🌍 Выбери язык бота:\n\nChoose your language:",
    saved: "✅ Язык переключён на русский.",
    help: `👋 Привет! Я бот <b>Hello Daily</b>.

📸 Отправь мне <b>фото еды</b> — я оценю блюдо так же, как на сайте: Health Score, калории, БЖУ и советы.
✍️ Можно и просто описать блюдо текстом.
🌍 /language — сменить язык.

⚠️ Оценки приблизительные и не являются медицинской рекомендацией.`,
    analyzing: "🔍 Анализирую…",
    error: "😕 Не удалось проанализировать. Попробуй ещё раз — лучше при хорошем освещении и крупным планом.",
    dish: "Блюдо",
    portion: "Порция",
    good: "<b>✅ Плюсы</b>",
    know: "<b>ℹ️ Стоит знать</b>",
    kcal: "ккал", p: "Б", c: "У", f: "Ж",
    disclaimer: "<i>Оценка приблизительная и не является медицинской рекомендацией.</i>",
    textPrompt: (t: string) => `Блюдо: ${t}.`,
  },
  en: {
    choose: "🌍 Choose your language:\n\nВыбери язык бота:",
    saved: "✅ Language switched to English.",
    help: `👋 Hi! I'm the <b>Hello Daily</b> bot.

📸 Send me a <b>photo of your food</b> — I'll rate it just like on the website: Health Score, calories, macros and tips.
✍️ You can also just describe the dish in text.
🌍 /language — change language.

⚠️ Estimates are approximate and not medical advice.`,
    analyzing: "🔍 Analyzing…",
    error: "😕 Couldn't analyze that. Please try again — good lighting and a close-up help.",
    dish: "Dish",
    portion: "Portion",
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

  // language selection button
  const cq = update.callback_query;
  if (cq?.data?.startsWith("lang:")) {
    const lang = (cq.data.split(":")[1] === "en" ? "en" : "ru") as Lang;
    const cid = cq.message?.chat?.id;
    await answerCallback(cq.id);
    if (cid) {
      await setLang(cid, lang);
      await sendMessage(cid, T[lang].saved);
      await sendMessage(cid, T[lang].help);
    }
    return ok();
  }

  const msg = update.message ?? update.edited_message;
  const chatId = msg?.chat?.id;
  if (!chatId) return ok();

  let lang = await getLang(chatId);

  try {
    const photos = msg.photo as Array<{ file_id: string }> | undefined;
    const text: string | undefined = msg.text ?? msg.caption;

    // explicit language command
    if (text && (text.startsWith("/language") || text.startsWith("/lang"))) {
      await sendMessage(chatId, T[lang ?? "ru"].choose, LANG_KEYBOARD);
      return ok();
    }

    // first contact — ask for language
    if (!lang) {
      await sendMessage(chatId, T.ru.choose, LANG_KEYBOARD);
      if (!photos?.length) return ok();
      lang = "ru";
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

    const goal: NutritionGoal = "balanced";
    const { universal, goalFit, insights } = await analyzeProduct(product, goal, lang);
    const n = product.nutrition;

    const lines: string[] = [
      `${scoreEmoji(universal.score)} <b>${esc(product.product_name)}</b>`,
      parsed.portion_estimate ? `${t.portion}: ${esc(parsed.portion_estimate)}` : "",
      "",
      `<b>Health Score:</b> ${universal.score}/100 (${esc(universal.category_label)})`,
      `<b>Goal Fit:</b> ${goalFit}/100`,
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
