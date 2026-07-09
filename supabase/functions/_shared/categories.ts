// Category classifier — keyword-based with priority order.
export type FoodCategory =
  | "bread" | "breakfast_cereal" | "yogurt" | "milk" | "cheese" | "butter" | "plant_milk"
  | "protein_product" | "snack" | "chocolate" | "candy" | "sauce" | "ketchup" | "mayonnaise"
  | "ready_meal" | "frozen_meal" | "pizza" | "pasta" | "rice" | "oats"
  | "fruit" | "vegetable" | "legume" | "nuts" | "seeds"
  | "beverage" | "juice" | "soft_drink" | "energy_drink" | "other";

const RULES: { cat: FoodCategory; kw: string[] }[] = [
  { cat: "energy_drink", kw: ["energy drink", "redbull", "red bull", "monster energy"] },
  { cat: "soft_drink", kw: ["cola", "coke", "pepsi", "soda", "sprite", "fanta", "soft drink", "lemonade"] },
  { cat: "juice", kw: ["juice", "сок", "smoothie"] },
  { cat: "plant_milk", kw: ["oat milk", "almond milk", "soy milk", "plant milk", "coconut milk drink", "rice milk"] },
  { cat: "milk", kw: ["milk", "молоко"] },
  { cat: "yogurt", kw: ["yogurt", "yoghurt", "skyr", "kefir", "йогурт"] },
  { cat: "butter", kw: ["butter", "масло сливочное"] },
  { cat: "cheese", kw: ["cheese", "cheddar", "mozzarella", "feta", "parmesan", "сыр"] },
  { cat: "ketchup", kw: ["ketchup", "кетчуп"] },
  { cat: "mayonnaise", kw: ["mayo", "mayonnaise", "майонез"] },
  { cat: "sauce", kw: ["sauce", "dressing", "соус"] },
  { cat: "chocolate", kw: ["chocolate", "cocoa bar", "шоколад"] },
  { cat: "candy", kw: ["candy", "gummy", "jelly bean", "lollipop", "конфеты", "мармелад"] },
  { cat: "pizza", kw: ["pizza", "пицца"] },
  { cat: "pasta", kw: ["pasta", "spaghetti", "noodle", "макароны"] },
  { cat: "rice", kw: ["rice", "рис"] },
  { cat: "oats", kw: ["oats", "oatmeal", "porridge", "овсян", "rolled oats"] },
  { cat: "breakfast_cereal", kw: ["cereal", "muesli", "granola", "cornflakes", "хлопья"] },
  { cat: "bread", kw: ["bread", "loaf", "rye", "sourdough", "хлеб", "багет", "baguette", "toast"] },
  { cat: "frozen_meal", kw: ["frozen meal", "frozen dinner"] },
  { cat: "ready_meal", kw: ["ready meal", "ready to eat", "microwave meal"] },
  { cat: "protein_product", kw: ["protein bar", "protein shake", "whey", "protein powder"] },
  { cat: "nuts", kw: ["almond", "cashew", "walnut", "peanut", "hazelnut", "pistachio", "орехи"] },
  { cat: "seeds", kw: ["chia", "flax", "sunflower seed", "pumpkin seed", "семена"] },
  { cat: "legume", kw: ["lentil", "chickpea", "bean", "hummus", "фасоль", "нут", "чечевиц"] },
  { cat: "fruit", kw: ["apple", "banana", "berry", "fruit", "фрукт", "яблоко"] },
  { cat: "vegetable", kw: ["vegetable", "spinach", "broccoli", "carrot", "овощ"] },
  { cat: "snack", kw: ["chips", "crisps", "snack", "cracker", "popcorn", "снэк", "чипсы"] },
  { cat: "beverage", kw: ["water", "tea", "coffee", "напиток"] },
];

export function classifyCategory(name: string, ingredients: string[] = []): FoodCategory {
  const hay = (name + " " + ingredients.join(" ")).toLowerCase();
  for (const r of RULES) {
    if (r.kw.some((k) => hay.includes(k))) return r.cat;
  }
  return "other";
}
