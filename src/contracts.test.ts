import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { parseAI } from "./domain/ai";
describe("無料運用と専用指示の契約", () => {
  it("プロジェクト専用指示のJSON例がアプリの同じ検証を通る", () => {
    const doc = readFileSync("CHATGPT_PROJECT_INSTRUCTIONS.md", "utf8");
    const block = doc.match(/```json\n([\s\S]*?)\n```/);
    expect(block).not.toBeNull();
    expect(parseAI(block![1]).recipe.baseServings).toBe(6);
    expect(doc).toContain("完了した工程");
  });
  it("実行依存にAI・外部DB・決済のSDKを入れていない", () => {
    const p = JSON.parse(readFileSync("package.json", "utf8"));
    expect(Object.keys(p.dependencies).sort()).toEqual([
      "react",
      "react-dom",
      "zod",
    ]);
  });
  it("画面と保存処理にバックグラウンド送信を持たない", () => {
    const files = readdirSync("src/components")
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => "src/components/" + f)
      .concat(["src/App.tsx", "src/store.ts"]);
    for (const f of files) {
      const code = readFileSync(f, "utf8");
      expect(code, f).not.toMatch(
        /\b(fetch|XMLHttpRequest|WebSocket|sendBeacon|PaymentRequest)\s*\(/,
      );
    }
  });
});
