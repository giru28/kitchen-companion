export type Category =
  | "meat"
  | "vegetable"
  | "egg"
  | "grain"
  | "seasoning"
  | "other";
export interface Ingredient {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: Category;
  note: string;
}
export interface Step {
  id: string;
  order: number;
  title: string;
  instructions: string[];
  heat: string;
  minutes: number | null;
  equipment: string[];
  ingredientIds: string[];
}
export interface Recipe {
  id: string;
  revision: number;
  title: string;
  description: string;
  baseServings: number;
  ingredients: Ingredient[];
  prep: Step[];
  cook: Step[];
  storageNotes: string[];
  reheat: Step[];
  equipment: string[];
  favorite: boolean;
  source: "sample" | "ai" | "manual";
  updatedAt: string;
}
export interface Preferences {
  people: number;
  servings: number;
  tastes: string;
  dislikes: string;
  allergies: string;
  equipment: string[];
  minutes: number;
  priorities: string;
  useUp: string;
  theme: "system" | "light" | "dark";
}
export interface ShoppingItem {
  ingredientId: string;
  name: string;
  quantity: number;
  unit: string;
  category: Category;
  onHandQuantity: number;
  boughtQuantity: number;
}
export interface Timer {
  endAt: number | null;
  remainingSeconds: number;
  durationSeconds: number;
}
export interface StorageLot {
  id: string;
  method: "fridge" | "freezer";
  initial: number;
  remaining: number;
  storedAt: string;
  containers: number;
  plannedEatOn: string | null;
  conditionNote: string;
}
export interface CookingRun {
  id: string;
  recipeId: string;
  recipe: Recipe;
  servings: number;
  stage: "shopping" | "prep" | "cook" | "store" | "leftovers" | "done";
  shopping: ShoppingItem[];
  retiredShopping: ShoppingItem[];
  completed: string[];
  activeStepId: string | null;
  notes: Record<string, string>;
  usedIngredientIds: string[];
  timer: Timer | null;
  actualProduced: number | null;
  ateToday: number;
  lots: StorageLot[];
  safetyChecks: string[];
  createdAt: string;
  updatedAt: string;
  corrections: string[];
}
export interface Rating {
  id: string;
  recipeId: string;
  runId: string | null;
  stars: number;
  note: string;
  at: string;
}
export interface KitchenData {
  version: 1;
  preferences: Preferences;
  recipes: Recipe[];
  runs: CookingRun[];
  ratings: Rating[];
  wish: string;
}
export interface AppProps {
  data: KitchenData;
  change: (mutate: (draft: KitchenData) => void) => Promise<boolean>;
  openAI: (question?: string, runId?: string) => void;
  startRecipe: (
    recipeId: string,
    servings?: number,
    suggestion?: Recipe,
  ) => Promise<void>;
  openRun: (id: string) => void;
}
export const id = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export const today = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(
    new Date(),
  );
