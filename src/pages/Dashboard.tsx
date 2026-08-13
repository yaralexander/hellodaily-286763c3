import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Bell, User, Sun, MoonIcon, ChevronRight, History } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useThemeContext } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import AIInsights from "@/components/AIInsights";
import BottomNav from "@/components/BottomNav";
import ScanFoodButton from "@/components/scan/ScanFoodButton";
import NutritionGoalPicker from "@/components/scan/NutritionGoalPicker";
import { useNutritionGoal, goalLabel } from "@/hooks/useNutritionGoal";
import { goalFitLabel, goalFitColor } from "@/lib/goalFitTier";
import logoLight from "@/assets/logo-light.gif";
import logoDark from "@/assets/logo-dark.gif";

const getGreeting = (t: any) => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return t.goodMorning;
  if (hour >= 12 && hour < 17) return t.goodAfternoon;
  if (hour >= 17 && hour < 22) return t.goodEvening;
  return t.goodNight;
};

const MacroPill = ({ label, current, goal, color }: { label: string; current: number; goal: number; color: string }) => {
  const pct = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
        <span className="text-[10px] text-muted-foreground">{Math.round(current)}/{goal}g</span>
      </div>
      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const displayName = session?.user?.user_metadata?.full_name || session?.user?.email?.split("@")[0] || "User";
  const { theme, toggleTheme } = useThemeContext();
  const { t, language } = useLanguage();
  const ru = language === "ru";
  const { goal } = useNutritionGoal();
  const userId = session?.user?.id;
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: todayLogs = [] } = useQuery({
    queryKey: ["dashboard-today-logs", today, userId],
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

  const { data: profile } = useQuery({
    queryKey: ["dashboard-profile-cal", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from("profiles")
        .select("daily_calorie_limit,calorie_input_mode,age,gender,height_cm,weight_kg,activity_level")
        .eq("user_id", userId)
        .maybeSingle();
      return data;
    },
    enabled: !!userId,
  });

  const { data: recentScans = [] } = useQuery({
    queryKey: ["dashboard-recent-scans", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from("food_scans")
        .select("id,product_name,image_url,goal_fit_score,scanned_at")
        .order("scanned_at", { ascending: false })
        .limit(4);
      return data || [];
    },
    enabled: !!userId,
  });

  const calorieLimit = useMemo(() => {
    if (!profile) return 2200;
    const p: any = profile;
    if (p.calorie_input_mode === "manual" && p.daily_calorie_limit) return p.daily_calorie_limit;
    if (p.age && p.height_cm && p.weight_kg) {
      const bmr = p.gender === "female"
        ? 10 * p.weight_kg + 6.25 * p.height_cm - 5 * p.age - 161
        : 10 * p.weight_kg + 6.25 * p.height_cm - 5 * p.age + 5;
      const mult: Record<string, number> = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
      return Math.round(bmr * (mult[p.activity_level] ?? 1.55));
    }
    return p.daily_calorie_limit || 2200;
  }, [profile]);

  const totals = todayLogs.reduce(
    (a: any, l: any) => ({
      calories: a.calories + (l.calories || 0),
      protein: a.protein + Number(l.protein_g || 0),
      carbs: a.carbs + Number(l.carbs_g || 0),
      fat: a.fat + Number(l.fat_g || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const macroGoals = {
    protein: Math.round(calorieLimit * 0.3 / 4),
    carbs: Math.round(calorieLimit * 0.45 / 4),
    fat: Math.round(calorieLimit * 0.25 / 9),
  };
  const caloriePct = calorieLimit > 0 ? Math.min((totals.calories / calorieLimit) * 100, 100) : 0;

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-lg mx-auto px-4 pt-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-center mb-4">
          <img src={theme === "dark" ? logoDark : logoLight} alt="HelloDaily" className="h-8 object-contain" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-5"
        >
          <div>
            <p className="text-xs text-muted-foreground font-medium">{getGreeting(t)}</p>
            <h1 className="text-xl font-bold text-foreground">{displayName}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center">
              {theme === "dark" ? <Sun className="w-4 h-4 text-foreground" /> : <MoonIcon className="w-4 h-4 text-foreground" />}
            </button>
            <button className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center relative">
              <Bell className="w-4 h-4 text-foreground" />
              <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-health-heart" />
            </button>
            <button onClick={() => navigate("/profile")} className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center">
              <User className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </motion.div>

        {/* 1. Current Nutrition Goal */}
        <div className="mb-4"><NutritionGoalPicker /></div>

        {/* 2. Scan Food CTA */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mb-4">
          <ScanFoodButton />
        </motion.div>

        {/* 3. Today's Nutrition */}
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onClick={() => navigate("/nutrition")}
          className="w-full glass-card p-5 mb-4 text-left"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{ru ? "Сегодня" : "Today"}</p>
              <h2 className="text-sm font-bold text-foreground">{t.nutrition}</h2>
            </div>
            <div className="text-right">
              <p className="text-2xl font-extrabold text-foreground leading-none">{Math.round(totals.calories)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">/ {calorieLimit} kcal</p>
            </div>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden mb-4">
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-health-calories transition-all duration-700" style={{ width: `${caloriePct}%` }} />
          </div>
          <div className="flex gap-4">
            <MacroPill label="Protein" current={totals.protein} goal={macroGoals.protein} color="hsl(var(--health-heart))" />
            <MacroPill label="Carbs" current={totals.carbs} goal={macroGoals.carbs} color="hsl(var(--health-nutrition))" />
            <MacroPill label="Fat" current={totals.fat} goal={macroGoals.fat} color="hsl(var(--health-sleep))" />
          </div>
        </motion.button>

        {/* 5. AI Insights */}
        <div className="mb-4"><AIInsights /></div>

        {/* 6. Recent Scans */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-card p-5 mb-4"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">{ru ? "Последние сканирования" : "Recent Scans"}</h3>
            <button onClick={() => navigate("/scan/history")} className="text-[11px] text-primary font-semibold flex items-center gap-0.5">
              History <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          {recentScans.length === 0 ? (
            <div className="flex flex-col items-center py-4 text-center">
              <History className="w-6 h-6 text-muted-foreground mb-2" />
              <p className="text-xs text-muted-foreground">No scans yet. Scan a food to see how it fits your {goalLabel(goal)} goal.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentScans.map((s: any) => (
                <button
                  key={s.id}
                  onClick={() => navigate(`/scan/result/${s.id}`)}
                  className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-secondary/60 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-secondary overflow-hidden shrink-0">
                    {s.image_url && <img src={s.image_url} alt={s.product_name} className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{s.product_name}</p>
                    <p className="text-[10px] text-muted-foreground">{goalFitLabel(s.goal_fit_score || 0)}</p>
                  </div>
                  <div
                    className="px-2 py-1 rounded-lg text-[10px] font-bold text-white"
                    style={{ background: goalFitColor(s.goal_fit_score || 0) }}
                  >
                    {s.goal_fit_score || 0}
                  </div>
                </button>
              ))}
            </div>
          )}
        </motion.div>

        {/* 7. Weekly trend link */}
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onClick={() => navigate("/insights")}
          className="w-full glass-card p-4 mb-4 flex items-center justify-between hover:bg-card/80 transition-colors"
        >
          <div className="text-left">
            <p className="text-sm font-semibold text-foreground">{ru ? "Питание за неделю" : "Weekly Nutrition Trend"}</p>
            <p className="text-[10px] text-muted-foreground">{ru ? "Калории и соответствие цели за последние 7 дней" : "See your 7-day calorie and goal-fit trend"}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </motion.button>
      </div>

      <BottomNav />
    </div>
  );
};

export default Dashboard;
