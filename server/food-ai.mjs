import { db, id } from "./database.mjs";

const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

async function openAI(messages) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, response_format: { type: "json_object" } }),
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error("OpenAI request failed", response.status, detail.slice(0, 500));
    throw new Error(response.status === 429 ? "AI rate limit reached" : "AI analysis failed");
  }
  const payload = await response.json();
  return JSON.parse(payload.choices?.[0]?.message?.content || "{}");
}

const scanShape = `Return JSON only in this exact shape:
{"product_name":"","brand":null,"portion_estimate":"","category":"","nutrition":{"calories":0,"protein_g":0,"carbs_g":0,"sugar_g":0,"fiber_g":0,"fat_g":0,"saturated_fat_g":0,"salt_g":0},"ingredients":[],"nova_group":1,"additives":[],"health_score":0,"positives":[],"concerns":[],"alternatives":[],"ingredient_intelligence":[],"ai_summary":"","coach_tip":"","allergens":[],"personalized_recommendation":"","things_to_know":[]}.
health_score must be an integer from 0 to 100. Nutrition is for the described portion for a meal, or per 100 g for a packaged product.`;

function normalizeScan(value, fallbackName) {
  const score = Math.max(0, Math.min(100, Math.round(Number(value.health_score) || 50)));
  return {
    product_name: value.product_name || fallbackName,
    brand: value.brand || null,
    portion_estimate: value.portion_estimate || null,
    category: value.category || null,
    nutrition: value.nutrition || {}, ingredients: value.ingredients || [], nova_group: value.nova_group ?? null,
    additives: value.additives || [], health_score: score,
    score_category: score >= 75 ? "excellent" : score >= 55 ? "good" : score >= 35 ? "moderate" : "poor",
    positives: value.positives || [], concerns: value.concerns || [], alternatives: value.alternatives || [],
    ingredient_intelligence: value.ingredient_intelligence || [], ai_summary: value.ai_summary || "",
    coach_tip: value.coach_tip || "", allergens: value.allergens || [],
    personalized_recommendation: value.personalized_recommendation || "", things_to_know: value.things_to_know || [],
  };
}

function storeScan(userId, scanType, source, product, barcode = null) {
  const profile = db.prepare("SELECT nutrition_goal FROM profiles WHERE user_id=?").get(userId);
  const scanId = id();
  const goal = profile?.nutrition_goal || "balanced";
  const now = new Date().toISOString();
  const columns = ["id","user_id","scan_type","source","barcode","product_name","brand","nutrition","ingredients","nova_group","additives","health_score","score_category","positives","concerns","alternatives","ingredient_intelligence","ai_summary","coach_tip","goal_fit_score","goal_at_scan","category","allergens","personalized_recommendation","things_to_know","created_at","scanned_at"];
  const values = [scanId,userId,scanType,source,barcode,product.product_name,product.brand,JSON.stringify(product.nutrition),JSON.stringify(product.ingredients),product.nova_group,JSON.stringify(product.additives),product.health_score,product.score_category,JSON.stringify(product.positives),JSON.stringify(product.concerns),JSON.stringify(product.alternatives),JSON.stringify(product.ingredient_intelligence),product.ai_summary,product.coach_tip,product.health_score,goal,product.category,JSON.stringify(product.allergens),product.personalized_recommendation,JSON.stringify(product.things_to_know),now,now];
  db.prepare(`INSERT INTO food_scans (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`).run(...values);
  const points = product.health_score >= 75 ? 10 : product.health_score >= 50 ? 7 : 5;
  db.prepare("INSERT INTO wellness_points (id,user_id,points,reason,scan_id,created_at) VALUES (?,?,?,?,?,?)").run(id(), userId, points, `Scanned ${product.product_name}`, scanId, now);
  const row = db.prepare("SELECT * FROM food_scans WHERE id=?").get(scanId);
  for (const key of ["nutrition","ingredients","additives","positives","concerns","alternatives","ingredient_intelligence","allergens","things_to_know"]) row[key] = JSON.parse(row[key] || "null");
  return { scan: row, points_awarded: points, portion_estimate: product.portion_estimate };
}

