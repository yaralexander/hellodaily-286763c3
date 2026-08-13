import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ScanLine, Trophy, AlertTriangle, Target } from "lucide-react";
import { format } from "date-fns";
import BottomNav from "@/components/BottomNav";
import { useNutritionGoal, goalLabel } from "@/hooks/useNutritionGoal";
import { useLanguage } from "@/contexts/LanguageContext";

type Tab = "all" | "best" | "for_goal" | "avoid";

const SCORE_COLOR = (s: number) =>
  s >= 80 ? "text-health-activity" : s >= 60 ? "text-yellow-500" : s >= 40 ? "text-orange-500" : "text-health-heart";

const ScanHistory = () => {
  const navigate = useNavigate();
  const { goal } = useNutritionGoal();
  const { language } = useLanguage();
  const ru = language === "ru";
  const [tab, setTab] = useState<Tab>("all");

  const { data: scans = [] } = useQuery({
    queryKey: ["scan-history", tab, goal],
    queryFn: async () => {
      let q = supabase.from("food_scans").select("*");
      if (tab === "best") {
        q = q.gte("health_score", 80).order("health_score", { ascending: false });
      } else if (tab === "for_goal") {
        q = q.order("goal_fit_score", { ascending: false }).limit(20);
      } else if (tab === "avoid") {
        q = q.lte("health_score", 40).order("health_score", { ascending: true });
      } else {
        q = q.order("created_at", { ascending: false });
      }
      const { data } = await q.limit(100);
      return data || [];
    },
  });

  const { data: pointsTotal = 0 } = useQuery({
    queryKey: ["wellness-points-total"],
    queryFn: async () => {
      const { data } = await supabase.from("wellness_points").select("points");
      return (data || []).reduce((s, r: any) => s + (r.points || 0), 0);
    },
  });

  const tabs: { v: Tab; label: string; icon: any }[] = [
    { v: "all", label: ru ? "Все" : "All", icon: ScanLine },
    { v: "best", label: ru ? "Лучший выбор" : "Smart Buy", icon: Trophy },
    { v: "for_goal", label: ru ? "Для цели" : "For Goal", icon: Target },
    { v: "avoid", label: ru ? "Избегать" : "Avoid", icon: AlertTriangle },
  ];

  const emptyCopy: Record<Tab, string> = {
    all: ru ? "Сканирований пока нет. Попробуйте отсканировать первый продукт!" : "No scans yet. Try scanning your first food!",
    best: ru ? "Лучших вариантов пока нет. Сканируйте больше продуктов, чтобы составить список." : "No top-quality scans yet. Scan more products to build your Smart Buy list.",
    for_goal: ru ? `Пока нет продуктов для цели «${goalLabel(goal, language)}».` : `Nothing scanned that fits ${goalLabel(goal, language)} yet.`,
    avoid: ru ? "Продуктов с низкой оценкой нет — отличная работа!" : "No low-quality scans recorded — nice work!",
  };

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-lg mx-auto px-4 pt-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate("/scan")} className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-lg font-bold">{ru ? "Архив продуктов" : "Food Archive"}</h1>
          <div className="w-9 h-9" />
        </div>

        <div className="glass-card p-4 mb-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{ru ? "Баллы здоровья" : "Wellness Points"}</p>
            <p className="text-2xl font-extrabold text-foreground">{pointsTotal}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{ru ? "Текущая цель" : "Current Goal"}</p>
            <p className="text-sm font-bold text-foreground">{goalLabel(goal, language)}</p>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
          {tabs.map(({ v, label, icon: Icon }) => (
            <button
              key={v}
              onClick={() => setTab(v)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                tab === v ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        {scans.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <ScanLine className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{emptyCopy[tab]}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {scans.map((s: any) => {
              const primary = tab === "for_goal" ? s.goal_fit_score : s.health_score;
              const secondary = tab === "for_goal" ? s.health_score : s.goal_fit_score;
              return (
                <button
                  key={s.id}
                  onClick={() => navigate(`/scan/result/${s.id}`)}
                  className="w-full glass-card p-3 flex items-center gap-3 text-left hover:bg-card/70"
                >
                  {s.image_url ? (
                    <img src={s.image_url} alt="" className="w-12 h-12 rounded-xl object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center text-xl">
                      {s.scan_type === "meal" ? "🍽️" : s.scan_type === "package" ? "📦" : "🧾"}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{s.product_name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(s.created_at), "MMM d")} · {s.category || s.scan_type}
                      {s.nova_group ? ` · NOVA ${s.nova_group}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-extrabold ${SCORE_COLOR(primary)}`}>{primary}</div>
                    <div className="text-[9px] text-muted-foreground">{ru ? "соответствие" : "fit"} {secondary}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
};

export default ScanHistory;
