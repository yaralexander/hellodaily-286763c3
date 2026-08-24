import { describe, expect, it } from "vitest";
import { calculateHealthScore } from "../../server/health-score.mjs";

describe("deterministic health score", () => {
  it("rates a one-kilogram cabbage as highly nutritious", () => {
    expect(calculateHealthScore({ calories: 250, protein_g: 13, carbs_g: 58, sugar_g: 32, fiber_g: 25, fat_g: 1, saturated_fat_g: 0.3, salt_g: 0.45 }, { portionGrams: 1000, novaGroup: 1 })).toBeGreaterThanOrEqual(90);
  });

  it("penalizes ultra-processed food high in sugar, salt, and saturated fat", () => {
    expect(calculateHealthScore({ calories: 520, protein_g: 4, sugar_g: 28, fiber_g: 1, saturated_fat_g: 12, salt_g: 2.2 }, { portionGrams: 100, novaGroup: 4, additives: ["a", "b", "c"] })).toBeLessThanOrEqual(20);
  });

  it("does not let low calorie density make sugary soda look healthy", () => {
    expect(calculateHealthScore({ calories: 42, sugar_g: 10.6, saturated_fat_g: 0, salt_g: 0 }, { portionGrams: 100, novaGroup: 4, isBeverage: true })).toBeLessThanOrEqual(30);
  });

  it("keeps incomplete nutrition near the middle instead of inventing benefits", () => {
    expect(calculateHealthScore({}, {})).toBe(55);
  });
});