export async function scanText(userId, body) {
  if (!body.description) throw new Error("Description is required");
  const language = body.lang === "ru" ? "Russian" : "English";
  const value = await openAI([{ role: "system", content: `You are a nutrition specialist. Write all human-readable fields in ${language}. ${scanShape}` }, { role: "user", content: `Analyze this meal description: ${body.description}` }]);
  return storeScan(userId, "meal", "ai_text", normalizeScan(value, String(body.description).slice(0, 80)));
}

export async function scanImage(userId, body, scanType) {
  if (!body.imageBase64) throw new Error("Image is required");
  const language = body.lang === "ru" ? "Russian" : "English";
  const instruction = scanType === "meal" ? "Analyze the complete meal and its estimated serving." : "Identify the packaged product and analyze nutrition per 100 g from visible package information.";
  const value = await openAI([{ role: "system", content: `You are a nutrition specialist. Write all human-readable fields in ${language}. ${scanShape}` }, { role: "user", content: [{ type: "text", text: instruction }, { type: "image_url", image_url: { url: `data:${body.mimeType || "image/jpeg"};base64,${body.imageBase64}` } }] }]);
  return storeScan(userId, scanType, "ai_vision", normalizeScan(value, scanType === "meal" ? "Meal" : "Packaged product"));
}

export async function scanBarcode(userId, body) {
  if (!body.barcode) throw new Error("Barcode is required");
  const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(body.barcode)}.json`);
  if (!response.ok) throw new Error("Product lookup failed");
  const value = await response.json();
  if (!value.product) throw new Error("Product not found");
  const p = value.product;
  const n = p.nutriments || {};
  const base = { product_name: p.product_name || "Unknown product", brand: p.brands || null, category: p.categories?.split(",")[0] || null, nutrition: { calories: n["energy-kcal_100g"] || 0, protein_g: n.proteins_100g || 0, carbs_g: n.carbohydrates_100g || 0, sugar_g: n.sugars_100g || 0, fiber_g: n.fiber_100g || 0, fat_g: n.fat_100g || 0, saturated_fat_g: n["saturated-fat_100g"] || 0, salt_g: n.salt_100g || 0 }, ingredients: p.ingredients_text ? [p.ingredients_text] : [], nova_group: p.nova_group || null, additives: p.additives_tags || [], health_score: p.nutriscore_score == null ? 50 : Math.max(10, Math.min(90, 70 - Number(p.nutriscore_score) * 2)), positives: [], concerns: [], alternatives: [], ingredient_intelligence: [], ai_summary: "", coach_tip: "", allergens: p.allergens_tags || [], personalized_recommendation: "", things_to_know: [] };
  return storeScan(userId, "barcode", "open_food_facts", normalizeScan(base, base.product_name), String(body.barcode));
}

export async function analyzeFood(body) {
  if (!body.imageBase64) throw new Error("Image is required");
  return openAI([{ role: "system", content: "Analyze food photos. Return JSON with foods array (name, portion_size, calories, protein_g, carbs_g, fat_g), meal_type (breakfast/lunch/dinner/snack), and summary." }, { role: "user", content: [{ type: "text", text: "Identify every food and estimate portions and nutrition." }, { type: "image_url", image_url: { url: `data:${body.mimeType || "image/jpeg"};base64,${body.imageBase64}` } }] }]);
}

export async function analyzeFoodText(body) {
  if (!body.foodName) throw new Error("Food name is required");
  return openAI([{ role: "system", content: "Return JSON only with numeric calories, protein_g, carbs_g, and fat_g." }, { role: "user", content: `Estimate nutrition for ${body.foodName}, portion ${body.portionSize || "one serving"}.` }]);
}

export function recalculateGoal(userId, goal) {
  db.prepare("UPDATE profiles SET nutrition_goal=?,updated_at=datetime('now') WHERE user_id=?").run(goal || "balanced", userId);
  db.prepare("UPDATE food_scans SET goal_at_scan=?,goal_fit_score=health_score WHERE user_id=?").run(goal || "balanced", userId);
  return { updated: true };
}
