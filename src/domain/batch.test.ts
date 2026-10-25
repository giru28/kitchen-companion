import { describe, it, expect } from "vitest";
import { batchAgenda } from "./batch";
import { initialRecipes } from "./recipes";
import {
  createRun,
  markShopping,
  beginPreparation,
  finishStep,
} from "./cooking";
function ready(index: number) {
  let r = createRun(initialRecipes()[index], 6);
  for (const i of r.shopping) r = markShopping(r, i.ingredientId, "home");
  return beginPreparation(r);
}
describe("複数料理の安全な次の一手", () => {
  it("炊飯を先に案内し、どの料理も前工程を飛ばさない", () => {
    const a = ready(0),
      b = finishStep(ready(1), initialRecipes()[1].prep[0].id);
    const actions = batchAgenda([a, b]);
    expect(actions[0].step.title).toContain("ご飯を炊");
    expect(actions.find((x) => x.runId === a.id)?.step.id).toBe(
      a.recipe.prep[0].id,
    );
    expect(a.completed).toEqual([]);
  });
  it("未調達の料理や完了済みの工程を作業候補へ混ぜない", () => {
    const a = ready(0);
    const done = finishStep(a, a.recipe.prep[0].id);
    const actions = batchAgenda([done, createRun(initialRecipes()[1], 6)]);
    expect(actions).toHaveLength(1);
    expect(actions[0].step.id).not.toBe(done.completed[0]);
  });
});
