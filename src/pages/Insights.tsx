import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, subDays } from "date-fns";
import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";
import BottomNav from "@/components/BottomNav";
import AIInsights from "@/components/AIInsights";
import NutritionGoalPicker from "@/components/scan/NutritionGoalPicker";
import { useNutritionGoal, goalLabel } from "@/hooks/useNutritionGoal";
import { goalFitLabel, goalFitColor } from "@/lib/goalFitTier";
import { useLanguage } from "@/contexts/LanguageContext";

const Insights = () => {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const { goal } = useNutritionGoal();
  const { language } = useLanguage();
  const ru = language === "ru";
  const weekStart = format(subDays(new Date(), 6), "yyyy-MM-dd");
  const weekEnd = format(new Date(), "yyyy-MM-dd");

  const { data: weeklyLogs = [] } = useQuery({
    queryKey: ["insights-weekly", weekStart, userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from("food_logs")
        .select("calories,logged_at")
        .gte("logged_at", `${weekStart}T00:00:00`)
        .lte("logged_at", `${weekEnd}T23:59:59`);
      return data || [];
    },
    enabled: !!userId,
  });

  const { data: scans = [] } = useQuery({
    queryKey: ["insights-scans", weekStart, userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from("food_scans")
        .select("id,product_name,goal_fit_score,health_score,scanned_at")
        .gte("scanned_at", `${weekStart}T00:00:00`)
        .order("scanned_at", { ascending: false })
        .limit(30);
      return data || [];
    },
    enabled: !!userId,
  });

  const weeklyChart = useMemo(() => {
    const days: { day: string; calories: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const ds = format(d, "yyyy-MM-dd");
      const cals = weeklyLogs
        .filter((l: any) => l.logged_at?.startsWith(ds))
        .reduce((sum: number, l: any) => sum + (l.calories || 0), 0);
      const dayNames = ru ? ["вс", "пн", "вт", "ср", "чт", "пт", "сб"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      days.push({ day: dayNames[d.getDay()], calories: cals });
    }
    return days;
  }, [weeklyLogs, ru]);

  const avgFit = useMemo(() => {
    const fit = scans.filter((s: any) => typeof s.goal_fit_score === "number");
    if (!fit.length) return 0;
    return Math.round(fit.reduce((s: number, r: any) => s + r.goal_fit_score, 0) / fit.length);
  }, [scans]);

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-lg mx-auto px-4 pt-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
          <h1 className="text-xl font-bold text-foreground">{ru ? "Аналитика" : "Insights"}</h1>
          <p className="text-xs text-muted-foreground">{ru ? `Персонально для вашей цели: ${goalLabel(goal, language)}` : `Personalized to your ${goalLabel(goal, language)} goal`}</p>
        </motion.div>

        <div className="mb-4"><NutritionGoalPicker /></div>

        {scans.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-5 mb-4 flex items-center gap-5"
          >
            <div className="relative w-20 h-20 shrink-0">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(var(--secondary))" strokeWidth="2.5" />
                <circle cx="18" cy="18" r="15.5" fill="none" stroke={goalFitColor(avgFit)} strokeWidth="2.5" strokeDasharray={`${avgFit} 100`} strokeLinecap="round" className="transition-all duration-1000" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-extrabold text-foreground leading-none">{avgFit}</span>
                <span className="text-[8px] text-muted-foreground font-medium">/ 100</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-foreground mb-1">{ru ? "Среднее соответствие цели" : "Average Goal Fit"}</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {ru ? `${goalFitLabel(avgFit, language)} по последним ${scans.length} сканированиям.` : `${goalFitLabel(avgFit, language)} across your last ${scans.length} scan${scans.length === 1 ? "" : "s"}.`}
              </p>
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-5 mb-4"
        >
          <h3 className="text-sm font-semibold text-foreground mb-3">{ru ? "Питание за неделю" : "Weekly Nutrition Trend"}</h3>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyChart}>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis hide />
                <Bar dataKey="calories" radius={[6, 6, 0, 0]}>
                  {weeklyChart.map((_, i) => (
                    <Cell key={i} fill="hsl(var(--health-nutrition))" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <div className="mb-4"><AIInsights /></div>
      </div>
      <BottomNav />
    </div>
  );
};

export default Insights;
