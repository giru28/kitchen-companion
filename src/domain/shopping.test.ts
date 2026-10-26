import { describe, it, expect } from "vitest";
import { initialRecipes } from "./recipes";
import { createRun, markShopping, beginPreparation } from "./cooking";
import {
  aggregateShopping,
  confirmShoppingGroup,
  itemKey,
  shoppingText,
} from "./shopping";
import { runSchema } from "./validation";
const runs = () =>
  initialRecipes()
    .slice(0, 2)
    .map((recipe) => createRun(recipe, 6));
describe("一部の食材と料理ごとの配賦", () => {
  it("家にある200gと買った300gを一度だけ割り当て、残りを正しく合算する", () => {
    const before = runs();
    const rice = aggregateShopping(before).find(
      (g) => g.name === "米（未炊飯）",
    )!;
    const atHome = confirmShoppingGroup(before, rice.key, "home", 200);
    const bought = confirmShoppingGroup(atHome, rice.key, "bought", 300);
    expect(
      aggregateShopping(bought).find((g) => g.key === rice.key),
    ).toMatchObject({ required: 1200, onHand: 200, bought: 300, missing: 700 });
    expect(bought[0].shopping.find((i) => i.name === rice.name)).toMatchObject({
      onHandQuantity: 200,
      boughtQuantity: 300,
    });
    expect(
      bought[1].shopping.find((i) => i.name === rice.name)?.onHandQuantity,
    ).toBe(0);
    expect(
      before.every((r) =>
        r.shopping.every(
          (i) => i.boughtQuantity === 0 && i.onHandQuantity === 0,
        ),
      ),
    ).toBe(true);
    for (const r of bought) expect(runSchema.safeParse(r).success).toBe(true);
  });
  it("必要量を超えず複数料理へ順に配賦し、調理済みの確認量を戻さない", () => {
    let before = runs();
    const key = itemKey(
      before[0].shopping.find((i) => i.ingredientId === "rice")!,
    );
    const next = confirmShoppingGroup(before, key, "bought", 900);
    expect(
      next.map(
        (r) =>
          r.shopping.find((i) => i.ingredientId === "rice")!.boughtQuantity,
      ),
    ).toEqual([600, 300]);
    for (const item of next[0].shopping)
      next[0] = markShopping(next[0], item.ingredientId, "home");
    next[0] = beginPreparation(next[0]);
    const reset = confirmShoppingGroup(next, key, "missing");
    expect(reset[0].shopping).toEqual(next[0].shopping);
    expect(
      reset[1].shopping.find((i) => i.ingredientId === "rice")?.boughtQuantity,
    ).toBe(0);
  });
  it("不正な量を保存前に拒否し、単位の異なる同名材料をまとめない", () => {
    const before = runs();
    const key = itemKey(before[0].shopping[0]);
    for (const amount of [0, -1, NaN, Infinity, 1201])
      expect(() => confirmShoppingGroup(before, key, "home", amount)).toThrow(
        "数量",
      );
    const changed = structuredClone(before);
    changed[1].shopping[0].unit = "合";
    expect(
      aggregateShopping(changed).filter(
        (g) => g.name === before[0].shopping[0].name,
      ),
    ).toHaveLength(2);
  });
  it("コピーするメモには不足分だけを出し、肉・魚の買物順と保冷を伝える", () => {
    const before = runs();
    const rice = aggregateShopping(before).find(
      (g) => g.name === "米（未炊飯）",
    )!;
    const text = shoppingText(
      confirmShoppingGroup(before, rice.key, "home", 200),
    );
    expect(text).toContain("米（未炊飯） 1,000 g");
    expect(text.indexOf("米・麺")).toBeLessThan(text.indexOf("肉・魚"));
    expect(text).toContain("保冷");
    let complete = before;
    for (const group of aggregateShopping(complete))
      complete = confirmShoppingGroup(complete, group.key, "home");
    expect(shoppingText(complete)).toBe("買い足しが必要な食材はありません。");
  });
});
