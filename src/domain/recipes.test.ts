import { describe, it, expect } from "vitest";
import { initialRecipes, scaleIngredients } from "./recipes";
import { recipeSchema } from "./validation";
describe("編集可能なサンプル献立と分量", () => {
  it("3献立に材料・調味料・下準備・調理・再加熱があり形式が通る", () => {
    const recipes = initialRecipes();
    expect(recipes).toHaveLength(3);
    for (const recipe of recipes) {
      expect(recipeSchema.safeParse(recipe).success).toBe(true);
      expect(recipe.ingredients.some((i) => i.category === "seasoning")).toBe(
        true,
      );
      expect(recipe.ingredients.some((i) => i.category === "grain")).toBe(true);
      expect(recipe.storageNotes.length).toBeGreaterThan(0);
    }
  });
  it("6食から2食への変更は元レシピを変えず、材料名と単位を維持する", () => {
    const recipe = initialRecipes()[0],
      before = structuredClone(recipe);
    const scaled = scaleIngredients(recipe, 2);
    expect(scaled.find((i) => i.id === "rice")).toMatchObject({
      quantity: 200,
      unit: "g",
    });
    expect(scaled.find((i) => i.id === "carrot")).toMatchObject({
      quantity: 150,
      unit: "g",
    });
    expect(scaled.find((i) => i.id === "eggs")).toMatchObject({
      quantity: 1,
      unit: "個",
    });
    expect(recipe).toEqual(before);
  });
  it("1〜12食に対応し、範囲外・不正食数を拒否する", () => {
    const recipe = initialRecipes()[0];
    for (const n of [1, 6, 12])
      expect(scaleIngredients(recipe, n).every((i) => i.quantity > 0)).toBe(
        true,
      );
    for (const n of [0, 13, 1.5, NaN])
      expect(() => scaleIngredients(recipe, n)).toThrow("1〜12");
  });
});
