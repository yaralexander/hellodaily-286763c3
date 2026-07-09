import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Check, ChevronDown } from "lucide-react";
import { useNutritionGoal, GOAL_OPTIONS, goalLabel } from "@/hooks/useNutritionGoal";

const NutritionGoalPicker = ({ compact = false }: { compact?: boolean }) => {
  const { goal, setGoal, isUpdating } = useNutritionGoal();
  const [open, setOpen] = useState(false);
  const current = GOAL_OPTIONS.find((o) => o.value === goal);

  return (
    <div className="glass-card p-4">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between text-left">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center text-xl">{current?.emoji}</div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1">
              <Target className="w-3 h-3" /> My Nutrition Goal
            </p>
            <p className="text-sm font-bold text-foreground">{goalLabel(goal)}</p>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-2 mt-4">
              {GOAL_OPTIONS.map((o) => {
                const active = o.value === goal;
                return (
                  <button
                    key={o.value}
                    disabled={isUpdating}
                    onClick={() => { setGoal(o.value); setOpen(false); }}
                    className={`flex items-center gap-2 p-2.5 rounded-xl text-left text-xs font-semibold border transition-colors ${
                      active ? "bg-primary text-primary-foreground border-primary"
                             : "bg-secondary/50 text-foreground border-transparent hover:bg-secondary"
                    }`}
                  >
                    <span className="text-base">{o.emoji}</span>
                    <span className="flex-1">{o.label}</span>
                    {active && <Check className="w-3.5 h-3.5" />}
                  </button>
                );
              })}
            </div>
            {!compact && (
              <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
                Changing your goal recalculates Goal Fit Scores for every product you've scanned.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NutritionGoalPicker;
