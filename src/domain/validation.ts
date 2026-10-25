import { z } from "zod";
import type { KitchenData } from "../types";
const text = z.string().max(10000);
const label = z.string().trim().min(1, "空欄にはできません").max(300);
const identifier = z
  .string()
  .min(1)
  .max(150)
  .refine(
    (value) =>
      !["__proto__", "prototype", "constructor"].includes(value) &&
      !/[\u0000-\u001f]/.test(value),
    "IDに予約語や制御文字は使用できません",
  );
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "日付はYYYY-MM-DDです")
  .refine((s) => {
    const d = new Date(s + "T12:00:00Z");
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "実在しない日付です");
const iso = z.string().datetime({ offset: true });
const qty = z
  .number()
  .finite()
  .positive("数量は0より大きくしてください")
  .max(1e6);
const array = <T extends z.ZodType>(shape: T) => z.array(shape).max(2000);
const category = z.enum([
  "meat",
  "vegetable",
  "egg",
  "grain",
  "seasoning",
  "other",
]);
export const ingredientSchema = z.object({
  id: identifier,
  name: label,
  quantity: qty,
  unit: z.string().min(1).max(30),
  category,
  note: text,
});
export const stepSchema = z.object({
  id: identifier,
  order: z.number().int().min(1).max(200),
  title: label,
  instructions: z.array(label).min(1).max(30),
  heat: z.string().min(1).max(300),
  minutes: z.number().finite().min(0).max(1440).nullable(),
  equipment: z.array(label).max(30),
  ingredientIds: z.array(identifier).max(100),
});
export const recipePayloadSchema = z.object({
  title: label,
  description: text,
  baseServings: z.number().int().min(1).max(12),
  ingredients: z.array(ingredientSchema).min(1).max(100),
  prep: z.array(stepSchema).min(1).max(100),
  cook: z.array(stepSchema).min(1).max(100),
  storageNotes: z.array(label).min(1).max(30),
  reheat: z.array(stepSchema).min(1).max(100),
  equipment: z.array(label).max(30),
});
export function checkRecipe(
  value: z.infer<typeof recipePayloadSchema>,
  ctx: z.RefinementCtx,
) {
  const add = (message: string, path: (string | number)[]) =>
    ctx.addIssue({ code: "custom", message, path });
  const ids = value.ingredients.map((i) => i.id);
  if (new Set(ids).size !== ids.length)
    add("材料IDが重複しています", ["ingredients"]);
  const steps = [...value.prep, ...value.cook, ...value.reheat];
  if (new Set(steps.map((s) => s.id)).size !== steps.length)
    add("工程IDは下準備・調理・再加熱全体で一意にしてください", ["cook"]);
  for (const section of ["prep", "cook", "reheat"] as const)
    value[section].forEach((step, index) => {
      if (step.order !== index + 1)
        add("工程番号は1から順番に連続させてください", [
          section,
          index,
          "order",
        ]);
      if (new Set(step.ingredientIds).size !== step.ingredientIds.length)
        add("工程内の材料参照が重複しています", [
          section,
          index,
          "ingredientIds",
        ]);
      if (step.ingredientIds.some((id) => !ids.includes(id)))
        add("工程が存在しない材料IDを参照しています", [
          section,
          index,
          "ingredientIds",
        ]);
    });
}
export const recipeSchema = recipePayloadSchema
  .extend({
    id: identifier,
    revision: z.number().int().min(1),
    favorite: z.boolean(),
    source: z.enum(["sample", "ai", "manual"]),
    updatedAt: iso,
  })
  .superRefine(checkRecipe);
const shoppingSchema = z.object({
  ingredientId: identifier,
  name: label,
  quantity: qty,
  unit: z.string().min(1).max(30),
  category,
  onHandQuantity: z.number().finite().min(0).max(1e6),
  boughtQuantity: z.number().finite().min(0).max(1e6),
});
const timerSchema = z.object({
  endAt: z.number().finite().min(0).nullable(),
  remainingSeconds: z
    .number()
    .finite()
    .min(0)
    .max(7 * 86400),
  durationSeconds: z
    .number()
    .finite()
    .min(1)
    .max(7 * 86400),
});
const lotSchema = z
  .object({
    id: identifier,
    method: z.enum(["fridge", "freezer"]),
    initial: z.number().int().min(1).max(48),
    remaining: z.number().int().min(0).max(48),
    storedAt: iso,
    containers: z.number().int().min(1).max(100),
    plannedEatOn: date.nullable(),
    conditionNote: text,
  })
  .superRefine((v, c) => {
    if (v.remaining > v.initial)
      c.addIssue({
        code: "custom",
        message: "残食数は保存食数以下にしてください",
        path: ["remaining"],
      });
  });
export const runSchema = z
  .object({
    id: identifier,
    recipeId: identifier,
    recipe: recipeSchema,
    servings: z.number().int().min(1).max(12),
    stage: z.enum(["shopping", "prep", "cook", "store", "leftovers", "done"]),
    shopping: array(shoppingSchema),
    retiredShopping: array(shoppingSchema),
    completed: z.array(identifier).max(200),
    activeStepId: identifier.nullable(),
    notes: z.record(z.string().max(150), text),
    usedIngredientIds: z.array(identifier).max(100),
    timer: timerSchema.nullable(),
    actualProduced: z.number().int().min(1).max(48).nullable(),
    ateToday: z.number().int().min(0).max(48),
    lots: z.array(lotSchema).max(30),
    safetyChecks: z.array(z.string().max(100)).max(100),
    createdAt: iso,
    updatedAt: iso,
    corrections: z.array(text).max(1000),
  })
  .superRefine((v, c) => {
    const add = (message: string, path: (string | number)[] = []) =>
      c.addIssue({ code: "custom", message, path });
    const steps = [...v.recipe.prep, ...v.recipe.cook];
    const ids = steps.map((s) => s.id);
    const allIds = [...ids, ...v.recipe.reheat.map((s) => s.id)];
    if (
      v.completed.some((i) => !ids.includes(i)) ||
      new Set(v.completed).size !== v.completed.length
    )
      add("完了工程IDが不正または重複しています", ["completed"]);
    if (v.completed.some((id, index) => ids[index] !== id))
      add("完了工程は実行順の先頭から連続して記録してください", ["completed"]);
    if (v.activeStepId !== null && !allIds.includes(v.activeStepId))
      add("現在の工程が見つかりません", ["activeStepId"]);
    if (
      new Set(v.shopping.map((i) => i.ingredientId)).size !== v.shopping.length
    )
      add("買い物材料IDが重複しています", ["shopping"]);
    const expected = v.recipe.ingredients.map((i) => {
      const raw = (i.quantity * v.servings) / v.recipe.baseServings;
      return { ...i, quantity: Math.round(raw * 1000) / 1000 || raw };
    });
    if (
      v.shopping.length !== expected.length ||
      expected.some(
        (i) =>
          !v.shopping.some(
            (s) =>
              s.ingredientId === i.id &&
              s.name === i.name &&
              s.unit === i.unit &&
              Math.abs(s.quantity - i.quantity) < 1e-8,
          ),
      )
    )
      add("買い物リストを現在のレシピ・食数と一致させてください", ["shopping"]);
    if (new Set(v.lots.map((l) => l.id)).size !== v.lots.length)
      add("保存記録IDが重複しています", ["lots"]);
    if (new Set(v.lots.map((l) => l.method)).size !== v.lots.length)
      add("同じ保存方法の記録は1件にまとめ、容器数で分けてください", ["lots"]);
    if (
      new Set(v.usedIngredientIds).size !== v.usedIngredientIds.length ||
      v.usedIngredientIds.some(
        (id) => !v.recipe.ingredients.some((i) => i.id === id),
      )
    )
      add("使用した材料の参照が不正です", ["usedIngredientIds"]);
    const progress = [
      "shopping",
      "prep",
      "cook",
      "store",
      "leftovers",
      "done",
    ].indexOf(v.stage);
    if (
      progress >= 1 &&
      v.shopping.some(
        (i) => i.onHandQuantity + i.boughtQuantity + 1e-9 < i.quantity,
      )
    )
      add("不足する材料を確認してください", ["shopping"]);
    if (progress >= 2 && v.recipe.prep.some((s) => !v.completed.includes(s.id)))
      add("下準備が未完了です", ["completed"]);
    if (progress >= 3 && steps.some((s) => !v.completed.includes(s.id)))
      add("調理が未完了です", ["completed"]);
    if (
      progress < 4 &&
      (v.lots.length || v.actualProduced !== null || v.ateToday !== 0)
    )
      add("保存・実食数は調理完了後に記録してください", ["lots"]);
    if (progress >= 4) {
      if (v.actualProduced === null)
        add("実際に完成した食数を入力してください", ["actualProduced"]);
      else if (
        v.ateToday + v.lots.reduce((sum, l) => sum + l.initial, 0) !==
        v.actualProduced
      )
        add("当日分と保存分の合計を実際の完成食数に合わせてください", ["lots"]);
      if (
        !(v.lots.length ? ["heated", "cooled", "stored"] : ["heated"]).every(
          (key) => v.safetyChecks.includes(key),
        )
      )
        add("加熱・保存する場合の冷却・収納の確認が必要です", ["safetyChecks"]);
      const remaining = v.lots.reduce((sum, l) => sum + l.remaining, 0);
      if (v.stage === "done" && remaining !== 0)
        add("食べ切り済みの残食数は0です", ["lots"]);
      if (v.stage === "leftovers" && remaining <= 0)
        add("残食数0は食べ切り済みにしてください", ["stage"]);
    }
    if (Date.parse(v.updatedAt) < Date.parse(v.createdAt))
      add("更新日時は作成日時以降にしてください", ["updatedAt"]);
  });
export const preferencesSchema = z.object({
  people: z.number().int().min(1).max(12),
  servings: z.number().int().min(1).max(12),
  tastes: text,
  dislikes: text,
  allergies: text,
  equipment: z.array(label).max(50),
  minutes: z.number().int().min(1).max(1440),
  priorities: text,
  useUp: text,
  theme: z.enum(["system", "light", "dark"]),
});
export const kitchenSchema = z
  .object({
    version: z.literal(1),
    preferences: preferencesSchema,
    recipes: array(recipeSchema),
    runs: array(runSchema),
    ratings: array(
      z.object({
        id: identifier,
        recipeId: identifier,
        runId: identifier.nullable(),
        stars: z.number().int().min(1).max(5),
        note: text,
        at: iso,
      }),
    ),
    wish: text,
  })
  .superRefine((v, c) => {
    for (const key of ["recipes", "runs", "ratings"] as const)
      if (new Set(v[key].map((x) => x.id)).size !== v[key].length)
        c.addIssue({
          code: "custom",
          message: `${key}のIDが重複しています`,
          path: [key],
        });
    // Deleted library recipes and ratings remain valid when the run owns its snapshot.
  });
export function validateData(value: unknown): KitchenData {
  return kitchenSchema.parse(value);
}
export function explainValidation(error: unknown): string {
  if (error instanceof z.ZodError)
    return error.issues
      .slice(0, 8)
      .map((i) => `${i.path.join(".") || "全体"}: ${i.message}`)
      .join("\n");
  return error instanceof Error
    ? error.message
    : "データ形式を確認してください。";
}
