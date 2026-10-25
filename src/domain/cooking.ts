import type {
  CookingRun,
  Recipe,
  ShoppingItem,
  StorageLot,
  Timer,
} from "../types";
import { id, now } from "../types";
import { scaleIngredients } from "./recipes";

export const SAFETY_CHECKS = ["heated", "cooled", "stored"] as const;
export const SAFETY_LABELS = {
  heated: "料理の中心まで十分に加熱したことを確認",
  cooled: "清潔な浅い容器へ小分けし、常温放置せず速やかに冷却",
  stored: "実際に冷蔵・冷凍庫へ収納し、保存状態を確認",
};
const copy = (run: CookingRun) => structuredClone(run);
const touch = (run: CookingRun) => ({ ...run, updatedAt: now() });
export function shoppingNeeded(item: ShoppingItem) {
  return Math.max(
    0,
    Math.round(
      (item.quantity - item.onHandQuantity - item.boughtQuantity) * 1000,
    ) / 1000,
  );
}
export function createRun(recipe: Recipe, servings: number): CookingRun {
  const at = now();
  return {
    id: id(),
    recipeId: recipe.id,
    recipe: structuredClone(recipe),
    servings,
    stage: "shopping",
    shopping: scaleIngredients(recipe, servings).map((i) => ({
      ingredientId: i.id,
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      category: i.category,
      onHandQuantity: 0,
      boughtQuantity: 0,
    })),
    retiredShopping: [],
    completed: [],
    activeStepId: null,
    notes: {},
    usedIngredientIds: [],
    timer: null,
    actualProduced: null,
    ateToday: 0,
    lots: [],
    safetyChecks: [],
    createdAt: at,
    updatedAt: at,
    corrections: [],
  };
}
export function markShopping(
  run: CookingRun,
  ingredientId: string,
  status: "home" | "bought" | "missing",
) {
  if (run.stage !== "shopping")
    throw Error("材料確認中の料理だけ変更できます。");
  const next = copy(run);
  const item = next.shopping.find((i) => i.ingredientId === ingredientId);
  if (!item) throw Error("食材が見つかりません。");
  if (status === "missing") {
    item.onHandQuantity = 0;
    item.boughtQuantity = 0;
  } else if (status === "home") item.onHandQuantity += shoppingNeeded(item);
  else item.boughtQuantity += shoppingNeeded(item);
  return touch(next);
}
function mergeShopping(run: CookingRun, recipe: Recipe, servings: number) {
  const entries = scaleIngredients(recipe, servings).map((i) => {
    const old = run.shopping.find(
      (s) => s.ingredientId === i.id && s.name === i.name && s.unit === i.unit,
    );
    return {
      ingredientId: i.id,
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      category: i.category,
      onHandQuantity: old?.onHandQuantity ?? 0,
      boughtQuantity: old?.boughtQuantity ?? 0,
    };
  });
  const retired = run.shopping.filter(
    (old) =>
      !entries.some(
        (i) =>
          i.ingredientId === old.ingredientId &&
          i.name === old.name &&
          i.unit === old.unit,
      ) &&
      (old.boughtQuantity > 0 || old.onHandQuantity > 0),
  );
  return {
    shopping: entries,
    retiredShopping: [...run.retiredShopping, ...retired],
  };
}
export function resizeRun(run: CookingRun, servings: number) {
  if (run.stage !== "shopping" || run.completed.length)
    throw Error(
      "分量変更は調理開始前だけ行えます。調理中はAIへの相談を利用してください。",
    );
  const next = copy(run);
  Object.assign(next, mergeShopping(run, run.recipe, servings), { servings });
  return touch(next);
}
function chooseStage(run: CookingRun): CookingRun {
  const prep = run.recipe.prep.find((s) => !run.completed.includes(s.id));
  if (prep) return { ...run, stage: "prep", activeStepId: prep.id };
  const cook = run.recipe.cook.find((s) => !run.completed.includes(s.id));
  if (cook) return { ...run, stage: "cook", activeStepId: cook.id };
  return { ...run, stage: "store", activeStepId: null };
}
export function beginPreparation(run: CookingRun) {
  if (run.stage !== "shopping") throw Error("材料確認中ではありません。");
  if (run.shopping.some((i) => shoppingNeeded(i) > 0))
    throw Error("足りない材料をそろえ、家にある・購入したを確認してください。");
  return touch(chooseStage(copy(run)));
}
export function finishStep(run: CookingRun, stepId: string) {
  if (run.stage !== "prep" && run.stage !== "cook")
    throw Error("調理中の工程だけ完了できます。");
  if (run.completed.includes(stepId)) return copy(run);
  const nextStep = [...run.recipe.prep, ...run.recipe.cook].find(
    (s) => !run.completed.includes(s.id),
  );
  if (!nextStep || nextStep.id !== stepId)
    throw Error("前の工程から順番に進めてください。");
  const next = copy(run);
  next.completed.push(stepId);
  next.usedIngredientIds = [
    ...new Set([...next.usedIngredientIds, ...nextStep.ingredientIds]),
  ];
  return touch(chooseStage(next));
}
export function applyRecipeRevision(run: CookingRun, recipe: Recipe) {
  if (["store", "leftovers", "done"].includes(run.stage))
    throw Error(
      "調理済みの記録はAIの回答で変更できません。次回用の新しいレシピとして登録してください。",
    );
  const oldSteps = [...run.recipe.prep, ...run.recipe.cook];
  const newSteps = [...recipe.prep, ...recipe.cook];
  for (const completed of run.completed) {
    if (
      run.recipe.prep.some((s) => s.id === completed) !==
        recipe.prep.some((s) => s.id === completed) ||
      oldSteps.findIndex((s) => s.id === completed) !==
        newSteps.findIndex((s) => s.id === completed)
    )
      throw Error("完了済み工程を別の位置や工程区分へ移動できません。");
  }
  for (const completed of run.completed) {
    const before = oldSteps.find((s) => s.id === completed);
    const after = newSteps.find((s) => s.id === completed);
    if (!before || !after || JSON.stringify(before) !== JSON.stringify(after))
      throw Error(
        `完了済み工程「${before?.title ?? completed}」は変更・削除できません。`,
      );
  }
  for (const used of run.usedIngredientIds) {
    const before = run.recipe.ingredients.find((i) => i.id === used),
      after = recipe.ingredients.find((i) => i.id === used);
    if (
      !before ||
      !after ||
      before.name !== after.name ||
      before.unit !== after.unit ||
      before.quantity / run.recipe.baseServings !==
        after.quantity / recipe.baseServings
    )
      throw Error(
        `使用済みの材料「${before?.name ?? used}」の量・名前・単位は変更できません。`,
      );
  }
  const next = copy(run);
  next.recipe = {
    ...structuredClone(recipe),
    id: run.recipeId,
    revision: run.recipe.revision + 1,
  };
  Object.assign(next, mergeShopping(run, next.recipe, run.servings));
  if (next.shopping.some((i) => shoppingNeeded(i) > 0)) {
    next.stage = "shopping";
    next.activeStepId = null;
  } else Object.assign(next, chooseStage(next));
  return touch(next);
}
export interface StorageInput {
  actualProduced: number;
  ateToday: number;
  fridge: number;
  freezer: number;
  fridgeContainers: number;
  freezerContainers: number;
  plannedEatOn: string | null;
  conditionNote: string;
  fridgeStoredAt?: string;
  freezerStoredAt?: string;
}
function integer(n: number, min: number, max: number, label: string) {
  if (!Number.isInteger(n) || n < min || n > max)
    throw Error(`${label}は${min}〜${max}の整数で入力してください。`);
}
function storageChecks(checks: string[], hasStoredFood = true) {
  if (
    (hasStoredFood ? SAFETY_CHECKS : ["heated"]).some(
      (k) => !checks.includes(k),
    )
  )
    throw Error("加熱・保存する場合の小分け冷却・収納の確認を行ってください。");
}
function assertStorage(input: StorageInput, existing?: CookingRun) {
  integer(input.actualProduced, 1, 48, "実際に完成した食数");
  integer(input.ateToday, 0, 48, "当日食べた食数");
  integer(input.fridge, 0, 48, "冷蔵の残り食数");
  integer(input.freezer, 0, 48, "冷凍の残り食数");
  const consumed = (method: "fridge" | "freezer") =>
    existing?.lots
      .filter((l) => l.method === method)
      .reduce((s, l) => s + l.initial - l.remaining, 0) ?? 0;
  if (
    input.ateToday +
      input.fridge +
      input.freezer +
      consumed("fridge") +
      consumed("freezer") !==
    input.actualProduced
  )
    throw Error(
      "当日食べた分・すでに食べた保存分・現在の保存分の合計を、実際に完成した食数に合わせてください。",
    );
  if (input.fridge > 0) integer(input.fridgeContainers, 1, 48, "冷蔵容器数");
  if (input.freezer > 0) integer(input.freezerContainers, 1, 48, "冷凍容器数");
  for (const key of ["fridgeStoredAt", "freezerStoredAt"] as const) {
    if (
      input[key] &&
      (!Number.isFinite(Date.parse(input[key]!)) ||
        !/^\d{4}-\d{2}-\d{2}T/.test(input[key]!))
    )
      throw Error("保存日時を確認してください。");
  }
  if (input.plannedEatOn) {
    const d = new Date(input.plannedEatOn + "T12:00:00Z");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(input.plannedEatOn) ||
      isNaN(d.getTime()) ||
      d.toISOString().slice(0, 10) !== input.plannedEatOn
    )
      throw Error("食べる予定日を確認してください。");
  }
}
export function recordStorage(
  run: CookingRun,
  input: StorageInput,
  checks: string[],
) {
  if (run.stage !== "store")
    throw Error("調理完了後に保存を記録してください。");
  storageChecks(checks, input.fridge + input.freezer > 0);
  assertStorage(input);
  const at = now();
  const lots: StorageLot[] = [];
  for (const method of ["fridge", "freezer"] as const) {
    const qty = input[method];
    if (qty)
      lots.push({
        id: id(),
        method,
        initial: qty,
        remaining: qty,
        storedAt:
          (method === "fridge"
            ? input.fridgeStoredAt
            : input.freezerStoredAt) || at,
        containers:
          method === "fridge"
            ? input.fridgeContainers
            : input.freezerContainers,
        plannedEatOn: input.plannedEatOn,
        conditionNote: input.conditionNote,
      });
  }
  return touch({
    ...copy(run),
    actualProduced: input.actualProduced,
    ateToday: input.ateToday,
    lots,
    safetyChecks: [...checks],
    stage: lots.length ? "leftovers" : "done",
  } as CookingRun);
}
export function consumeLot(
  run: CookingRun,
  lotId: string,
  count: number,
  checks: string[] = [],
) {
  if (
    !checks.includes("condition") ||
    run.recipe.reheat.some((s) => !checks.includes(s.id))
  )
    throw Error("保存状態と再加熱を毎回確認してください。");
  if (run.stage !== "leftovers")
    throw Error("保存している料理だけ食べた記録を付けられます。");
  const next = copy(run);
  const lot = next.lots.find((l) => l.id === lotId);
  if (!lot) throw Error("保存記録がありません。");
  integer(count, 1, lot.remaining, "食べた食数");
  lot.remaining -= count;
  next.stage = next.lots.some((l) => l.remaining > 0) ? "leftovers" : "done";
  return touch(next);
}
export function correctionInput(run: CookingRun): StorageInput {
  return {
    actualProduced: run.actualProduced ?? run.servings,
    ateToday: run.ateToday,
    fridge: run.lots
      .filter((l) => l.method === "fridge")
      .reduce((s, l) => s + l.remaining, 0),
    freezer: run.lots
      .filter((l) => l.method === "freezer")
      .reduce((s, l) => s + l.remaining, 0),
    fridgeContainers:
      run.lots.find((l) => l.method === "fridge")?.containers ?? 1,
    freezerContainers:
      run.lots.find((l) => l.method === "freezer")?.containers ?? 1,
    plannedEatOn: run.lots[0]?.plannedEatOn ?? null,
    conditionNote: run.lots[0]?.conditionNote ?? "",
    fridgeStoredAt: run.lots.find((l) => l.method === "fridge")?.storedAt,
    freezerStoredAt: run.lots.find((l) => l.method === "freezer")?.storedAt,
  };
}
export function correctStorage(
  run: CookingRun,
  input: StorageInput,
  reason: string,
  checks: string[] = run.safetyChecks,
) {
  if (!["leftovers", "done"].includes(run.stage) || !run.actualProduced)
    throw Error("保存済みの記録だけ修正できます。");
  if (!reason.trim()) throw Error("修正理由を入力してください。");
  assertStorage(input, run);
  storageChecks(
    checks,
    input.fridge +
      input.freezer +
      run.lots.reduce((s, l) => s + l.initial - l.remaining, 0) >
      0,
  );
  const next = copy(run);
  next.safetyChecks = [...checks];
  next.actualProduced = input.actualProduced;
  next.ateToday = input.ateToday;
  next.lots = [];
  for (const method of ["fridge", "freezer"] as const) {
    const prior = run.lots.filter((l) => l.method === method);
    const consumed = prior.reduce((s, l) => s + l.initial - l.remaining, 0);
    const remaining = input[method];
    if (!remaining && !consumed) continue;
    next.lots.push({
      id: prior[0]?.id ?? id(),
      method,
      initial: remaining + consumed,
      remaining,
      storedAt:
        (method === "fridge" ? input.fridgeStoredAt : input.freezerStoredAt) ||
        prior[0]?.storedAt ||
        now(),
      containers:
        method === "fridge" ? input.fridgeContainers : input.freezerContainers,
      plannedEatOn: input.plannedEatOn,
      conditionNote: input.conditionNote,
    });
  }
  next.stage = next.lots.some((l) => l.remaining > 0) ? "leftovers" : "done";
  next.corrections.push(
    `${now()} ${reason.trim()} / 修正前: 完成${run.actualProduced}食・当日${run.ateToday}食・保存残${run.lots.reduce((s, l) => s + l.remaining, 0)}食`,
  );
  return touch(next);
}
export function timerRemaining(timer: Timer | null, at = Date.now()) {
  return !timer
    ? 0
    : timer.endAt === null
      ? timer.remainingSeconds
      : Math.max(0, Math.ceil((timer.endAt - at) / 1000));
}
export function startTimer(run: CookingRun, seconds: number, at = Date.now()) {
  integer(seconds, 1, 86400, "タイマー秒数");
  return touch({
    ...copy(run),
    timer: {
      endAt: at + seconds * 1000,
      remainingSeconds: seconds,
      durationSeconds: seconds,
    },
  });
}
export function pauseTimer(run: CookingRun, at = Date.now()) {
  if (!run.timer) return copy(run);
  return touch({
    ...copy(run),
    timer: {
      ...run.timer,
      endAt: null,
      remainingSeconds: timerRemaining(run.timer, at),
    },
  });
}
