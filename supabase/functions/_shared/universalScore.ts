// Universal Health Score (0..100) — category-aware.
// 40% ingredient quality + 25% NOVA + 25% nutrition + 10% category fit
import type { FoodCategory } from "./categories.ts";
import { analyzeIngredients, type IngredientAnalysis } from "./ingredientQuality.ts";

export type Nutrition = {
  calories?: number; protein_g?: number; carbs_g?: number;
  sugar_g?: number; added_sugar_g?: number; fiber_g?: number;
  fat_g?: number; saturated_fat_g?: number; trans_fat_g?: number;
  salt_g?: number; sodium_mg?: number;
};

export type UniversalScore = {
  score: number;
  category_label: string;
  ingredient: IngredientAnalysis;
  breakdown: { ingredient: number; nova: number; nutrition: number; categoryFit: number };
};

function nutritionScore(cat: FoodCategory, n: Nutrition): number {
  let s = 60;
  const sugar = n.added_sugar_g ?? n.sugar_g ?? 0;
  const sat = n.saturated_fat_g ?? 0;
  const sodium = n.sodium_mg ?? (n.salt_g ? n.salt_g * 400 : 0);
  const fiber = n.fiber_g ?? 0;
  const protein = n.protein_g ?? 0;

  // Universal positives
  s += Math.min(fiber * 2, 15);
  s += Math.min(protein * 0.6, 10);

  // Category-aware penalties
  switch (cat) {
    case "bread":
      // never penalize carbs; care about added sugar + salt
      s -= sugar * 1.5;
      s -= Math.max(0, sodium - 500) / 100;
      break;
    case "oats":
    case "rice":
    case "pasta":
      // never penalize carbs
      s -= sugar * 1.2;
      break;
    case "nuts":
    case "seeds":
      // never penalize fat
      s -= sugar * 1.5;
      break;
    case "cheese":
    case "butter":
    case "milk":
      // do not heavily penalize sat fat; sugar matters (flavored milks)
      s -= sugar * 1.2;
      s -= sat * 0.4;
      break;
    case "fruit":
    case "vegetable":
      // never penalize natural sugars
      s -= (n.added_sugar_g ?? 0) * 2;
      break;
    case "yogurt":
      s -= sugar * 2.2;
      break;
    case "ketchup":
    case "sauce":
    case "mayonnaise":
      s -= sugar * 2;
      s -= Math.max(0, sodium - 400) / 80;
      break;
    case "ready_meal":
    case "frozen_meal":
    case "pizza":
      s -= sat * 1.5;
      s -= Math.max(0, sodium - 500) / 80;
      break;
    case "chocolate":
    case "candy":
    case "snack":
    case "breakfast_cereal":
      s -= sugar * 2;
      s -= sat * 1.2;
      break;
    case "soft_drink":
    case "energy_drink":
    case "juice":
      s -= sugar * 3;
      break;
    default:
      s -= sugar * 1.8;
      s -= sat * 1.5;
      s -= Math.max(0, sodium - 400) / 100;
  }

  if (n.trans_fat_g) s -= n.trans_fat_g * 10;
  return Math.max(0, Math.min(100, Math.round(s)));
}

function categoryFitScore(cat: FoodCategory, ing: IngredientAnalysis, n: Nutrition): number {
  // Reward foods that meet category expectations
  let s = 70;
  switch (cat) {
    case "bread":
      if (ing.rewards.some((r) => r.includes("whole") || r.includes("rye") || r.includes("sourdough"))) s += 25;
      if ((n.fiber_g ?? 0) >= 5) s += 10;
      break;
    case "yogurt":
      if ((n.sugar_g ?? 0) < 6 && (n.protein_g ?? 0) >= 4) s += 25;
      break;
    case "oats":
      if (ing.novaGroup === 1) s += 25;
      break;
    case "fruit":
    case "vegetable":
      if (ing.novaGroup <= 2) s += 25;
      break;
    case "soft_drink":
    case "energy_drink":
      s -= 30;
      break;
  }
  if (ing.novaGroup === 4) s -= 15;
  return Math.max(0, Math.min(100, s));
}

export const SCORE_LABEL = (s: number) =>
  s >= 95 ? "Exceptional" : s >= 90 ? "Excellent" : s >= 80 ? "Very Good"
  : s >= 70 ? "Good" : s >= 60 ? "Acceptable" : s >= 40 ? "Occasional" : "Poor";

export function computeUniversal(cat: FoodCategory, n: Nutrition, ingredients: string[], fallbackNova?: number | null): UniversalScore {
  const ing = analyzeIngredients(ingredients, fallbackNova);
  const ingPart = ing.qualityScore;            // 0..100
  const novaPart = (ing.novaScore / 25) * 100; // 0..100
  const nutriPart = nutritionScore(cat, n);
  const catPart = categoryFitScore(cat, ing, n);

  const score = Math.round(ingPart * 0.4 + novaPart * 0.25 + nutriPart * 0.25 + catPart * 0.10);
  return {
    score: Math.max(0, Math.min(100, score)),
    category_label: SCORE_LABEL(score),
    ingredient: ing,
    breakdown: { ingredient: ingPart, nova: novaPart, nutrition: nutriPart, categoryFit: catPart },
  };
}
