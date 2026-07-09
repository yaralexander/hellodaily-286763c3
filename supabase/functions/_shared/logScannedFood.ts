// Auto-log a scanned product into the user's daily food_logs.
// Idempotent per scan via the scan row's added_at flag.
export async function logScannedFood(supabase: any, opts: {
  user_id: string;
  scan_id: string;
  product_name: string;
  image_url: string | null;
  nutrition: Record<string, number> | null | undefined;
}) {
  const n = (opts.nutrition || {}) as Record<string, number>;
  const calories = Math.round(Number(n.calories) || 0);
  // Skip if there's nothing meaningful to log
  if (calories <= 0 && !n.protein_g && !n.carbs_g && !n.fat_g) return;

  const { error: logErr } = await supabase.from("food_logs").insert({
    user_id: opts.user_id,
    food_name: opts.product_name,
    meal_type: "snack",
    calories,
    protein_g: Math.round((Number(n.protein_g) || 0) * 10) / 10,
    carbs_g: Math.round((Number(n.carbs_g) || 0) * 10) / 10,
    fat_g: Math.round((Number(n.fat_g) || 0) * 10) / 10,
    portion_size: "100g (scanned)",
    image_url: opts.image_url,
  });
  if (logErr) {
    console.error("logScannedFood insert error", logErr);
    return;
  }
  await supabase.from("food_scans").update({ added_at: new Date().toISOString() }).eq("id", opts.scan_id);
}
