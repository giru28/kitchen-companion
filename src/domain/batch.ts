import type { CookingRun, Step } from "../types";
export interface BatchAction {
  runId: string;
  recipeTitle: string;
  step: Step;
}
// Each recipe's completed prefix is preserved. Only the next eligible action of
// each run is compared; no elapsed-time or AI text marks an action completed.
export function batchAgenda(runs: CookingRun[]): BatchAction[] {
  const eligible = runs
    .filter((r) => ["prep", "cook"].includes(r.stage))
    .map((r) => {
      const step = [...r.recipe.prep, ...r.recipe.cook].find(
        (s) => !r.completed.includes(s.id),
      );
      return step ? { run: r, step } : null;
    })
    .filter((r): r is { run: CookingRun; step: Step } => r !== null);
  const priority = ({ run, step }: { run: CookingRun; step: Step }) => {
    if (run.stage === "cook") return 3;
    if (/炊飯|ご飯を炊/.test(step.title)) return 0;
    return step.ingredientIds.some(
      (id) =>
        run.recipe.ingredients.find((i) => i.id === id)?.category === "meat",
    )
      ? 2
      : 1;
  };
  return eligible
    .sort(
      (a, b) =>
        priority(a) - priority(b) ||
        a.run.createdAt.localeCompare(b.run.createdAt),
    )
    .map(({ run, step }) => ({
      runId: run.id,
      recipeTitle: run.recipe.title,
      step,
    }));
}
