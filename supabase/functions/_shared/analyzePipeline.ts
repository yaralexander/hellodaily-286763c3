// Shared pipeline: turn normalized product → full V2 analysis + DB insert.
import type { NormalizedProduct } from "./foodAdapters.ts";
import { classifyCategory } from "./categories.ts";
import { computeUniversal } from "./universalScore.ts";
import { computeGoalFit, type NutritionGoal } from "./goalFit.ts";
import { generateInsights } from "./aiAnalyze.ts";

export function pointsForScore(s: number): number {
  if (s >= 80) return 10;
  if (s >= 60) return 5;
  return 2;
}

export async function analyzeProduct(product: NormalizedProduct, goal: NutritionGoal, lang = "en") {
  const cat = classifyCategory(product.product_name, product.ingredients);
  const universal = computeUniversal(cat, product.nutrition, product.ingredients, product.nova_group);
  const goalFit = computeGoalFit(goal, cat, product.nutrition, universal.ingredient, universal.score);
  const insights = await generateInsights(product, cat, universal, goalFit, goal, lang);
  return { cat, universal, goalFit, insights };
}

export function buildScanRow(opts: {
  user_id: string;
  scan_type: "barcode" | "package" | "meal";
  product: NormalizedProduct;
  cat: string;
  universal: ReturnType<typeof computeUniversal>;
  goalFit: number;
  goal: NutritionGoal;
  insights: Awaited<ReturnType<typeof generateInsights>>;
}) {
  const { user_id, scan_type, product, cat, universal, goalFit, goal, insights } = opts;
  return {
    user_id,
    scan_type,
    source: product.source,
    barcode: product.barcode,
    product_name: product.product_name,
    brand: product.brand,
    image_url: product.image_url,
    nutrition: product.nutrition,
    ingredients: product.ingredients,
    nova_group: universal.ingredient.novaGroup,
    additives: universal.ingredient.additives,
    allergens: universal.ingredient.allergens,
    category: cat,
    health_score: universal.score,
    score_category: universal.category_label.toLowerCase(),
    goal_fit_score: goalFit,
    goal_at_scan: goal,
    positives: insights.whats_good,
    concerns: insights.things_to_know,    // legacy column reused
    things_to_know: insights.things_to_know,
    alternatives: insights.alternatives,
    ingredient_intelligence: insights.ingredient_intelligence,
    ai_summary: insights.ai_summary,
    coach_tip: insights.personalized_recommendation,
    personalized_recommendation: insights.personalized_recommendation,
  };
}
