import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Plus, Utensils, Trash2, Loader2, X, Edit2, AlertTriangle, Settings2, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, isToday, subDays } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Cell } from "recharts";
import BottomNav from "@/components/BottomNav";
import DateStrip from "@/components/DateStrip";
import ScanFoodButton from "@/components/scan/ScanFoodButton";
import { Progress } from "@/components/ui/progress";
import { useLanguage } from "@/contexts/LanguageContext";

type FoodLog = {
  id: string;
  food_name: string;
  meal_type: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  portion_size: string | null;
  image_url: string | null;
  logged_at: string;
};

type FoodAnalysis = {
  foods: Array<{
    name: string;
    portion_size: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }>;
  meal_type: string;
  summary: string;
};
const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

function calculateTDEE(age: number | null, gender: string | null, heightCm: number | null, weightKg: number | null, activityLevel: string): number {
  if (!age || !heightCm || !weightKg) return 2200;
  // Mifflin-St Jeor equation
  let bmr: number;
  if (gender === "female") {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  } else {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  }
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] ?? 1.55;
  return Math.round(bmr * multiplier);
}

const DEFAULT_CALORIE_LIMIT = 2200;
const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"];

const MacroRing = ({ label, current, goal, color }: { label: string; current: number; goal: number; color: string }) => {
  const pct = Math.min((current / goal) * 100, 100);
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-16 h-16">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(var(--secondary))" strokeWidth="3" />
          <circle cx="18" cy="18" r="15.5" fill="none" stroke={color} strokeWidth="3" strokeDasharray={`${pct} 100`} strokeLinecap="round" className="transition-all duration-700" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">{Math.round(current)}</span>
      </div>
      <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
      <span className="text-[10px] text-muted-foreground">/ {goal}g</span>
    </div>
  );
};

type ManualForm = {
  food_name: string;
  meal_type: string;
  calories: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
  portion_size: string;
};

const emptyForm: ManualForm = { food_name: "", meal_type: "snack", calories: "", protein_g: "", carbs_g: "", fat_g: "", portion_size: "" };

