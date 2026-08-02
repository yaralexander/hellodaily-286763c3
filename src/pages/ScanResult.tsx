import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Info, Sparkles, Leaf, Loader2, Tag, Plus, X } from "lucide-react";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";
import HealthScoreRing from "@/components/scan/HealthScoreRing";
import { goalLabel } from "@/hooks/useNutritionGoal";
import { goalFitLabel, goalFitColor } from "@/lib/goalFitTier";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const NUTRIENT_LABELS: Record<string, string> = {
  calories: "Calories", protein_g: "Protein", carbs_g: "Carbs", sugar_g: "Sugar",
  fiber_g: "Fiber", fat_g: "Fat", saturated_fat_g: "Sat. Fat", salt_g: "Salt",
};
const NUTRIENT_UNITS: Record<string, string> = { calories: "kcal", protein_g: "g", carbs_g: "g", sugar_g: "g", fiber_g: "g", fat_g: "g", saturated_fat_g: "g", salt_g: "g" };

const NutrientCard = ({ k, v }: { k: string; v: number }) => (
  <div className="glass-card p-3">
    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{NUTRIENT_LABELS[k] || k}</p>
    <p className="text-lg font-bold text-foreground mt-0.5">
      {v.toFixed(k === "calories" ? 0 : 1)}
      <span className="text-xs font-medium text-muted-foreground ml-1">{NUTRIENT_UNITS[k]}</span>
    </p>
  </div>
);

const NOVA_LABELS: Record<number, string> = {
  1: "NOVA 1 · Unprocessed",
  2: "NOVA 2 · Culinary ingredient",
  3: "NOVA 3 · Processed",
  4: "NOVA 4 · Ultra-processed",
};
const NOVA_COLORS: Record<number, string> = {
  1: "hsl(142 70% 42%)", 2: "hsl(95 60% 48%)", 3: "hsl(35 90% 50%)", 4: "hsl(0 80% 55%)",
};

