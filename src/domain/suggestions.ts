import type { KitchenData, Recipe } from "../types";
import { menuCatalog } from "./catalog";
export type MenuMode = "all" | "chicken" | "pork" | "plant" | "few";
export interface MenuSuggestion {
  recipe: Recipe;
  reasons: string[];
}
const normalize = (value: string) =>
  value.normalize("NFKC").toLocaleLowerCase("ja-JP");
const foods = [
  { words: ["鶏", "とり肉", "チキン"], pattern: /鶏|とり肉|チキン/ },
  { words: ["豚", "ポーク"], pattern: /豚|ポーク/ },
  { words: ["牛肉", "ビーフ"], pattern: /牛肉|牛ひき|牛こま|ビーフ/ },
  {
    words: ["魚", "ツナ", "さば", "サバ", "鮭", "さけ"],
    pattern: /ツナ|魚|さば|サバ|鮭|さけ|かつお/,
  },
  { words: ["卵", "たまご", "玉子"], pattern: /卵|たまご|玉子|マヨネーズ/ },
  {
    words: ["大豆"],
    pattern: /大豆|ミックスビーンズ/,
  },
  { words: ["豆腐", "厚揚げ"], pattern: /豆腐|厚揚げ/ },
  { words: ["豆乳"], pattern: /豆乳/ },
  { words: ["小麦"], pattern: /小麦/ },
  {
    words: ["乳", "牛乳", "チーズ", "バター"],
    pattern: /牛乳|乳製品|チーズ|バター|ヨーグルト/,
  },
  { words: ["えび", "エビ"], pattern: /えび|エビ/ },
  { words: ["かに", "カニ"], pattern: /かに|カニ/ },
  { words: ["ごま", "ゴマ"], pattern: /ごま|ゴマ/ },
  { words: ["落花生", "ピーナッツ"], pattern: /落花生|ピーナッツ/ },
  { words: ["にんじん", "人参"], pattern: /にんじん|人参/ },
  { words: ["キャベツ"], pattern: /キャベツ/ },
  {
    words: ["きのこ", "しめじ", "しいたけ"],
    pattern: /きのこ|しめじ|しいたけ|えのき/,
  },
  { words: ["玉ねぎ", "たまねぎ"], pattern: /玉ねぎ|たまねぎ/ },
  { words: ["大根", "だいこん"], pattern: /大根|だいこん/ },
];
const allergenGroups = [
  {
    words: ["大豆", "豆腐", "厚揚げ", "豆乳"],
    pattern: /大豆|豆腐|厚揚げ|豆乳|しょうゆ|醤油|みそ|味噌|ミックスビーンズ/,
  },
  { words: ["小麦"], pattern: /小麦|しょうゆ|醤油|うどん|パン粉|カレールー/ },
];
export function menuProtein(recipe: Recipe): string {
  const names = recipe.ingredients.map((i) => i.name).join(" ");
  if (/鶏|チキン/.test(names)) return "chicken";
  if (/豚|ポーク/.test(names)) return "pork";
  if (/ツナ|魚|さば|サバ|鮭|さけ/.test(names)) return "fish";
  if (recipe.ingredients.some((i) => i.category === "meat")) return "meat";
  if (recipe.ingredients.some((i) => i.category === "egg")) return "egg";
  return "plant";
}
/** Free-form preferences are matched conservatively; this never certifies allergen safety. */
export function mentionedIngredients(
  recipe: Recipe,
  request: string,
  expandAllergens = false,
): string[] {
  const query = normalize(request),
    names = recipe.ingredients.map((i) => normalize(i.name)).join(" ");
  const matches = new Set<string>();
  for (const food of [...foods, ...(expandAllergens ? allergenGroups : [])])
    if (
      food.words.some((word) => query.includes(normalize(word))) &&
      food.pattern.test(names)
    )
      matches.add(
        recipe.ingredients.find((item) =>
          food.pattern.test(normalize(item.name)),
        )?.name ?? food.words[0],
      );
  for (const item of recipe.ingredients)
    if (item.name.length >= 2 && query.includes(normalize(item.name)))
      matches.add(item.name);
  return [...matches];
}
export function suggestMenus(
  data: KitchenData,
  mode: MenuMode = "all",
  seen: string[] = [],
): { choices: MenuSuggestion[]; total: number; resetCycle: boolean } {
  const pool = new Map(menuCatalog().map((recipe) => [recipe.id, recipe]));
  for (const recipe of data.recipes) pool.set(recipe.id, recipe);
  const ranked = [...pool.values()]
    .filter((recipe) => {
      if (
        mentionedIngredients(recipe, data.preferences.allergies, true).length ||
        mentionedIngredients(recipe, data.preferences.dislikes).length
      )
        return false;
      if (mode === "few") return recipe.ingredients.length <= 8;
      return mode === "all" || menuProtein(recipe) === mode;
    })
    .map((recipe, index) => {
      const matches = mentionedIngredients(recipe, data.preferences.useUp);
      const recent = data.runs
        .slice(-3)
        .some((run) => run.recipeId === recipe.id);
      const ratings = data.ratings.filter((r) => r.recipeId === recipe.id);
      const rating = ratings.length
        ? ratings.reduce((sum, r) => sum + r.stars, 0) / ratings.length
        : 0;
      const reasons = matches.length
        ? [`${matches.slice(0, 2).join("・")}を使う`]
        : [];
      if (recipe.favorite) reasons.push("お気に入り");
      if (rating >= 4) reasons.push("以前の評価が高い");
      if (recipe.ingredients.length <= 8) reasons.push("材料が少なめ");
      if (!reasons.length)
        reasons.push(
          menuProtein(recipe) === "plant"
            ? "野菜・豆を使う献立"
            : "ご飯とおかずをまとめ作り",
        );
      return {
        recipe,
        reasons,
        score:
          matches.length * 5 +
          (recipe.favorite ? 12 : 0) +
          rating -
          (recent ? 3 : 0),
        index,
      };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index);
  let available = ranked.filter((item) => !seen.includes(item.recipe.id));
  const resetCycle = !available.length && ranked.length > 0;
  if (resetCycle) available = [...ranked];
  const choices: MenuSuggestion[] = [];
  while (available.length && choices.length < 3) {
    let at =
      mode === "all"
        ? available.findIndex(
            (item) =>
              !choices.some(
                (chosen) =>
                  menuProtein(chosen.recipe) === menuProtein(item.recipe),
              ),
          )
        : 0;
    if (at < 0) at = 0;
    const [chosen] = available.splice(at, 1);
    choices.push({ recipe: chosen.recipe, reasons: chosen.reasons });
  }
  return { choices, total: ranked.length, resetCycle };
}
