// Food database adapters — scalable for adding more country databases later.
import type { Nutrition } from "./healthScore.ts";

export type NormalizedProduct = {
  source: string;
  product_name: string;
  brand?: string | null;
  image_url?: string | null;
  barcode?: string | null;
  nutrition: Nutrition;
  ingredients: string[];
  nova_group?: number | null;
  additives: string[];
};

export async function fetchOpenFoodFactsByBarcode(barcode: string): Promise<NormalizedProduct | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;
  const r = await fetch(url, { headers: { "User-Agent": "HelloDaily/1.0" } });
  if (!r.ok) return null;
  const data = await r.json();
  if (data.status !== 1 || !data.product) return null;
  return normalizeOFF(data.product, barcode);
}

export async function searchOpenFoodFacts(query: string): Promise<NormalizedProduct | null> {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=1`;
  const r = await fetch(url, { headers: { "User-Agent": "HelloDaily/1.0" } });
  if (!r.ok) return null;
  const data = await r.json();
  const p = data.products?.[0];
  if (!p) return null;
  return normalizeOFF(p, p.code ?? null);
}

function normalizeOFF(p: any, barcode: string | null): NormalizedProduct {
  const nu = p.nutriments || {};
  return {
    source: "openfoodfacts",
    product_name: p.product_name || p.generic_name || "Unknown product",
    brand: p.brands || null,
    image_url: p.image_front_url || p.image_url || null,
    barcode,
    nutrition: {
      calories: num(nu["energy-kcal_100g"] ?? nu["energy-kcal"]),
      protein_g: num(nu.proteins_100g),
      carbs_g: num(nu.carbohydrates_100g),
      sugar_g: num(nu.sugars_100g),
      fiber_g: num(nu.fiber_100g),
      fat_g: num(nu.fat_100g),
      saturated_fat_g: num(nu["saturated-fat_100g"]),
      trans_fat_g: num(nu["trans-fat_100g"]),
      salt_g: num(nu.salt_100g),
      sodium_mg: nu.sodium_100g ? Number(nu.sodium_100g) * 1000 : undefined,
    },
    ingredients: (p.ingredients_text || "").split(/[,;]/).map((x: string) => x.trim()).filter(Boolean),
    nova_group: p.nova_group ? Number(p.nova_group) : null,
    additives: (p.additives_tags || []).map((t: string) => t.replace(/^en:/, "")),
  };
}

export async function searchFineli(query: string): Promise<NormalizedProduct | null> {
  try {
    const url = `https://fineli.fi/fineli/api/v1/foods?q=${encodeURIComponent(query)}&lang=en`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const arr = await r.json();
    const f = Array.isArray(arr) ? arr[0] : null;
    if (!f) return null;
    return {
      source: "fineli",
      product_name: f.name?.en || f.name?.fi || query,
      brand: null,
      image_url: null,
      barcode: null,
      nutrition: {
        calories: num(f.energyKcal),
        protein_g: num(f.protein),
        carbs_g: num(f.carbohydrate),
        sugar_g: num(f.sugar),
        fiber_g: num(f.fiber),
        fat_g: num(f.fat),
        saturated_fat_g: num(f.fattyAcidsSaturated),
        salt_g: num(f.salt) ? Number(f.salt) / 1000 : undefined,
      },
      ingredients: [],
      nova_group: null,
      additives: [],
    };
  } catch {
    return null;
  }
}

export function mergeProducts(primary: NormalizedProduct | null, secondary: NormalizedProduct | null): NormalizedProduct | null {
  if (!primary && !secondary) return null;
  if (!primary) return secondary;
  if (!secondary) return primary;
  // Prefer primary, fill blanks from secondary
  const nutrition = { ...secondary.nutrition };
  for (const [k, v] of Object.entries(primary.nutrition)) {
    if (v !== undefined && v !== null && !isNaN(Number(v))) (nutrition as any)[k] = v;
  }
  return {
    ...primary,
    source: `${primary.source}+${secondary.source}`,
    image_url: primary.image_url || secondary.image_url,
    brand: primary.brand || secondary.brand,
    ingredients: primary.ingredients.length ? primary.ingredients : secondary.ingredients,
    nova_group: primary.nova_group ?? secondary.nova_group,
    additives: primary.additives.length ? primary.additives : secondary.additives,
    nutrition,
  };
}

function num(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return isNaN(n) ? undefined : n;
}
