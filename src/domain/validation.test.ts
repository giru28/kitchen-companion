import { describe, it, expect } from "vitest";
import { kitchenSchema, recipeSchema, runSchema } from "./validation";
import { initialRecipes } from "./recipes";
import {
  createRun,
  markShopping,
  beginPreparation,
  finishStep,
  recordStorage,
  consumeLot,
  SAFETY_CHECKS,
  correctStorage,
  correctionInput,
} from "./cooking";
function cooked() {
  let run = createRun(initialRecipes()[0], 6);
  for (const item of run.shopping)
    run = markShopping(run, item.ingredientId, "home");
  run = beginPreparation(run);
  for (const step of [...run.recipe.prep, ...run.recipe.cook])
    run = finishStep(run, step.id);
  return run;
}
function stored() {
  return recordStorage(
    cooked(),
    {
      actualProduced: 6,
      ateToday: 2,
      fridge: 0,
      freezer: 4,
      fridgeContainers: 1,
      freezerContainers: 2,
      plannedEatOn: null,
      conditionNote: "本人確認",
    },
    [...SAFETY_CHECKS],
  );
}
describe("破損データと保存数の整合", () => {
  it("本物のドメイン処理の途中状態と保存・消費・補正を読み取れる", () => {
    const run = cooked();
    expect(runSchema.safeParse(run).success).toBe(true);
    const after = stored();
    expect(runSchema.safeParse(after).success).toBe(true);
    const consumed = consumeLot(after, after.lots[0].id, 2, [
      "condition",
      ...after.recipe.reheat.map((s) => s.id),
    ]);
    expect(runSchema.safeParse(consumed).success).toBe(true);
    expect(
      runSchema.safeParse(
        correctStorage(consumed, correctionInput(consumed), "入力を確認"),
      ).success,
    ).toBe(true);
  });
  it("予定6食でも実際の完成5食として、当日1・冷凍4を記録できる", () => {
    const run = recordStorage(
      cooked(),
      {
        actualProduced: 5,
        ateToday: 1,
        fridge: 0,
        freezer: 4,
        fridgeContainers: 1,
        freezerContainers: 2,
        plannedEatOn: null,
        conditionNote: "",
      },
      [...SAFETY_CHECKS],
    );
    expect(runSchema.safeParse(run).success).toBe(true);
  });
  it("保存量・残食数・安全確認の矛盾を拒否する", () => {
    const run = stored();
    for (const mutate of [
      (r: typeof run) => {
        r.actualProduced = 5;
      },
      (r: typeof run) => {
        r.lots[0].remaining = 9;
      },
      (r: typeof run) => {
        r.safetyChecks = [];
      },
      (r: typeof run) => {
        r.stage = "done";
      },
    ]) {
      const bad = structuredClone(run);
      mutate(bad);
      expect(runSchema.safeParse(bad).success).toBe(false);
    }
  });
  it("工程・材料ID、材料量、重複保存方法の破損を拒否する", () => {
    const run = stored();
    const a = structuredClone(run);
    a.completed.push("unknown");
    expect(runSchema.safeParse(a).success).toBe(false);
    const b = structuredClone(run);
    b.shopping = [];
    expect(runSchema.safeParse(b).success).toBe(false);
    const c = structuredClone(run);
    c.shopping[0].quantity += 1;
    expect(runSchema.safeParse(c).success).toBe(false);
    const e = structuredClone(run);
    e.lots.push({ ...e.lots[0], id: "another", initial: 1, remaining: 1 });
    e.actualProduced = 7;
    expect(runSchema.safeParse(e).success).toBe(false);
  });
  it("実在しない日付、工程番号と材料参照の矛盾を拒否する", () => {
    const recipe = initialRecipes()[0];
    recipe.cook[0].order = 8;
    expect(recipeSchema.safeParse(recipe).success).toBe(false);
    const run = stored();
    run.lots[0].plannedEatOn = "2026-02-30";
    expect(runSchema.safeParse(run).success).toBe(false);
  });
  it("将来バージョンを勝手に読み直して初期化しない", () => {
    expect(kitchenSchema.safeParse({ version: 2 }).success).toBe(false);
  });
});
