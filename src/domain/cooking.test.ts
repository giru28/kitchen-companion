import { describe, it, expect } from "vitest";
import { initialRecipes } from "./recipes";
import {
  createRun,
  markShopping,
  resizeRun,
  beginPreparation,
  finishStep,
  applyRecipeRevision,
  recordStorage,
  consumeLot,
  correctStorage,
  correctionInput,
  startTimer,
  pauseTimer,
  timerRemaining,
} from "./cooking";
import { kitchenSchema, runSchema } from "./validation";
import type { CookingRun } from "../types";
const recipe = () => initialRecipes()[0];
function ready() {
  let run = createRun(recipe(), 6);
  for (const i of run.shopping)
    run = markShopping(run, i.ingredientId, "bought");
  return beginPreparation(run);
}
function cooked() {
  let run = ready();
  for (const s of [...run.recipe.prep, ...run.recipe.cook])
    run = finishStep(run, s.id);
  return run;
}
const storage = {
  actualProduced: 6,
  ateToday: 2,
  fridge: 0,
  freezer: 4,
  fridgeContainers: 1,
  freezerContainers: 2,
  plannedEatOn: null,
  conditionNote: "1食ずつ収納",
};
function stored() {
  return recordStorage(cooked(), storage, ["heated", "cooled", "stored"]);
}
const reheat = (run: CookingRun) => [
  "condition",
  ...run.recipe.reheat.map((s) => s.id),
];
describe("買物と調理の事実を保持する", () => {
  it("2人3回の6食を開始し、購入前には調理へ進めない", () => {
    const r = createRun(recipe(), 6);
    expect(r.servings).toBe(6);
    expect(() => beginPreparation(r)).toThrow("足りない");
  });
  it("1〜12食を再計算し購入済量を失わず追加不足を出す", () => {
    let r = createRun(recipe(), 2);
    r = markShopping(r, "rice", "bought");
    const old = r.shopping.find((s) => s.ingredientId === "rice")!;
    const next = resizeRun(r, 12);
    expect(next.shopping.find((s) => s.ingredientId === "rice")).toMatchObject({
      quantity: 1200,
      boughtQuantity: old.boughtQuantity,
    });
    expect(r.servings).toBe(2);
    expect(() => resizeRun(r, 13)).toThrow();
  });
  it("次の工程だけを完了し、戻って閲覧しても完了数を二重に増やさない", () => {
    const r = ready();
    expect(() => finishStep(r, r.recipe.cook[0].id)).toThrow("順番");
    const next = finishStep(r, r.recipe.prep[0].id);
    expect(finishStep(next, r.recipe.prep[0].id).completed).toEqual(
      next.completed,
    );
    expect(r.completed).toHaveLength(0);
  });
  it("完了済みの文章/工程区分/材料使用済量はAIでも書き換えられない", () => {
    const r = finishStep(ready(), recipe().prep[0].id);
    const changed = structuredClone(r.recipe);
    changed.prep[0].instructions = ["変更"];
    expect(() => applyRecipeRevision(r, changed)).toThrow("完了済み");
    const moved = structuredClone(r.recipe);
    moved.cook.unshift(moved.prep.shift()!);
    expect(() => applyRecipeRevision(r, moved)).toThrow();
  });
  it("未購入の材料変更は反映し、外れた購入済み材料も退避して消さない", () => {
    const r = ready();
    const changed = structuredClone(r.recipe);
    const old = changed.ingredients.find((i) => i.id === "chicken")!;
    old.name = "豚こま肉";
    changed.cook[0].title = "変更後の未完了手順";
    const next = applyRecipeRevision(r, changed);
    expect(
      next.retiredShopping.some(
        (i) => i.name === "鶏ひき肉" && i.boughtQuantity === 600,
      ),
    ).toBe(true);
    expect(
      next.shopping.find((i) => i.ingredientId === "chicken")?.boughtQuantity,
    ).toBe(0);
    expect(next.stage).toBe("shopping");
    expect(r.recipe.ingredients.find((i) => i.id === "chicken")?.name).toBe(
      "鶏ひき肉",
    );
  });
  it("完了工程を飛び飛びにしたバックアップを拒否する", () => {
    const r = ready();
    r.completed = [r.recipe.prep[1].id];
    expect(runSchema.safeParse(r).success).toBe(false);
  });
});
describe("実際の完成量と冷蔵・冷凍・消費", () => {
  it("予定6食でも実際5食、当日2/冷蔵1/冷凍2を区別できる", () => {
    const r = recordStorage(
      cooked(),
      { ...storage, actualProduced: 5, fridge: 1, freezer: 2 },
      ["heated", "cooled", "stored"],
    );
    expect(r.servings).toBe(6);
    expect(r.actualProduced).toBe(5);
    expect(r.lots.map((l) => l.remaining)).toEqual([1, 2]);
    expect(runSchema.safeParse(r).success).toBe(true);
  });
  it("冷却未確認/完成量超過/工程未完了は保存できない", () => {
    expect(() => recordStorage(cooked(), storage, ["heated"])).toThrow("確認");
    expect(() =>
      recordStorage(cooked(), { ...storage, freezer: 5 }, [
        "heated",
        "cooled",
        "stored",
      ]),
    ).toThrow("合計");
    expect(() =>
      recordStorage(ready(), storage, ["heated", "cooled", "stored"]),
    ).toThrow("調理完了後");
  });
  it("全部当日食べた場合、していない冷蔵収納の確認を要求しない", () => {
    const r = recordStorage(cooked(), { ...storage, ateToday: 6, freezer: 0 }, [
      "heated",
    ]);
    expect(r.stage).toBe("done");
    expect(r.lots).toHaveLength(0);
    expect(runSchema.safeParse(r).success).toBe(true);
  });
  it("6食→当日2食・冷凍4食→後日2食ずつで食べ切る", () => {
    const r = stored();
    const a = consumeLot(r, r.lots[0].id, 2, reheat(r));
    expect(a.lots[0].remaining).toBe(2);
    const b = consumeLot(a, a.lots[0].id, 2, reheat(a));
    expect(b.stage).toBe("done");
    expect(() => consumeLot(b, b.lots[0].id, 1, reheat(b))).toThrow(
      "保存している",
    );
    expect(runSchema.safeParse(b).success).toBe(true);
  });
  it("再加熱の未確認と残食数超過・小数消費を拒否する", () => {
    const r = stored();
    expect(() => consumeLot(r, r.lots[0].id, 1)).toThrow("毎回");
    expect(() => consumeLot(r, r.lots[0].id, 5, reheat(r))).toThrow();
    expect(() => consumeLot(r, r.lots[0].id, 0.5, reheat(r))).toThrow();
  });
  it("記録修正は既消費2食を消さず、修正理由と実際の完成量を照合する", () => {
    let r = stored();
    r = consumeLot(r, r.lots[0].id, 2, reheat(r));
    const input = correctionInput(r);
    expect(() => correctStorage(r, input, "")).toThrow("理由");
    expect(() =>
      correctStorage(r, { ...input, freezer: 4 }, "残数を修正"),
    ).toThrow("合計");
    const next = correctStorage(
      r,
      { ...input, actualProduced: 7, freezer: 3 },
      "実際の完成食数を訂正",
    );
    expect(next.lots[0]).toMatchObject({ initial: 5, remaining: 3 });
    expect(next.corrections).toHaveLength(1);
    expect(runSchema.safeParse(next).success).toBe(true);
  });
  it("調理済みの記録をAIの修正で巻き戻さない", () => {
    expect(() => applyRecipeRevision(stored(), recipe())).toThrow("調理済み");
  });
  it("保存日時の訂正を保持し、当日全部食べた誤記からの修正にも確認を要求する", () => {
    const fresh = recordStorage(
      cooked(),
      { ...storage, ateToday: 6, freezer: 0 },
      ["heated"],
    );
    expect(() => correctStorage(fresh, storage, "保存分があった")).toThrow(
      "確認",
    );
    const fixed = correctStorage(
      fresh,
      { ...storage, freezerStoredAt: "2026-10-20T12:30:00.000Z" },
      "保存分を訂正",
      ["heated", "cooled", "stored"],
    );
    expect(fixed.lots[0].storedAt).toBe("2026-10-20T12:30:00.000Z");
    expect(fixed.corrections).toHaveLength(1);
    expect(runSchema.safeParse(fixed).success).toBe(true);
  });
});
describe("終了時刻によるタイマー復元", () => {
  it("経過後の再読込でも現在時刻で残りを求め、一時停止は残秒を保つ", () => {
    const r = startTimer(ready(), 180, 1000);
    expect(timerRemaining(r.timer, 61000)).toBe(120);
    const paused = pauseTimer(r, 61000);
    expect(timerRemaining(paused.timer, 999999)).toBe(120);
    expect(timerRemaining(r.timer, 181001)).toBe(0);
    expect(() => startTimer(r, 0)).toThrow();
  });
});
