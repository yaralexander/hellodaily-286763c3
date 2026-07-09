// Goal Fit Score — independent of Universal Health Score.
import type { FoodCategory } from "./categories.ts";
import type { Nutrition } from "./universalScore.ts";
import type { IngredientAnalysis } from "./ingredientQuality.ts";

export type NutritionGoal =
  | "balanced" | "weight_loss" | "muscle_gain" | "high_protein" | "keto" | "low_carb"
  | "heart_health" | "diabetes_friendly" | "mediterranean" | "high_fiber"
  | "whole_food" | "low_sodium" | "plant_based";

export const GOAL_LABELS: Record<NutritionGoal, string> = {
  balanced: "Balanced Nutrition",
  weight_loss: "Weight Loss",
  muscle_gain: "Muscle Gain",
  high_protein: "High Protein",
  keto: "Keto Diet",
  low_carb: "Low Carb",
  heart_health: "Heart Health",
  diabetes_friendly: "Diabetes Friendly",
  mediterranean: "Mediterranean Diet",
  high_fiber: "High Fiber",
  whole_food: "Whole Food Diet",
  low_sodium: "Low Sodium",
  plant_based: "Plant Based",
};

export function computeGoalFit(
  goal: NutritionGoal,
  cat: FoodCategory,
  n: Nutrition,
  ing: IngredientAnalysis,
  universal: number,
): number {
  let s = 70;
  const carbs = n.carbs_g ?? 0;
  const netCarbs = Math.max(0, carbs - (n.fiber_g ?? 0));
  const sugar = n.added_sugar_g ?? n.sugar_g ?? 0;
  const protein = n.protein_g ?? 0;
  const fiber = n.fiber_g ?? 0;
  const sodium = n.sodium_mg ?? (n.salt_g ? n.salt_g * 400 : 0);
  const fat = n.fat_g ?? 0;
  const sat = n.saturated_fat_g ?? 0;
  const kcal = n.calories ?? 0;
  const ANIMAL = ["milk","cream","butter","cheese","whey","egg","beef","pork","chicken","fish","gelatin","gelatine","lard"];
  const isPlant = !ing.allergens.includes("Milk") && !ing.allergens.includes("Eggs") && !ing.rewards.concat(ing.penalties).some(()=>false) && !ANIMAL.some(a => ing.allergens.join(" ").toLowerCase().includes(a));

  switch (goal) {
    case "balanced":
      s = universal; // alignment with universal quality
      break;
    case "weight_loss":
      s += Math.min(fiber * 2.5, 20);
      s += Math.min(protein * 0.8, 15);
      s -= sugar * 2;
      s -= Math.max(0, kcal - 250) / 20;
      if (ing.novaGroup === 4) s -= 15;
      break;
    case "muscle_gain":
    case "high_protein":
      s += Math.min(protein * 2, 35);
      if (kcal > 100 && protein / Math.max(kcal, 1) * 100 < 5) s -= 15;
      if (ing.novaGroup === 4) s -= 10;
      break;
    case "keto":
      s = 100;
      s -= netCarbs * 8;            // very strict
      s -= sugar * 12;
      s += Math.min(fat * 0.6, 15);
      break;
    case "low_carb":
      s -= netCarbs * 2;
      s -= sugar * 3;
      break;
    case "heart_health":
      s += Math.min(fiber * 2, 15);
      s -= sat * 3;
      s -= Math.max(0, sodium - 400) / 50;
      if (n.trans_fat_g) s -= n.trans_fat_g * 15;
      if (["bread","oats","legume","fruit","vegetable","nuts","seeds"].includes(cat)) s += 10;
      break;
    case "diabetes_friendly":
      s += Math.min(fiber * 2.5, 20);
      s += Math.min(protein * 0.6, 10);
      s -= sugar * 4;
      s -= Math.max(0, netCarbs - 20) * 1.5;
      break;
    case "mediterranean":
      if (["fruit","vegetable","legume","nuts","seeds","oats"].includes(cat)) s += 20;
      if (ing.rewards.some(r => r.includes("olive"))) s += 15;
      if (ing.novaGroup >= 3) s -= 15;
      break;
    case "high_fiber":
      s = 40 + Math.min(fiber * 6, 60);
      break;
    case "whole_food":
      s = ing.novaGroup === 1 ? 95 : ing.novaGroup === 2 ? 80 : ing.novaGroup === 3 ? 45 : 15;
      break;
    case "low_sodium":
      s = 100 - Math.min(sodium / 10, 90);
      break;
    case "plant_based":
      s = isPlant ? Math.min(95, universal + 5) : 25;
      break;
  }
  return Math.max(0, Math.min(100, Math.round(s)));
}
