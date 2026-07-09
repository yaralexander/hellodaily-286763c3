import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { fetchOpenFoodFactsByBarcode, searchFineli, mergeProducts } from "../_shared/foodAdapters.ts";
import { analyzeProduct, buildScanRow, pointsForScore } from "../_shared/analyzePipeline.ts";

import type { NutritionGoal } from "../_shared/goalFit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const { barcode, lang } = await req.json();
    if (!barcode) return j({ error: "barcode required" }, 400);

    const off = await fetchOpenFoodFactsByBarcode(barcode);
    let merged = off;
    if (off?.product_name) merged = mergeProducts(off, await searchFineli(off.product_name));
    if (!merged) return j({ error: "Product not found", barcode }, 404);

    const { data: profile } = await supabase.from("profiles").select("nutrition_goal").eq("user_id", user.id).maybeSingle();
    const goal = (profile?.nutrition_goal as NutritionGoal) || "balanced";

    const { cat, universal, goalFit, insights } = await analyzeProduct(merged, goal, lang);

    const { data: row, error } = await supabase.from("food_scans").insert(buildScanRow({
      user_id: user.id, scan_type: "barcode", product: merged, cat, universal, goalFit, goal, insights,
    })).select().single();
    if (error) throw error;

    const pts = pointsForScore(universal.score);
    await supabase.from("wellness_points").insert({
      user_id: user.id, points: pts, reason: `Scanned ${merged.product_name}`, scan_id: row.id,
    });
    return j({ scan: row, points_awarded: pts });
  } catch (e) {
    console.error("scan-barcode error", e);
    return j({ error: String((e as Error).message || e) }, 500);
  }
});

function j(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