const Nutrition = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<FoodAnalysis | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showManual, setShowManual] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ManualForm>(emptyForm);
  const [showCalorieSettings, setShowCalorieSettings] = useState(false);
  const [calorieMode, setCalorieMode] = useState<"auto" | "manual">("auto");
  const [calorieLimit, setCalorieLimit] = useState(DEFAULT_CALORIE_LIMIT);
  const [calorieLimitInput, setCalorieLimitInput] = useState(String(DEFAULT_CALORIE_LIMIT));
  const [editingAiIndex, setEditingAiIndex] = useState<number | null>(null);
  const [recalculating, setRecalculating] = useState<number | null>(null);
  const [recalcEditForm, setRecalcEditForm] = useState(false);

  const userId = session?.user?.id;
  const isTestMode = !userId && sessionStorage.getItem("testMode") === "true";
  const [localLogs, setLocalLogs] = useState<FoodLog[]>([]);

  const dateStr = format(selectedDate, "yyyy-MM-dd");

  // Load calorie settings from profile
  const { data: profileData } = useQuery({
    queryKey: ["profile-calorie-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("daily_calorie_limit, calorie_input_mode, age, gender, height_cm, weight_kg, activity_level")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const tdeeValue = useMemo(() => {
    if (!profileData) return DEFAULT_CALORIE_LIMIT;
    const p = profileData as any;
    return calculateTDEE(p.age, p.gender, p.height_cm, p.weight_kg, p.activity_level || "moderate");
  }, [profileData]);

  useEffect(() => {
    if (profileData) {
      const mode = (profileData as any).calorie_input_mode ?? "auto";
      const limit = mode === "manual" 
        ? ((profileData as any).daily_calorie_limit ?? DEFAULT_CALORIE_LIMIT)
        : tdeeValue;
      setCalorieLimit(limit);
      setCalorieLimitInput(String((profileData as any).daily_calorie_limit ?? tdeeValue));
      setCalorieMode(mode as "auto" | "manual");
    }
  }, [profileData, tdeeValue]);

  const saveCalorieSettingsMutation = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      const parsedLimit = calorieMode === "manual" ? parseInt(calorieLimitInput) : tdeeValue;
      if (calorieMode === "manual" && (isNaN(parsedLimit) || parsedLimit < 500 || parsedLimit > 10000)) {
        throw new Error("Calorie limit must be between 500 and 10,000");
      }
      const finalLimit = calorieMode === "manual" ? parsedLimit : tdeeValue;
      const { error } = await supabase
        .from("profiles")
        .update({ daily_calorie_limit: finalLimit, calorie_input_mode: calorieMode } as any)
        .eq("user_id", userId);
      if (error) throw error;
      setCalorieLimit(finalLimit);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-calorie-settings"] });
      setShowCalorieSettings(false);
      toast.success("Calorie limit updated");
    },
    onError: (err: any) => toast.error(err.message || "Failed to save"),
  });

  // Weekly trends query
  const weekStart = format(subDays(new Date(), 6), "yyyy-MM-dd");
  const weekEnd = format(new Date(), "yyyy-MM-dd");

  const { data: weeklyLogs = [] } = useQuery({
    queryKey: ["food-logs-weekly", weekStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("food_logs")
        .select("calories, logged_at")
        .gte("logged_at", `${weekStart}T00:00:00`)
        .lte("logged_at", `${weekEnd}T23:59:59`);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  const weeklyChartData = useMemo(() => {
    const days: { day: string; date: string; calories: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const ds = format(d, "yyyy-MM-dd");
      const cals = weeklyLogs
        .filter((l: any) => l.logged_at?.startsWith(ds))
        .reduce((sum: number, l: any) => sum + (l.calories || 0), 0);
      days.push({ day: format(d, "EEE"), date: ds, calories: cals });
    }
    return days;
  }, [weeklyLogs]);

  const weeklyAvg = useMemo(() => {
    const daysWithData = weeklyChartData.filter(d => d.calories > 0);
    if (daysWithData.length === 0) return 0;
    return Math.round(daysWithData.reduce((s, d) => s + d.calories, 0) / daysWithData.length);
  }, [weeklyChartData]);

  const { data: dbFoodLogs = [] } = useQuery({
    queryKey: ["food-logs", dateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("food_logs")
        .select("*")
        .gte("logged_at", `${dateStr}T00:00:00`)
        .lte("logged_at", `${dateStr}T23:59:59`)
        .order("logged_at", { ascending: false });
      if (error) throw error;
      return data as FoodLog[];
    },
    enabled: !!userId,
  });

  const foodLogs = isTestMode ? localLogs.filter(l => l.logged_at.startsWith(dateStr)) : dbFoodLogs;

  const totals = foodLogs.reduce(
    (acc, log) => ({
      calories: acc.calories + log.calories,
      protein: acc.protein + Number(log.protein_g),
      carbs: acc.carbs + Number(log.carbs_g),
      fat: acc.fat + Number(log.fat_g),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const caloriePct = calorieLimit > 0 ? (totals.calories / calorieLimit) * 100 : 0;
  const remaining = calorieLimit - totals.calories;
  const isNearLimit = caloriePct >= 80 && caloriePct < 100;
  const isExceeded = caloriePct >= 100;
  const exceededBy = totals.calories - calorieLimit;

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (isTestMode) { setLocalLogs(prev => prev.filter(l => l.id !== id)); return; }
      const { error } = await supabase.from("food_logs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["food-logs"] });
      toast.success("Entry removed");
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (analysis: FoodAnalysis) => {
      const entries = analysis.foods.map((food) => ({
        user_id: userId || "test-user",
        food_name: food.name,
        meal_type: analysis.meal_type,
        calories: Math.round(food.calories),
        protein_g: Math.round(food.protein_g * 10) / 10,
        carbs_g: Math.round(food.carbs_g * 10) / 10,
        fat_g: Math.round(food.fat_g * 10) / 10,
        portion_size: food.portion_size,
        ai_analysis: analysis,
      }));
      if (isTestMode) {
        const now = new Date().toISOString();
        const localEntries = entries.map((e, i) => ({ ...e, id: `local-${Date.now()}-${i}`, logged_at: now, image_url: null })) as unknown as FoodLog[];
        setLocalLogs((prev) => [...localEntries, ...prev]);
        return;
      }
      const { error } = await supabase.from("food_logs").insert(entries);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["food-logs"] });
      setAnalysisResult(null);
      setPreview(null);
      toast.success("Meal logged!");
    },
    onError: () => toast.error("Failed to save"),
  });

  const saveManualMutation = useMutation({
    mutationFn: async () => {
      const entry = {
        user_id: userId || "test-user",
        food_name: form.food_name.trim(),
        meal_type: form.meal_type,
        calories: parseInt(form.calories) || 0,
        protein_g: parseFloat(form.protein_g) || 0,
        carbs_g: parseFloat(form.carbs_g) || 0,
        fat_g: parseFloat(form.fat_g) || 0,
        portion_size: form.portion_size.trim() || null,
      };
      if (editingId) {
        if (isTestMode) {
          setLocalLogs(prev => prev.map(l => l.id === editingId ? { ...l, ...entry } : l));
          return;
        }
        const { error } = await supabase.from("food_logs").update(entry).eq("id", editingId);
        if (error) throw error;
      } else {
        if (isTestMode) {
          const now = new Date().toISOString();
          setLocalLogs(prev => [{ ...entry, id: `local-${Date.now()}`, logged_at: now, image_url: null } as FoodLog, ...prev]);
          return;
        }
        const { error } = await supabase.from("food_logs").insert(entry);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["food-logs"] });
      setShowManual(false);
      setEditingId(null);
      setForm(emptyForm);
      toast.success(editingId ? "Entry updated!" : "Meal logged!");
    },
    onError: () => toast.error("Failed to save"),
  });

  const startEdit = (log: FoodLog) => {
    setForm({
      food_name: log.food_name,
      meal_type: log.meal_type,
      calories: String(log.calories),
      protein_g: String(log.protein_g),
      carbs_g: String(log.carbs_g),
      fat_g: String(log.fat_g),
      portion_size: log.portion_size || "",
    });
    setEditingId(log.id);
    setShowManual(true);
  };

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
      setAnalyzing(true);
      setAnalysisResult(null);
      try {
        const base64 = await new Promise<string>((resolve) => {
          const r = new FileReader();
          r.onload = () => { resolve((r.result as string).split(",")[1]); };
          r.readAsDataURL(file);
        });
        const { data, error } = await supabase.functions.invoke("analyze-food", {
          body: { imageBase64: base64, mimeType: file.type },
        });
        if (error) throw error;
        if (data.error) throw new Error(data.error);
        setAnalysisResult(data as FoodAnalysis);
      } catch (err: any) {
        toast.error(err.message || "Analysis failed");
        setPreview(null);
      } finally {
        setAnalyzing(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    []
  );

  const mealTypeIcon: Record<string, string> = { breakfast: "🌅", lunch: "☀️", dinner: "🌙", snack: "🍿" };
  const updateField = (field: keyof ManualForm, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const recalcEditFormFood = async () => {
    if (!form.food_name.trim()) return;
    setRecalcEditForm(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-food-text", {
        body: { foodName: form.food_name.trim(), portionSize: form.portion_size || "1 serving" },
      });
      if (error) throw error;
      if (data && !data.error) {
        setForm(prev => ({
          ...prev,
          calories: String(Math.round(data.calories)),
          protein_g: String(Math.round(data.protein_g * 10) / 10),
          carbs_g: String(Math.round(data.carbs_g * 10) / 10),
          fat_g: String(Math.round(data.fat_g * 10) / 10),
        }));
        toast.success("Nutrition recalculated!");
      }
    } catch {
      toast.error("Could not recalculate nutrition");
    } finally {
      setRecalcEditForm(false);
    }
  };

  const updateAiFood = (index: number, field: string, value: string | number) => {
    if (!analysisResult) return;
    const updated = { ...analysisResult, foods: analysisResult.foods.map((f, i) => i === index ? { ...f, [field]: value } : f) };
    setAnalysisResult(updated);
  };

  const recalcAiFood = async (index: number, newName: string) => {
    if (!newName.trim()) return;
    setRecalculating(index);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-food-text", {
        body: { foodName: newName.trim(), portionSize: analysisResult?.foods[index]?.portion_size || "1 serving" },
      });
      if (error) throw error;
      if (data && !data.error) {
        updateAiFood(index, "calories", data.calories);
        if (data.protein_g !== undefined) {
          setAnalysisResult(prev => prev ? {
            ...prev,
            foods: prev.foods.map((f, i) => i === index ? {
              ...f,
              name: newName.trim(),
              calories: data.calories,
              protein_g: data.protein_g,
              carbs_g: data.carbs_g,
              fat_g: data.fat_g,
            } : f),
          } : null);
        }
      }
    } catch {
      toast.error("Could not recalculate nutrition");
    } finally {
      setRecalculating(null);
      setEditingAiIndex(null);
    }
  };

  // Macro goals scale with calorie limit
  const macroGoals = {
    protein: Math.round(calorieLimit * 0.3 / 4), // 30% from protein
    carbs: Math.round(calorieLimit * 0.45 / 4),   // 45% from carbs
    fat: Math.round(calorieLimit * 0.25 / 9),     // 25% from fat
  };

  const progressColor = isExceeded
    ? "bg-destructive"
    : isNearLimit
    ? "bg-yellow-500"
    : "bg-primary";

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-lg mx-auto px-4 pt-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">{t.nutrition}</h1>
            <p className="text-xs text-muted-foreground">{t.trackMeals}</p>
          </div>
          <button
            onClick={() => setShowCalorieSettings(true)}
            className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
          >
            <Settings2 className="w-4.5 h-4.5 text-muted-foreground" />
          </button>
        </motion.div>

        <DateStrip selectedDate={selectedDate} onDateChange={setSelectedDate} />

        <div className="mb-4">
          <ScanFoodButton />
        </div>



        {/* Calorie Limit Exceeded Warning */}
        <AnimatePresence>
          {isExceeded && isToday(selectedDate) && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="mb-4 p-3.5 rounded-xl bg-destructive/10 border border-destructive/30 flex items-start gap-3"
            >
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-destructive">Daily calorie limit exceeded</p>
                <p className="text-xs text-destructive/80 mt-0.5">
                  You've exceeded your limit by {exceededBy} kcal. Consider lighter meals for the rest of the day.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Near limit warning */}
        <AnimatePresence>
          {isNearLimit && !isExceeded && isToday(selectedDate) && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="mb-4 p-3.5 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-start gap-3"
            >
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">Approaching calorie limit</p>
                <p className="text-xs text-yellow-600/80 dark:text-yellow-400/70 mt-0.5">
                  Only {remaining} kcal remaining for today.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Daily Summary */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-5 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-2xl font-bold text-foreground">{totals.calories}</p>
              <p className="text-xs text-muted-foreground">of {calorieLimit} kcal</p>
            </div>
            <div className="text-right">
              <p className={`text-lg font-bold ${isExceeded ? "text-destructive" : remaining <= 200 ? "text-yellow-600 dark:text-yellow-400" : "text-primary"}`}>
                {isExceeded ? `+${exceededBy}` : remaining}
              </p>
              <p className="text-[10px] text-muted-foreground">{isExceeded ? "over" : "remaining"}</p>
            </div>
          </div>

          {/* Calorie progress bar */}
          <div className="mb-4">
            <div className="w-full h-3 rounded-full bg-secondary overflow-hidden">
              <motion.div
                className={`h-full rounded-full transition-colors duration-300 ${progressColor}`}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(caloriePct, 100)}%` }}
                transition={{ duration: 0.7, ease: "easeOut" }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-muted-foreground">{Math.round(caloriePct)}%</span>
              <span className="text-[10px] text-muted-foreground">{calorieLimit} kcal limit</span>
            </div>
          </div>

          <div className="flex justify-around">
            <MacroRing label="Protein" current={totals.protein} goal={macroGoals.protein} color="hsl(var(--health-activity))" />
            <MacroRing label="Carbs" current={totals.carbs} goal={macroGoals.carbs} color="hsl(var(--health-sleep))" />
            <MacroRing label="Fat" current={totals.fat} goal={macroGoals.fat} color="hsl(var(--health-nutrition))" />
          </div>
        </motion.div>

        {/* Action buttons */}
        {isToday(selectedDate) && (
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => { setShowManual(true); setEditingId(null); setForm(emptyForm); }}
              className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Manual
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-semibold flex items-center justify-center gap-2"
            >
              <Camera className="w-4 h-4" /> Scan Food
            </button>
          </div>
        )}

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

        {/* AI analysis preview */}
        <AnimatePresence>
          {(preview || analyzing) && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="glass-card p-5 mb-4">
              {preview && (
                <div className="relative mb-3">
                  <img src={preview} alt="Food preview" className="w-full h-48 object-cover rounded-xl" />
                  {!analyzing && (
                    <button onClick={() => { setPreview(null); setAnalysisResult(null); }} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-background/80 flex items-center justify-center">
                      <X className="w-4 h-4 text-foreground" />
                    </button>
                  )}
                </div>
              )}
              {analyzing && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/50">
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Analyzing your meal...</p>
                    <p className="text-xs text-muted-foreground">Detecting food items & nutrients</p>
                  </div>
                </div>
              )}
               {analysisResult && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">{analysisResult.summary}</p>
                  {analysisResult.foods.map((food, i) => (
                    <div key={i} className="p-3 rounded-xl bg-secondary/50 space-y-2">
                      {editingAiIndex === i ? (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <input
                              value={food.name}
                              onChange={(e) => updateAiFood(i, "name", e.target.value)}
                              className="flex-1 h-8 rounded-lg bg-background border border-border/50 px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                              placeholder="Food name"
                            />
                            <button
                              onClick={() => recalcAiFood(i, food.name)}
                              disabled={recalculating === i}
                              className="px-3 h-8 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50 flex items-center gap-1"
                            >
                              {recalculating === i ? <Loader2 className="w-3 h-3 animate-spin" /> : "Recalc"}
                            </button>
                          </div>
                          <div className="grid grid-cols-4 gap-1.5">
                            <div>
                              <label className="text-[9px] text-muted-foreground">kcal</label>
                              <input type="number" value={food.calories} onChange={(e) => updateAiFood(i, "calories", Number(e.target.value))} className="w-full h-7 rounded-lg bg-background border border-border/50 px-2 text-xs text-foreground focus:outline-none" />
                            </div>
                            <div>
                              <label className="text-[9px] text-muted-foreground">P (g)</label>
                              <input type="number" value={food.protein_g} onChange={(e) => updateAiFood(i, "protein_g", Number(e.target.value))} className="w-full h-7 rounded-lg bg-background border border-border/50 px-2 text-xs text-foreground focus:outline-none" />
                            </div>
                            <div>
                              <label className="text-[9px] text-muted-foreground">C (g)</label>
                              <input type="number" value={food.carbs_g} onChange={(e) => updateAiFood(i, "carbs_g", Number(e.target.value))} className="w-full h-7 rounded-lg bg-background border border-border/50 px-2 text-xs text-foreground focus:outline-none" />
                            </div>
                            <div>
                              <label className="text-[9px] text-muted-foreground">F (g)</label>
                              <input type="number" value={food.fat_g} onChange={(e) => updateAiFood(i, "fat_g", Number(e.target.value))} className="w-full h-7 rounded-lg bg-background border border-border/50 px-2 text-xs text-foreground focus:outline-none" />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <input
                              value={food.portion_size}
                              onChange={(e) => updateAiFood(i, "portion_size", e.target.value)}
                              placeholder="Portion"
                              className="flex-1 h-7 rounded-lg bg-background border border-border/50 px-2 text-xs text-foreground focus:outline-none"
                            />
                            <button
                              onClick={() => recalcAiFood(i, food.name)}
                              disabled={recalculating === i}
                              className="px-3 h-7 rounded-lg bg-primary/20 text-primary text-xs font-medium disabled:opacity-50 flex items-center gap-1"
                            >
                              {recalculating === i ? <Loader2 className="w-3 h-3 animate-spin" /> : "Recalc"}
                            </button>
                            <button onClick={() => setEditingAiIndex(null)} className="px-3 h-7 rounded-lg bg-secondary text-xs text-muted-foreground">Done</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between cursor-pointer" onClick={() => setEditingAiIndex(i)}>
                          <div>
                            <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                              {food.name}
                              <Edit2 className="w-3 h-3 text-muted-foreground" />
                            </p>
                            <p className="text-xs text-muted-foreground">{food.portion_size}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-foreground">{food.calories} kcal</p>
                            <p className="text-[10px] text-muted-foreground">P:{food.protein_g}g C:{food.carbs_g}g F:{food.fat_g}g</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <button onClick={() => saveMutation.mutate(analysisResult)} disabled={saveMutation.isPending} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
                      {saveMutation.isPending ? "Saving..." : "Log This Meal"}
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="py-2.5 px-4 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium">Retry</button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Manual Entry Form */}
        <AnimatePresence>
          {showManual && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => { setShowManual(false); setEditingId(null); }}>
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg glass-card rounded-2xl p-6 space-y-3 max-h-[85vh] overflow-y-auto">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-foreground">{editingId ? "Edit Entry" : "Add Food"}</h2>
                  <button onClick={() => { setShowManual(false); setEditingId(null); }}><X className="w-5 h-5 text-muted-foreground" /></button>
                </div>

                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Food Name</label>
                  <div className="flex gap-2 mt-1">
                    <input value={form.food_name} onChange={(e) => updateField("food_name", e.target.value)} placeholder="e.g. Grilled Chicken Salad" className="flex-1 h-10 rounded-xl bg-secondary border border-border/50 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                    <button
                      onClick={recalcEditFormFood}
                      disabled={recalcEditForm || !form.food_name.trim()}
                      className="h-10 px-3 rounded-xl bg-primary/20 text-primary text-xs font-medium disabled:opacity-40 flex items-center gap-1 shrink-0"
                    >
                      {recalcEditForm ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TrendingUp className="w-3.5 h-3.5" />}
                      Recalc
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Meal Type</label>
                  <div className="flex gap-2 mt-1">
                    {MEAL_TYPES.map((mt) => (
                      <button key={mt} onClick={() => updateField("meal_type", mt)} className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize ${form.meal_type === mt ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                        {mealTypeIcon[mt]} {mt}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Portion Size</label>
                  <input value={form.portion_size} onChange={(e) => updateField("portion_size", e.target.value)} placeholder="e.g. 1 bowl, 200g" className="w-full mt-1 h-10 rounded-xl bg-secondary border border-border/50 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Calories</label>
                    <input type="number" value={form.calories} onChange={(e) => updateField("calories", e.target.value)} placeholder="kcal" className="w-full mt-1 h-10 rounded-xl bg-secondary border border-border/50 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Protein (g)</label>
                    <input type="number" value={form.protein_g} onChange={(e) => updateField("protein_g", e.target.value)} placeholder="g" className="w-full mt-1 h-10 rounded-xl bg-secondary border border-border/50 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Carbs (g)</label>
                    <input type="number" value={form.carbs_g} onChange={(e) => updateField("carbs_g", e.target.value)} placeholder="g" className="w-full mt-1 h-10 rounded-xl bg-secondary border border-border/50 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Fat (g)</label>
                    <input type="number" value={form.fat_g} onChange={(e) => updateField("fat_g", e.target.value)} placeholder="g" className="w-full mt-1 h-10 rounded-xl bg-secondary border border-border/50 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  </div>
                </div>

                <button onClick={() => saveManualMutation.mutate()} disabled={!form.food_name.trim() || saveManualMutation.isPending} className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
                  {saveManualMutation.isPending ? "Saving..." : editingId ? "Update Entry" : "Add Entry"}
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Calorie Settings Modal */}
        <AnimatePresence>
          {showCalorieSettings && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center px-4" onClick={() => setShowCalorieSettings(false)}>
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm glass-card rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-foreground">Calorie Limit</h2>
                  <button onClick={() => setShowCalorieSettings(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
                </div>

                <p className="text-xs text-muted-foreground">Auto mode uses the Mifflin-St Jeor BMR formula × your activity level (TDEE). Fill in your profile for a personalized value.</p>

                <div className="space-y-2">
                  <button
                    onClick={() => setCalorieMode("auto")}
                    className={`w-full p-3 rounded-xl text-left flex items-center gap-3 transition-colors ${calorieMode === "auto" ? "bg-primary/10 border border-primary/30" : "bg-secondary border border-transparent"}`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${calorieMode === "auto" ? "border-primary" : "border-muted-foreground"}`}>
                      {calorieMode === "auto" && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Auto (BMR/TDEE)</p>
                      <p className="text-xs text-muted-foreground">{tdeeValue} kcal based on your profile</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setCalorieMode("manual")}
                    className={`w-full p-3 rounded-xl text-left flex items-center gap-3 transition-colors ${calorieMode === "manual" ? "bg-primary/10 border border-primary/30" : "bg-secondary border border-transparent"}`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${calorieMode === "manual" ? "border-primary" : "border-muted-foreground"}`}>
                      {calorieMode === "manual" && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Set manually</p>
                      <p className="text-xs text-muted-foreground">Enter your own daily calorie limit</p>
                    </div>
                  </button>
                </div>

                {calorieMode === "manual" && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Daily Limit (kcal)</label>
                    <input
                      type="number"
                      value={calorieLimitInput}
                      onChange={(e) => setCalorieLimitInput(e.target.value)}
                      min={500}
                      max={10000}
                      placeholder="e.g. 2000"
                      className="w-full mt-1 h-10 rounded-xl bg-secondary border border-border/50 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">Range: 500 – 10,000 kcal</p>
                  </motion.div>
                )}

                <button
                  onClick={() => saveCalorieSettingsMutation.mutate()}
                  disabled={saveCalorieSettingsMutation.isPending}
                  className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
                >
                  {saveCalorieSettingsMutation.isPending ? "Saving..." : "Save Settings"}
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Weekly Trends */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass-card p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Weekly Trends
            </h2>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">7-day avg</p>
              <p className="text-sm font-bold text-foreground">{weeklyAvg} kcal</p>
            </div>
          </div>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyChartData} barCategoryGap="20%">
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis hide />
                <ReferenceLine y={calorieLimit} stroke="hsl(var(--destructive))" strokeDasharray="4 4" strokeWidth={1.5} />
                <Bar dataKey="calories" radius={[4, 4, 0, 0]}>
                  {weeklyChartData.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={entry.calories > calorieLimit ? "hsl(var(--destructive))" : entry.calories > calorieLimit * 0.8 ? "hsl(45 93% 47%)" : "hsl(var(--primary))"}
                      opacity={entry.calories === 0 ? 0.2 : 1}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-primary" /><span className="text-[10px] text-muted-foreground">Normal</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm" style={{ background: "hsl(45 93% 47%)" }} /><span className="text-[10px] text-muted-foreground">Near limit</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-destructive" /><span className="text-[10px] text-muted-foreground">Exceeded</span></div>
            <div className="flex items-center gap-1.5"><div className="w-6 border-t-2 border-dashed border-destructive" /><span className="text-[10px] text-muted-foreground">Limit</span></div>
          </div>
        </motion.div>

        {/* Day's Log */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mb-4">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Utensils className="w-4 h-4 text-primary" />
            {isToday(selectedDate) ? "Today's Log" : format(selectedDate, "MMM d")} ({foodLogs.length})
          </h2>

          {foodLogs.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <p className="text-sm text-muted-foreground">No meals logged {isToday(selectedDate) ? "yet today" : "this day"}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {foodLogs.map((log) => (
                <motion.div key={log.id} layout className="glass-card p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{mealTypeIcon[log.meal_type] || "🍽️"}</span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{log.food_name}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">{log.meal_type}{log.portion_size && ` · ${log.portion_size}`}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground">{log.calories}</p>
                      <p className="text-[10px] text-muted-foreground">kcal</p>
                    </div>
                    <button onClick={() => startEdit(log)} className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors">
                      <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button onClick={() => deleteMutation.mutate(log.id)} className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center hover:bg-destructive/20 transition-colors">
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
      <BottomNav />
    </div>
  );
};

export default Nutrition;
