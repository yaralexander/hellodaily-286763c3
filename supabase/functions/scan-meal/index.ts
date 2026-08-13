import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { analyzeProduct, buildScanRow, pointsForScore } from "../_shared/analyzePipeline.ts";

import type { NormalizedProduct } from "../_shared/foodAdapters.ts";
import type { NutritionGoal } from "../_shared/goalFit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const GW = "https://api.openai.com/v1/chat/completions";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return j({ error: "Unauthorized" }, 401);

    const { imageBase64, mimeType, lang } = await req.json();
    if (!imageBase64) return j({ error: "imageBase64 required" }, 400);

    const key = Deno.env.get("OPENAI_API_KEY")!;
    const r = await fetch(GW, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [
          { role: "system", content: "You estimate nutrition of meals from photos. Output JSON only." },
          { role: "user", content: [
            { type: "text", text: `Identify and estimate. Return JSON:
{"dish_name":"","portion_estimate":"","ingredients":["..."],
"nutrition":{"calories":0,"protein_g":0,"carbs_g":0,"sugar_g":0,"fiber_g":0,"fat_g":0,"saturated_fat_g":0,"salt_g":0},
"nova_group":1,"additives":[]}` },
            { type: "image_url", image_url: { url: `data:${mimeType || "image/jpeg"};base64,${imageBase64}` } },
          ]},
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!r.ok) return j({ error: "Vision failed", detail: await r.text() }, 502);
    const v = await r.json();
    const parsed = JSON.parse(v.choices?.[0]?.message?.content || "{}");

    const product: NormalizedProduct = {
      source: "ai_vision",
      product_name: parsed.dish_name || "Meal",
      brand: null, image_url: null, barcode: null,
      nutrition: parsed.nutrition || {},
      ingredients: parsed.ingredients || [],
      nova_group: parsed.nova_group ?? null,
      additives: parsed.additives || [],
    };

    const { data: profile } = await supabase.from("profiles").select("nutrition_goal").eq("user_id", user.id).maybeSingle();
    const goal = (profile?.nutrition_goal as NutritionGoal) || "balanced";
    const { cat, universal, goalFit, insights } = await analyzeProduct(product, goal, lang);

    const { data: row, error } = await supabase.from("food_scans").insert(buildScanRow({
      user_id: user.id, scan_type: "meal", product, cat, universal, goalFit, goal, insights,
    })).select().single();
    if (error) throw error;

    const pts = pointsForScore(universal.score);
    await supabase.from("wellness_points").insert({
      user_id: user.id, points: pts, reason: `Scanned meal: ${product.product_name}`, scan_id: row.id,
    });
    return j({ scan: row, points_awarded: pts, portion_estimate: parsed.portion_estimate });
  } catch (e) {
    console.error("scan-meal error", e);
    return j({ error: String((e as Error).message || e) }, 500);
  }
});

function j(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
