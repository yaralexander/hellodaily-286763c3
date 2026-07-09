// Goal Fit Score™ tier labels — never use "good/bad/healthy/unhealthy" phrasing.
export type GoalFitTier = "excellent" | "good" | "moderate" | "weak" | "poor";

export const goalFitTier = (score: number): GoalFitTier => {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "moderate";
  if (score >= 30) return "weak";
  return "poor";
};

export const goalFitLabel = (score: number): string => {
  switch (goalFitTier(score)) {
    case "excellent": return "Excellent Fit";
    case "good":      return "Good Fit";
    case "moderate":  return "Moderate Fit";
    case "weak":      return "Weak Fit";
    case "poor":      return "Poor Fit";
  }
};

// Uses existing palette tokens — no new colors.
export const goalFitColor = (score: number): string => {
  switch (goalFitTier(score)) {
    case "excellent": return "hsl(var(--health-activity))";
    case "good":      return "hsl(142 65% 48%)";
    case "moderate":  return "hsl(var(--primary))";
    case "weak":      return "hsl(32 90% 52%)";
    case "poor":      return "hsl(var(--health-heart))";
  }
};
