const number = (value) => value === null || value === undefined || value === "" ? null : Number.isFinite(Number(value)) ? Number(value) : null;

export function calculateHealthScore(nutrition = {}, options = {}) {
  const portionGrams = number(options.portionGrams);
  const factor = portionGrams && portionGrams >= 20 && portionGrams <= 5000 ? 100 / portionGrams : 1;
  const per100 = (key) => {
    const value = number(nutrition[key]);
    return value === null ? null : Math.max(0, value * factor);
  };

  const calories = per100("calories");
  const protein = per100("protein_g");
  const sugar = per100("sugar_g");
  const fiber = per100("fiber_g");
  const saturatedFat = per100("saturated_fat_g");
  const salt = per100("salt_g");
  const isBeverage = options.isBeverage === true;

  if (isBeverage) {
    let beverageScore = 70;
    if (calories !== null) beverageScore += calories <= 1 ? 20 : calories <= 15 ? 5 : calories > 60 ? -18 : calories > 30 ? -10 : 0;
    if (sugar !== null) beverageScore += sugar <= 0.5 ? 5 : sugar > 11 ? -30 : sugar > 8 ? -22 : sugar > 5 ? -14 : 0;
    if (options.hasSweeteners) beverageScore -= 10;
    if (salt !== null && salt > 0.3) beverageScore -= 5;
    const beverageNova = number(options.novaGroup);
    beverageScore += beverageNova === 1 ? 5 : beverageNova === 4 ? -10 : 0;
    return Math.max(5, Math.min(95, Math.round(beverageScore)));
  }

  let score = 55;

  if (calories !== null) score += calories <= 80 ? 12 : calories <= 150 ? 8 : calories <= 250 ? 3 : calories > 650 ? -15 : calories > 450 ? -8 : 0;
  if (fiber !== null) score += fiber >= 3 ? 12 : fiber >= 1.5 ? 6 : 0;
  const severeNegative = (sugar !== null && sugar > 20) || (saturatedFat !== null && saturatedFat > 10) || (salt !== null && salt > 2);
  if (!severeNegative && protein !== null) score += protein >= 10 ? 6 : protein >= 5 ? 3 : 0;
  if (sugar !== null) score += sugar <= 5 ? 5 : sugar > 20 ? -15 : sugar > 10 ? -8 : 0;
  if (saturatedFat !== null) score += saturatedFat <= 1.5 ? 5 : saturatedFat > 10 ? -15 : saturatedFat > 5 ? -8 : 0;
  if (salt !== null) score += salt <= 0.3 ? 5 : salt > 2 ? -15 : salt > 1 ? -8 : 0;

  const nova = number(options.novaGroup);
  score += nova === 1 ? 8 : nova === 2 ? 4 : nova === 3 ? -4 : nova === 4 ? -15 : 0;
  const plants = number(options.fruitVegetableLegumePercent);
  score += plants !== null ? plants >= 80 ? 6 : plants >= 60 ? 3 : 0 : 0;
  score -= Math.min(10, Array.isArray(options.additives) ? options.additives.length * 2 : 0);
  return Math.max(5, Math.min(95, Math.round(score)));
}
