// Recompute Goal Fit Score for all of a user's scans against a (possibly new) goal.
// Pure deterministic recalc — no AI calls.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { computeGoalFit, type NutritionGoal } from "../_shared/goalFit.ts";
import { analyzeIngredients } from "../_shared/ingredientQuality.ts";

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

    const { goal } = await req.json() as { goal: NutritionGoal };
    if (!goal) return j({ error: "goal required" }, 400);

    const { data: scans, error } = await supabase
      .from("food_scans").select("id,nutrition,ingredients,nova_group,category,health_score")
      .eq("user_id", user.id);
    if (error) throw error;

    let updated = 0;
    for (const s of scans || []) {
      const ing = analyzeIngredients((s.ingredients as string[]) || [], s.nova_group);
      const fit = computeGoalFit(goal, (s.category as any) || "other", s.nutrition as any, ing, s.health_score);
      await supabase.from("food_scans").update({ goal_fit_score: fit }).eq("id", s.id);
      updated++;
    }
    return j({ updated });
  } catch (e) {
    console.error("recalc-goal-fit error", e);
    return j({ error: String((e as Error).message || e) }, 500);
  }
});

function j(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
