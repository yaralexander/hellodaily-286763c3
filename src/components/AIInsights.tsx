import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, subDays } from "date-fns";
import { useNutritionGoal, goalLabel } from "@/hooks/useNutritionGoal";

type Insight = { text: string; type: "positive" | "neutral" | "action" };

const typeStyles = {
  positive: "border-l-health-activity",
  neutral: "border-l-health-sleep",
  action: "border-l-health-nutrition",
};

const AIInsights = () => {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const { goal } = useNutritionGoal();
  const today = format(new Date(), "yyyy-MM-dd");
  const weekStart = format(subDays(new Date(), 6), "yyyy-MM-dd");

  const { data: todayLogs = [] } = useQuery({
    queryKey: ["insights-today-logs", today, userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from("food_logs")
        .select("calories,protein_g,carbs_g,fat_g")
        .gte("logged_at", `${today}T00:00:00`)
        .lte("logged_at", `${today}T23:59:59`);
      return data || [];
    },
    enabled: !!userId,
  });

  const { data: recentScans = [] } = useQuery({
    queryKey: ["insights-recent-scans", weekStart, userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from("food_scans")
        .select("product_name,goal_fit_score,health_score,nova_group,scanned_at")
        .gte("scanned_at", `${weekStart}T00:00:00`)
        .order("scanned_at", { ascending: false });
      return data || [];
    },
    enabled: !!userId,
  });

  const insights = useMemo<Insight[]>(() => {
    const out: Insight[] = [];
    const totals = todayLogs.reduce(
      (a: any, l: any) => ({
        calories: a.calories + (l.calories || 0),
        protein: a.protein + Number(l.protein_g || 0),
        carbs: a.carbs + Number(l.carbs_g || 0),
        fat: a.fat + Number(l.fat_g || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    if (totals.calories === 0 && recentScans.length === 0) {
      out.push({ type: "neutral", text: `Scan your first meal or product to get personalized ${goalLabel(goal)} insights.` });
      return out;
    }

    // Protein insight (rough targets)
    const proteinTarget = 90;
    if (totals.calories > 0 && totals.protein < proteinTarget * 0.6) {
      out.push({
        type: "action",
        text: `You're at ${Math.round(totals.protein)}g of protein today. Aim for around ${proteinTarget}g to support your ${goalLabel(goal)} goal.`,
      });
    } else if (totals.protein >= proteinTarget) {
      out.push({ type: "positive", text: `Great — ${Math.round(totals.protein)}g protein logged today.` });
    }

    // Ultra-processed insight
    const nova4 = recentScans.filter((s: any) => s.nova_group === 4).length;
    if (recentScans.length >= 3 && nova4 / recentScans.length >= 0.5) {
      out.push({
        type: "action",
        text: `${nova4} of your last ${recentScans.length} scans were ultra-processed. Try swapping one for a whole-food option.`,
      });
    }

    // Goal fit average
    const withFit = recentScans.filter((s: any) => typeof s.goal_fit_score === "number");
    if (withFit.length >= 3) {
      const avg = Math.round(withFit.reduce((s: number, r: any) => s + r.goal_fit_score, 0) / withFit.length);
      if (avg >= 75) out.push({ type: "positive", text: `Your recent scans average ${avg}/100 fit for ${goalLabel(goal)}. Keep it up.` });
      else if (avg < 50) out.push({ type: "action", text: `Recent scans average only ${avg}/100 fit for ${goalLabel(goal)}. Aim for higher-fit swaps.` });
    }

    if (out.length === 0) {
      out.push({ type: "neutral", text: `Keep scanning meals — I'll surface trends for your ${goalLabel(goal)} goal.` });
    }
    return out.slice(0, 3);
  }, [todayLogs, recentScans, goal]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="glass-card p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-health-calories/20 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-health-calories" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">AI Nutrition Insights</h3>
      </div>
      <div className="space-y-3">
        {insights.map((insight, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.1 }}
            className={`border-l-2 ${typeStyles[insight.type]} pl-3 py-1`}
          >
            <p className="text-xs text-muted-foreground leading-relaxed">{insight.text}</p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default AIInsights;
