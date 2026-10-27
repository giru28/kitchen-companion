import { describe, it, expect } from "vitest";
import { initialData } from "../store";
import { menuCatalog } from "./catalog";
import { menuProtein, suggestMenus, mentionedIngredients } from "./suggestions";
import { recipeSchema } from "./validation";
import { scaleIngredients } from "./recipes";

describe("アプリ内の献立提案", () => {
  it("9品の追加献立に材料・全工程・保存・再加熱があり、1〜12食に対応する", () => {
    const catalog = menuCatalog();
    expect(catalog).toHaveLength(9);
    expect(new Set(catalog.map((r) => r.id)).size).toBe(9);
    for (const recipe of catalog) {
      expect(recipeSchema.safeParse(recipe).success).toBe(true);
      expect(recipe.storageNotes.length).toBeGreaterThan(0);
      expect(recipe.reheat.length).toBeGreaterThan(0);
      for (const n of [1, 6, 12])
        expect(scaleIngredients(recipe, n).every((i) => i.quantity > 0)).toBe(
          true,
        );
      expect(
        recipe.ingredients.every((i) =>
          [...recipe.prep, ...recipe.cook].some((s) =>
            s.ingredientIds.includes(i.id),
          ),
        ),
      ).toBe(true);
    }
  });
  it("入力なしで異なる主役の3案を出し、見るだけでは保存済みレシピを増やさない", () => {
    const data = initialData(),
      before = structuredClone(data),
      result = suggestMenus(data);
    expect(result.total).toBe(12);
    expect(result.choices).toHaveLength(3);
    expect(new Set(result.choices.map((s) => menuProtein(s.recipe))).size).toBe(
      3,
    );
    expect(data).toEqual(before);
  });
  it("別候補では未提示の料理を出し、一巡しても候補が消えない", () => {
    const data = initialData();
    const first = suggestMenus(data),
      seen = first.choices.map((s) => s.recipe.id);
    const next = suggestMenus(data, "all", seen);
    expect(next.choices.every((s) => !seen.includes(s.recipe.id))).toBe(true);
    const all = [...menuCatalog(), ...data.recipes].map((r) => r.id);
    const reset = suggestMenus(data, "all", all);
    expect(reset.choices).toHaveLength(3);
    expect(reset.resetCycle).toBe(true);
    const following = suggestMenus(
      data,
      "all",
      reset.choices.map((s) => s.recipe.id),
    );
    expect(
      following.choices.every(
        (s) => !reset.choices.some((old) => old.recipe.id === s.recipe.id),
      ),
    ).toBe(true);
  });
  it("使い切りたい食材を理由つきで優先し、在庫量や価格は作らない", () => {
    const data = initialData();
    data.preferences.useUp = "キャベツと人参";
    const result = suggestMenus(data);
    expect(
      result.choices.every((s) =>
        s.reasons.some((reason) => reason.includes("キャベツ")),
      ),
    ).toBe(true);
    expect(data.runs).toHaveLength(0);
    data.preferences.useUp = "厚揚げ";
    expect(
      suggestMenus(data).choices[0].recipe.ingredients.some(
        (i) => i.name === "厚揚げ",
      ),
    ).toBe(true);
    expect(mentionedIngredients(menuCatalog()[0], "豆腐")).toHaveLength(0);
    expect(mentionedIngredients(result.choices[0].recipe, "人参")).toContain(
      "にんじん",
    );
  });
  it("明示された苦手食材と既知のアレルギー食材を含む候補を除き、安全とは認定しない", () => {
    const data = initialData();
    data.preferences.allergies = "卵";
    data.recipes[0].favorite = true;
    expect(
      suggestMenus(data).choices.some(
        (s) => s.recipe.id === data.recipes[0].id,
      ),
    ).toBe(false);
    expect(suggestMenus(data).total).toBe(11);
    data.preferences.allergies = "卵と大豆";
    data.preferences.dislikes = "鶏肉";
    const result = suggestMenus(data);
    for (const { recipe } of result.choices) {
      expect(
        mentionedIngredients(recipe, data.preferences.allergies, true),
      ).toHaveLength(0);
      expect(
        mentionedIngredients(recipe, data.preferences.dislikes),
      ).toHaveLength(0);
      expect(
        recipe.ingredients.some((i) => /しょうゆ|みそ|厚揚げ|卵/.test(i.name)),
      ).toBe(false);
    }
    expect(result.choices).toHaveLength(0);
  });
  it("保存済みの編集済みレシピやお気に入りを、カタログの内容で上書きしない", () => {
    const data = initialData(),
      edited = menuCatalog()[0];
    edited.title = "自分の鶏料理";
    edited.favorite = true;
    data.recipes.push(edited);
    const result = suggestMenus(data);
    expect(result.choices[0].recipe.title).toBe("自分の鶏料理");
    expect(result.total).toBe(12);
    expect(data.recipes.at(-1)?.title).toBe("自分の鶏料理");
  });
  it("鶏・豚・野菜中心・材料少なめの条件を守る", () => {
    const data = initialData();
    for (const mode of ["chicken", "pork", "plant"] as const) {
      const result = suggestMenus(data, mode);
      expect(result.choices.length).toBeGreaterThan(0);
      expect(result.choices.every((s) => menuProtein(s.recipe) === mode)).toBe(
        true,
      );
    }
    expect(
      suggestMenus(data, "few").choices.every(
        (s) => s.recipe.ingredients.length <= 8,
      ),
    ).toBe(true);
  });
});
