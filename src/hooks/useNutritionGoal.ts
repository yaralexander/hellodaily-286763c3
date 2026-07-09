import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type NutritionGoal =
  | "balanced" | "weight_loss" | "muscle_gain" | "high_protein" | "keto" | "low_carb"
  | "heart_health" | "diabetes_friendly" | "mediterranean" | "high_fiber"
  | "whole_food" | "low_sodium" | "plant_based";

export const GOAL_OPTIONS: { value: NutritionGoal; label: string; emoji: string }[] = [
  { value: "balanced", label: "Balanced Nutrition", emoji: "⚖️" },
  { value: "weight_loss", label: "Weight Loss", emoji: "🔥" },
  { value: "muscle_gain", label: "Muscle Gain", emoji: "💪" },
  { value: "high_protein", label: "High Protein", emoji: "🥩" },
  { value: "keto", label: "Keto Diet", emoji: "🥑" },
  { value: "low_carb", label: "Low Carb", emoji: "🌾" },
  { value: "heart_health", label: "Heart Health", emoji: "❤️" },
  { value: "diabetes_friendly", label: "Diabetes Friendly", emoji: "🩺" },
  { value: "mediterranean", label: "Mediterranean", emoji: "🫒" },
  { value: "high_fiber", label: "High Fiber", emoji: "🌿" },
  { value: "whole_food", label: "Whole Food", emoji: "🥗" },
  { value: "low_sodium", label: "Low Sodium", emoji: "🧂" },
  { value: "plant_based", label: "Plant Based", emoji: "🌱" },
];

export const goalLabel = (g: string | null | undefined) =>
  GOAL_OPTIONS.find((o) => o.value === g)?.label || "Balanced Nutrition";

export function useNutritionGoal() {
  const qc = useQueryClient();
  const { data: goal = "balanced" as NutritionGoal, isLoading } = useQuery({
    queryKey: ["nutrition-goal"],
    queryFn: async (): Promise<NutritionGoal> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return "balanced";
      const { data } = await supabase.from("profiles").select("nutrition_goal").eq("user_id", user.id).maybeSingle();
      return (data?.nutrition_goal as NutritionGoal) || "balanced";
    },
  });

  const setGoal = useMutation({
    mutationFn: async (newGoal: NutritionGoal) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("profiles").update({ nutrition_goal: newGoal }).eq("user_id", user.id);
      if (error) throw error;
      // Recalculate goal-fit for all existing scans
      await supabase.functions.invoke("recalc-goal-fit", { body: { goal: newGoal } });
      return newGoal;
    },
    onSuccess: (g) => {
      qc.invalidateQueries({ queryKey: ["nutrition-goal"] });
      qc.invalidateQueries({ queryKey: ["scan-history"] });
      qc.invalidateQueries({ queryKey: ["scan"] });
      toast.success(`Goal set: ${goalLabel(g)}`);
    },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  return { goal, isLoading, setGoal: setGoal.mutate, isUpdating: setGoal.isPending };
}