const ScanResult = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const navTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
    };
  }, []);
  const [portionOpen, setPortionOpen] = useState(false);
  const [grams, setGrams] = useState("100");
  const { data: scan, isLoading } = useQuery({
    queryKey: ["scan", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("food_scans").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: todayTotals } = useQuery({
    queryKey: ["food-logs", "today-totals", session?.user?.id],
    queryFn: async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date(); end.setHours(23, 59, 59, 999);
      const { data, error } = await supabase
        .from("food_logs")
        .select("calories, protein_g, carbs_g, fat_g")
        .eq("user_id", session!.user.id)
        .gte("logged_at", start.toISOString())
        .lte("logged_at", end.toISOString());
      if (error) throw error;
      return (data || []).reduce(
        (acc, r: any) => ({
          calories: acc.calories + (Number(r.calories) || 0),
          protein_g: acc.protein_g + (Number(r.protein_g) || 0),
          carbs_g: acc.carbs_g + (Number(r.carbs_g) || 0),
          fat_g: acc.fat_g + (Number(r.fat_g) || 0),
        }),
        { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
      );
    },
    enabled: !!session?.user?.id && portionOpen,
  });

  const undoMeal = useMutation({
    mutationFn: async (logId: string) => {
      if (!scan) throw new Error("No scan");
      const { error: delErr } = await supabase.from("food_logs").delete().eq("id", logId);
      if (delErr) throw delErr;
      const { error: scanErr } = await supabase
        .from("food_scans")
        .update({ added_at: null } as any)
        .eq("id", scan.id);
      if (scanErr) throw scanErr;
    },
    onSuccess: () => {
      if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
      queryClient.invalidateQueries({ queryKey: ["scan", id] });
      queryClient.invalidateQueries({ queryKey: ["food-logs"] });
      queryClient.invalidateQueries({ queryKey: ["eaten-scan-avg"] });
      toast.success("Removed from today's meals");
    },
    onError: (e: any) => toast.error(e.message || "Failed to undo"),
  });

  const addToMeals = useMutation({
    mutationFn: async (portionGrams?: number) => {
      if (!scan || !session?.user?.id) throw new Error("Not signed in");
      const n = (scan.nutrition || {}) as Record<string, number>;
      const isMeal = scan.scan_type === "meal";
      // Meal photos are estimated as a whole serving; barcode/package are per-100g.
      const factor = isMeal ? 1 : (Number(portionGrams) || 100) / 100;
      const portionLabel = isMeal
        ? "1 serving (scanned)"
        : `${Math.round((Number(portionGrams) || 100))}g (scanned)`;
      const { data: logData, error: logErr } = await supabase.from("food_logs").insert({
        user_id: session.user.id,
        food_name: scan.product_name,
        meal_type: "snack",
        calories: Math.round((Number(n.calories) || 0) * factor),
        protein_g: Math.round((Number(n.protein_g) || 0) * factor * 10) / 10,
        carbs_g: Math.round((Number(n.carbs_g) || 0) * factor * 10) / 10,
        fat_g: Math.round((Number(n.fat_g) || 0) * factor * 10) / 10,
        portion_size: portionLabel,
        image_url: scan.image_url,
      }).select("id").single();
      if (logErr) throw logErr;
      const { error: scanErr } = await supabase
        .from("food_scans")
        .update({ added_at: new Date().toISOString() } as any)
        .eq("id", scan.id);
      if (scanErr) throw scanErr;
      return logData.id as string;
    },
    onSuccess: (logId) => {
      queryClient.invalidateQueries({ queryKey: ["scan", id] });
      queryClient.invalidateQueries({ queryKey: ["food-logs"] });
      queryClient.invalidateQueries({ queryKey: ["eaten-scan-avg"] });
      setPortionOpen(false);
      if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
      navTimeoutRef.current = setTimeout(() => {
        navigate("/nutrition");
      }, 5000);
      toast.success("Added to today's meals", {
        duration: 5000,
        action: {
          label: "Отменить",
          onClick: () => undoMeal.mutate(logId),
        },
      });
    },
    onError: (e: any) => toast.error(e.message || "Failed to add"),
  });

  const handleAddClick = () => {
    if (!scan) return;
    if (scan.scan_type === "meal") {
      addToMeals.mutate(undefined);
    } else {
      setPortionOpen(true);
    }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (!scan) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Scan not found.</div>;

  const nutrition = (scan.nutrition || {}) as Record<string, number>;
  const whatsGood = (scan.positives as string[]) || [];
  const thingsToKnow = ((scan as any).things_to_know as string[]) || (scan.concerns as string[]) || [];
  const alternatives = (scan.alternatives as { name: string; reason: string }[]) || [];
  const intel = (scan.ingredient_intelligence as { name: string; rating: string; note: string }[]) || [];
  const allergens = ((scan as any).allergens as string[]) || [];
  const nova = Number(scan.nova_group ?? 0);
  const recommendation = (scan as any).personalized_recommendation || scan.coach_tip;
  const goal = (scan as any).goal_at_scan as string | null;
  const fit = Number((scan as any).goal_fit_score ?? 0);

  return (
    <div className="min-h-screen pb-28">
      <div className="max-w-lg mx-auto px-4 pt-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate("/scan")} className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Scan Result</h1>
          <div className="w-9 h-9" />
        </div>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 mb-4 text-center">
          {scan.image_url && <img src={scan.image_url} alt="" className="w-20 h-20 rounded-xl object-cover mx-auto mb-3" />}
          <h2 className="text-lg font-bold text-foreground">{scan.product_name}</h2>
          {scan.brand && <p className="text-xs text-muted-foreground mt-0.5">{scan.brand}</p>}
          {(scan as any).category && (
            <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-secondary/60 px-2 py-1 rounded-full">
              <Tag className="w-3 h-3" /> {(scan as any).category}
            </span>
          )}
        </motion.div>

        {/* Single score */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-5 mb-4 flex flex-col items-center">
          {goal === "balanced" || !goal ? (
            <HealthScoreRing score={scan.health_score} category={scan.score_category} size={220} title="Hello Daily Score" />
          ) : (
            <HealthScoreRing score={fit} size={220} title={`Goal Fit · ${goalLabel(goal)}`} />
          )}
          {goal && goal !== "balanced" && (
            <div
              className="mt-3 px-3 py-1 rounded-full text-[11px] font-bold text-white shadow"
              style={{ background: goalFitColor(fit) }}
            >
              {goalFitLabel(fit)}
            </div>
          )}
        </motion.div>

        {/* Add / Dismiss actions */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="grid grid-cols-2 gap-2 mb-4">
          <button
            onClick={handleAddClick}
            disabled={addToMeals.isPending || !!(scan as any).added_at}
            style={{ backgroundImage: "linear-gradient(90deg, hsl(152 65% 45%), hsl(142 70% 36%))" }}
            className="rounded-xl px-4 py-3 flex items-center justify-center gap-2 text-sm font-bold !text-white shadow-md active:scale-[0.98] transition disabled:opacity-60"
          >
            {addToMeals.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {(scan as any).added_at ? "Added" : "I ate this"}
          </button>
          <button
            onClick={() => navigate("/scan")}
            style={{ backgroundImage: "linear-gradient(90deg, hsl(0 75% 60%), hsl(350 70% 48%))" }}
            className="rounded-xl px-4 py-3 flex items-center justify-center gap-2 text-sm font-bold !text-white shadow-md active:scale-[0.98] transition"
          >
            <X className="w-4 h-4" /> Dismiss
          </button>
        </motion.div>


        {/* NOVA */}
        {nova >= 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="glass-card p-4 mb-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-white"
                 style={{ background: NOVA_COLORS[nova] }}>{nova}</div>
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Processing Level</p>
              <p className="text-sm font-bold text-foreground">{NOVA_LABELS[nova]}</p>
            </div>
          </motion.div>
        )}

        {/* AI Summary */}
        {scan.ai_summary && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="glass-card p-4 mb-4">
            <p className="text-sm text-foreground/90 leading-relaxed">{scan.ai_summary}</p>
          </motion.div>
        )}

        {/* Personalized Recommendation */}
        {recommendation && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="glass-card p-4 mb-4 flex gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary">For Your Goal · {goalLabel(goal)}</p>
              <p className="text-xs text-foreground/90 leading-relaxed mt-0.5">{recommendation}</p>
            </div>
          </motion.div>
        )}

        {/* Nutrition */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mb-4">
          <h3 className="text-xs font-bold text-foreground/70 uppercase tracking-wider mb-2 px-1">Nutrition (per 100g)</h3>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(NUTRIENT_LABELS).map(([k]) => nutrition[k] !== undefined && (
              <NutrientCard key={k} k={k} v={Number(nutrition[k]) || 0} />
            ))}
          </div>
        </motion.div>

        {whatsGood.length > 0 && (
          <div className="glass-card p-4 mb-4">
            <h3 className="text-sm font-bold text-health-activity mb-2 flex items-center gap-2"><Check className="w-4 h-4" /> What's Good</h3>
            <ul className="space-y-1.5">
              {whatsGood.map((p, i) => <li key={i} className="text-xs text-foreground/90 flex gap-2"><span className="text-health-activity">✓</span>{p}</li>)}
            </ul>
          </div>
        )}

        {thingsToKnow.length > 0 && (
          <div className="glass-card p-4 mb-4">
            <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2"><Info className="w-4 h-4 text-primary" /> Things To Know</h3>
            <ul className="space-y-1.5">
              {thingsToKnow.map((c, i) => <li key={i} className="text-xs text-foreground/90 flex gap-2"><span className="text-primary">·</span>{c}</li>)}
            </ul>
          </div>
        )}

        {intel.length > 0 && (
          <div className="glass-card p-4 mb-4">
            <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2"><Leaf className="w-4 h-4 text-health-activity" /> Ingredient Intelligence</h3>
            <div className="flex flex-wrap gap-1.5">
              {intel.map((i, idx) => {
                const c = i.rating === "good" ? "bg-health-activity/15 text-health-activity border-health-activity/30"
                  : i.rating === "bad" ? "bg-health-heart/15 text-health-heart border-health-heart/30"
                  : "bg-secondary text-muted-foreground border-border";
                return <span key={idx} title={i.note} className={`text-[10px] font-medium px-2 py-1 rounded-full border ${c}`}>{i.name}</span>;
              })}
            </div>
          </div>
        )}

        {allergens.length > 0 && (
          <div className="glass-card p-4 mb-4">
            <h3 className="text-xs font-bold text-foreground/70 uppercase tracking-wider mb-2">Contains (informational only)</h3>
            <div className="flex flex-wrap gap-1.5">
              {allergens.map((a) => (
                <span key={a} className="text-[10px] font-semibold px-2 py-1 rounded-full bg-secondary text-foreground/80 border border-border">{a}</span>
              ))}
            </div>
          </div>
        )}

        {alternatives.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs font-bold text-foreground/70 uppercase tracking-wider mb-2 px-1">Better Fits For Your Goal</h3>
            <div className="space-y-2">
              {alternatives.map((a, i) => (
                <div key={i} className="glass-card p-3">
                  <p className="text-sm font-semibold text-foreground">{a.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{a.reason}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground text-center px-6 mt-2">Informational only — not medical advice.</p>
      </div>
      <BottomNav />

      <Dialog open={portionOpen} onOpenChange={setPortionOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Portion size</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Nutrition is per 100g. Enter how many grams you ate to log the correct amount.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="grams" className="text-xs">Grams eaten</Label>
              <Input
                id="grams"
                type="number"
                inputMode="numeric"
                min={1}
                value={grams}
                onChange={(e) => setGrams(e.target.value)}
                placeholder="e.g. 150"
              />
            </div>
            {Number(grams) > 0 && (() => {
              const factor = Number(grams) / 100;
              const n = nutrition;
              const add = {
                calories: Math.round((n.calories || 0) * factor),
                protein_g: Math.round((n.protein_g || 0) * factor * 10) / 10,
                carbs_g: Math.round((n.carbs_g || 0) * factor * 10) / 10,
                fat_g: Math.round((n.fat_g || 0) * factor * 10) / 10,
              };
              const cur = todayTotals || { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
              const after = {
                calories: cur.calories + add.calories,
                protein_g: Math.round((cur.protein_g + add.protein_g) * 10) / 10,
                carbs_g: Math.round((cur.carbs_g + add.carbs_g) * 10) / 10,
                fat_g: Math.round((cur.fat_g + add.fat_g) * 10) / 10,
              };
              const rows: { k: keyof typeof add; label: string; unit: string }[] = [
                { k: "calories", label: "Calories", unit: "kcal" },
                { k: "protein_g", label: "Protein", unit: "g" },
                { k: "carbs_g", label: "Carbs", unit: "g" },
                { k: "fat_g", label: "Fat", unit: "g" },
              ];
              const fmt = (k: string, v: number) => (k === "calories" ? Math.round(v).toString() : v.toFixed(1));
              return (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Daily total · adding {grams}g
                  </p>
                  <div className="glass-card p-3 space-y-1.5">
                    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      <span />
                      <span className="text-right">Today</span>
                      <span className="text-right text-primary">+ Add</span>
                      <span className="text-right">After</span>
                    </div>
                    {rows.map(({ k, label, unit }) => (
                      <div key={k} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 items-baseline text-xs">
                        <span className="text-foreground/80">{label}</span>
                        <span className="text-right text-foreground/70 tabular-nums">{fmt(k, cur[k])}<span className="text-[10px] text-muted-foreground ml-0.5">{unit}</span></span>
                        <span className="text-right text-primary font-semibold tabular-nums">+{fmt(k, add[k])}<span className="text-[10px] ml-0.5">{unit}</span></span>
                        <span className="text-right font-bold text-foreground tabular-nums">{fmt(k, after[k])}<span className="text-[10px] text-muted-foreground ml-0.5">{unit}</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
          <DialogFooter className="grid grid-cols-2 gap-2 sm:grid-cols-2">
            <button
              onClick={() => {
                const g = Number(grams);
                if (!g || g <= 0) { toast.error("Enter a valid weight"); return; }
                addToMeals.mutate(g);
              }}
              disabled={addToMeals.isPending}
              style={{ backgroundImage: "linear-gradient(90deg, hsl(152 65% 45%), hsl(142 70% 36%))" }}
              className="rounded-xl px-4 py-3 flex items-center justify-center gap-2 text-sm font-bold !text-white shadow-md active:scale-[0.98] transition disabled:opacity-60"
            >
              {addToMeals.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              <Plus className="w-4 h-4" /> Добавить
            </button>
            <button
              onClick={() => setPortionOpen(false)}
              style={{ backgroundImage: "linear-gradient(90deg, hsl(0 75% 60%), hsl(350 70% 48%))" }}
              className="rounded-xl px-4 py-3 flex items-center justify-center gap-2 text-sm font-bold !text-white shadow-md active:scale-[0.98] transition"
            >
              <X className="w-4 h-4" /> Отмена
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ScanResult;
