// Lovable AI Gateway insights — evidence-based, no fear language.
import type { NormalizedProduct } from "./foodAdapters.ts";
import type { FoodCategory } from "./categories.ts";
import type { UniversalScore } from "./universalScore.ts";
import type { NutritionGoal } from "./goalFit.ts";
import { GOAL_LABELS } from "./goalFit.ts";

const GW = "https://api.openai.com/v1/chat/completions";

export type AIInsights = {
  whats_good: string[];
  things_to_know: string[];
  ingredient_intelligence: { name: string; rating: "good" | "neutral" | "bad"; note: string }[];
  alternatives: { name: string; reason: string }[];
  ai_summary: string;
  personalized_recommendation: string;
};

export async function generateInsights(
  product: NormalizedProduct,
  cat: FoodCategory,
  universal: UniversalScore,
  goalFit: number,
  goal: NutritionGoal,
  lang = "en",
): Promise<AIInsights> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY missing");

  const sys = `You are an evidence-based AI nutrition coach for Hello Daily.
Core rules (Goal Fit Score™ philosophy):
- Never label food as "good", "bad", "healthy", or "unhealthy". Foods are evaluated as FIT for a specific goal, not as moral categories.
- Use these fit tiers when describing compatibility with the user's goal: Excellent Fit, Good Fit, Moderate Fit, Weak Fit, Poor Fit.
- Never use fear-based or shaming language ("too much", "dangerous", "warning", "avoid at all costs"). Be non-judgmental.
- Never penalize a food for being a normal example of its category (carbs in bread, fat in nuts, natural sugar in fruit).
- Distinguish "quality of the food itself" from "how well it fits THIS specific goal". Same food can be an Excellent Fit for one goal and a Weak Fit for another.
- personalized_recommendation must be a single friendly coach-style sentence tied to the user's goal (e.g. "Great daily choice for muscle gain", "Fine occasionally, but a Weak Fit for keto").
- Be concise, practical, motivational. Output JSON only.
- Language: ${lang === "ru" ? "Russian" : "English"}.`;

  const user = `Analyze this product and return strict JSON.

Product: ${product.product_name}${product.brand ? " by " + product.brand : ""}
Category: ${cat}
Universal Health Score: ${universal.score}/100 (${universal.category_label})
NOVA group: ${universal.ingredient.novaGroup}
User's current goal: ${GOAL_LABELS[goal]}
Goal Fit Score: ${goalFit}/100
Nutrition per 100g: ${JSON.stringify(product.nutrition)}
Allergens detected (informational only, no penalty): ${universal.ingredient.allergens.join(", ") || "none"}
Ingredients: ${product.ingredients.slice(0, 30).join(", ") || "unknown"}

Return JSON with exact shape:
{
  "whats_good": ["context-specific bullet", ...3-5],
  "things_to_know": ["neutral context bullet — never fear-based", ...2-4],
  "ingredient_intelligence": [{"name":"...","rating":"good|neutral|bad","note":"why"}, ...4-8],
  "alternatives": [{"name":"...","reason":"..."}, ...3 alternatives that better fit the user's goal],
  "ai_summary": "2 sentences. State quality AND goal fit separately.",
  "personalized_recommendation": "1 sentence: buy / occasional / not for this goal — with reason tied to the user's goal."
}`;

  const r = await fetch(GW, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      messages: [{ role: "system", content: sys }, { role: "user", content: user }],
      response_format: { type: "json_object" },
    }),
  });
  if (!r.ok) throw new Error(`AI insights failed: ${r.status} ${await r.text()}`);
  const data = await r.json();
  const content = data.choices?.[0]?.message?.content || "{}";
  try { return JSON.parse(content); }
  catch {
    const m = content.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : {
      whats_good: [], things_to_know: [], ingredient_intelligence: [],
      alternatives: [], ai_summary: "", personalized_recommendation: "",
    };
  }
}
