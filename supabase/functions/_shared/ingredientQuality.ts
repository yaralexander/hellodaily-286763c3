// Ingredient quality + NOVA estimation from raw ingredient list.

const REWARD = [
  "whole grain", "whole wheat", "whole rye", "rye flour", "oat", "oats", "vegetable",
  "fruit", "berry", "legume", "lentil", "chickpea", "bean", "nut", "seed",
  "ferment", "sourdough", "olive oil", "extra virgin", "natural",
];

const PENALIZE = [
  "sucralose", "aspartame", "acesulfame", "saccharin", "neotame",
  "artificial flavor", "artificial flavour", "artificial color", "artificial colour",
  "flavor enhancer", "flavour enhancer", "monosodium glutamate", "msg",
  "maltodextrin", "modified starch", "modified corn starch",
  "hydrogenated", "partially hydrogenated", "interesterified",
  "high fructose corn syrup", "hfcs", "glucose-fructose syrup",
  "carrageenan", "polysorbate", "sodium benzoate", "potassium sorbate",
  "bha", "bht", "tbhq", "nitrite", "nitrate",
];

const ARTIFICIAL_SWEETENERS_LIST = ["sucralose","aspartame","acesulfame","saccharin","neotame","e950","e951","e952","e954","e955"];

const ALLERGEN_KEYWORDS: Record<string, string> = {
  gluten: "Gluten", wheat: "Wheat", rye: "Rye", barley: "Barley", oat: "Oats",
  milk: "Milk", lactose: "Lactose", cream: "Milk", butter: "Milk", whey: "Milk", cheese: "Milk",
  egg: "Eggs", soy: "Soy", soya: "Soy", peanut: "Peanuts", almond: "Nuts", hazelnut: "Nuts",
  walnut: "Nuts", cashew: "Nuts", pistachio: "Nuts", sesame: "Sesame", fish: "Fish",
  shellfish: "Shellfish", shrimp: "Shellfish", mustard: "Mustard", celery: "Celery", sulphite: "Sulphites",
};

export type IngredientAnalysis = {
  qualityScore: number;       // 0..100 (40% weight)
  novaGroup: 1 | 2 | 3 | 4;
  novaScore: number;          // 0..25
  additives: string[];
  hasArtificialSweeteners: boolean;
  allergens: string[];
  rewards: string[];
  penalties: string[];
};

export function analyzeIngredients(ingredients: string[], fallbackNova?: number | null): IngredientAnalysis {
  const text = ingredients.join(" , ").toLowerCase();
  const rewards: string[] = [];
  const penalties: string[] = [];

  let q = 60;
  for (const k of REWARD) if (text.includes(k)) { q += 4; rewards.push(k); }
  for (const k of PENALIZE) if (text.includes(k)) { q -= 8; penalties.push(k); }

  // Detect E-numbers as additives proxy
  const eNums = Array.from(text.matchAll(/\be\d{3,4}[a-z]?\b/g)).map((m) => m[0].toUpperCase());
  const additives = Array.from(new Set([...penalties.filter((p) => p.startsWith("e")), ...eNums]));
  q -= Math.min(additives.length, 8) * 2;

  // Very long ingredient list with industrial markers => heavier penalty
  if (ingredients.length > 15) q -= 5;
  if (ingredients.length > 25) q -= 5;

  const hasArtificialSweeteners = ARTIFICIAL_SWEETENERS_LIST.some((s) => text.includes(s));

  // NOVA estimation
  let nova: 1 | 2 | 3 | 4 = 1;
  if (fallbackNova && [1,2,3,4].includes(fallbackNova)) nova = fallbackNova as 1|2|3|4;
  else {
    if (penalties.length >= 2 || additives.length >= 2 || hasArtificialSweeteners) nova = 4;
    else if (penalties.length === 1 || additives.length === 1) nova = 3;
    else if (ingredients.length <= 3) nova = 1;
    else nova = 2;
  }
  const novaScore = nova === 1 ? 25 : nova === 2 ? 22 : nova === 3 ? 18 : 5;

  // Allergens
  const allergens = new Set<string>();
  for (const [kw, label] of Object.entries(ALLERGEN_KEYWORDS)) {
    if (text.includes(kw)) allergens.add(label);
  }

  return {
    qualityScore: Math.max(0, Math.min(100, Math.round(q))),
    novaGroup: nova,
    novaScore,
    additives,
    hasArtificialSweeteners,
    allergens: Array.from(allergens),
    rewards: Array.from(new Set(rewards)),
    penalties: Array.from(new Set(penalties)),
  };
}
