import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { searchOpenFoodFacts, searchFineli, mergeProducts } from "../_shared/foodAdapters.ts";
import { analyzeProduct, buildScanRow, pointsForScore } from "../_shared/analyzePipeline.ts";

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
          { role: "system", content: "You identify food packages. Output JSON only." },
          { role: "user", content: [
            { type: "text", text: 'Identify this packaged food. Return JSON: {"brand":"","product_name":"","category":"","search_query":"best terms to find it in Open Food Facts"}' },
            { type: "image_url", image_url: { url: `data:${mimeType || "image/jpeg"};base64,${imageBase64}` } },
          ]},
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!r.ok) return j({ error: "Vision failed", detail: await r.text() }, 502);
    const v = await r.json();
    const id = JSON.parse(v.choices?.[0]?.message?.content || "{}");
    const query = id.search_query || `${id.brand || ""} ${id.product_name || ""}`.trim();
    if (!query) return j({ error: "Could not identify product" }, 404);

    const off = await searchOpenFoodFacts(query);
    let merged = off;
    if (off?.product_name) merged = mergeProducts(off, await searchFineli(off.product_name));
    if (!merged) merged = await searchFineli(query);
    if (!merged) {
      merged = {
        source: "ai_vision", product_name: id.product_name || "Unknown product", brand: id.brand || null,
        image_url: null, barcode: null, nutrition: {}, ingredients: [], nova_group: null, additives: [],
      };
    }

    const { data: profile } = await supabase.from("profiles").select("nutrition_goal").eq("user_id", user.id).maybeSingle();
    const goal = (profile?.nutrition_goal as NutritionGoal) || "balanced";
    const { cat, universal, goalFit, insights } = await analyzeProduct(merged, goal, lang);

    const { data: row, error } = await supabase.from("food_scans").insert(buildScanRow({
      user_id: user.id, scan_type: "package", product: merged, cat, universal, goalFit, goal, insights,
    })).select().single();
    if (error) throw error;

    const pts = pointsForScore(universal.score);
    await supabase.from("wellness_points").insert({
      user_id: user.id, points: pts, reason: `Scanned ${merged.product_name}`, scan_id: row.id,
    });
    return j({ scan: row, points_awarded: pts });
  } catch (e) {
    console.error("scan-package error", e);
    return j({ error: String((e as Error).message || e) }, 500);
  }
});

function j(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
