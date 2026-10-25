import { describe, it, expect } from "vitest";
import { AI_JSON_EXAMPLE, buildPrompt, parseAI } from "./ai";
import { initialRecipes } from "./recipes";
import {
  createRun,
  markShopping,
  beginPreparation,
  finishStep,
} from "./cooking";
import type { KitchenData } from "../types";
function data(): KitchenData {
  return {
    version: 1,
    preferences: {
      people: 2,
      servings: 6,
      tastes: "濃い味",
      dislikes: "辛すぎる物",
      allergies: "卵を確認",
      equipment: ["フライパン"],
      minutes: 30,
      priorities: "安さ、美味しさ、手軽さ",
      useUp: "にんじん",
      theme: "system",
    },
    recipes: initialRecipes(),
    runs: [],
    ratings: [],
    wish: "冷凍できる料理",
  };
}
describe("ChatGPTの明確なJSONだけを確認用へ取り込む", () => {
  it("メモの辞書と衝突する危険な工程IDを拒否する", () => {
    const value = JSON.parse(AI_JSON_EXAMPLE);
    value.recipe.prep[0].id = "__proto__";
    expect(() => parseAI(JSON.stringify(value))).toThrow("予約語");
  });
  it("有効な例と壊れた別ブロックが混ざる場合も勝手に一つを選ばない", () => {
    expect(() =>
      parseAI(
        "```json\n" + AI_JSON_EXAMPLE + '\n```\n```json\n{"broken":\n```',
      ),
    ).toThrow("複数");
  });
  it("プロンプトと共通のJSON例をそのまま検証でき、メタはアプリが作る", () => {
    const result = parseAI(AI_JSON_EXAMPLE);
    expect(result.kind).toBe("recipe");
    expect(result.recipe.title).toContain("鶏そぼろ");
    expect(result.recipe.source).toBe("ai");
    expect(result.recipe.id).toBeTruthy();
  });
  it("説明文とJSONコードブロックを抽出する", () => {
    const result = parseAI(
      `この案ならどうでしょう。\n\n\`\`\`json\n${AI_JSON_EXAMPLE}\n\`\`\`\n材料の現物も確認してください。`,
    );
    expect(result.recipe.baseServings).toBe(6);
  });
  it("JSON外の説明と文字列内の括弧があっても抽出する", () => {
    const value = JSON.parse(AI_JSON_EXAMPLE);
    value.recipe.description = '「{熱い}」や引用符 " のある説明';
    expect(
      parseAI(`参考案です。\n${JSON.stringify(value)}\nここまでです。`).recipe
        .description,
    ).toBe(value.recipe.description);
  });
  it("壊れたJSONと複数の回答を曖昧に選ばず拒否する", () => {
    expect(() => parseAI('{"schemaVersion":1,')).toThrow(
      "JSONを読み取れません",
    );
    expect(() => parseAI(`${AI_JSON_EXAMPLE}\n${AI_JSON_EXAMPLE}`)).toThrow(
      "複数",
    );
  });
  it("バージョン、空入力、過大入力を拒否する", () => {
    const value = JSON.parse(AI_JSON_EXAMPLE);
    value.schemaVersion = 99;
    expect(() => parseAI(JSON.stringify(value))).toThrow("schemaVersion");
    expect(() => parseAI(" ")).toThrow("貼り付け");
    expect(() => parseAI("あ".repeat(170000))).toThrow("500KB");
  });
  it("負数の材料、非連続工程、存在しない材料参照を具体的なパスで拒否する", () => {
    const value = JSON.parse(AI_JSON_EXAMPLE);
    value.recipe.ingredients[0].quantity = -3;
    expect(() => parseAI(JSON.stringify(value))).toThrow(
      "ingredients.0.quantity",
    );
    value.recipe.ingredients[0].quantity = 600;
    value.recipe.cook[0].order = 3;
    expect(() => parseAI(JSON.stringify(value))).toThrow("工程番号");
    value.recipe.cook[0].order = 1;
    value.recipe.cook[0].ingredientIds = ["not-present"];
    expect(() => parseAI(JSON.stringify(value))).toThrow("材料ID");
  });
  it("手順修正には対象runが必要で、埋め込んだアプリ用メタは採用しない", () => {
    const value = JSON.parse(AI_JSON_EXAMPLE);
    value.kind = "revision";
    expect(() => parseAI(JSON.stringify(value))).toThrow("targetRunId");
    value.targetRunId = "run-123";
    value.recipe.id = "attacker-id";
    value.recipe.favorite = true;
    const result = parseAI(JSON.stringify(value));
    expect(result.targetRunId).toBe("run-123");
    expect(result.recipe.id).not.toBe("attacker-id");
    expect(result.recipe.favorite).toBe(false);
  });
});
describe("本人がコピーする相談プロンプト", () => {
  it("一度設定した希望、使い切り食材、本人評価を引き継ぐ", () => {
    const d = data();
    d.ratings = [
      {
        id: "rating",
        recipeId: d.recipes[0].id,
        runId: null,
        stars: 5,
        note: "次は薄味",
        at: new Date().toISOString(),
      },
    ];
    const prompt = buildPrompt(d, "もっと簡単にしたい");
    for (const s of [
      "もっと簡単にしたい",
      "濃い味",
      "辛すぎる物",
      "卵を確認",
      "にんじん",
      "次は薄味",
      "schemaVersion",
      "自動操作は使いません",
    ])
      expect(prompt).toContain(s);
  });
  it("実量・完了工程・残り工程を区別し、修正の対象IDを渡す", () => {
    const d = data();
    let run = createRun(d.recipes[0], 2);
    for (const item of run.shopping)
      run = markShopping(run, item.ingredientId, "bought");
    run = beginPreparation(run);
    run = finishStep(run, run.recipe.prep[0].id);
    d.runs = [run];
    const prompt = buildPrompt(d, "フタがない", run.id);
    for (const s of [
      "フタがない",
      run.id,
      "完了工程",
      "残り工程",
      "購入手元確認",
      "200",
      "完了工程のid",
    ])
      expect(prompt).toContain(s);
    expect(() => buildPrompt(d, "質問", "missing")).toThrow("見つかりません");
  });
});
