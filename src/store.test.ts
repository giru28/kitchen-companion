import { describe, it, expect } from "vitest";
import { initialData, migrateData, backup } from "./store";
describe("バックアップと移行", () => {
  it("初期状態は2人6食と編集可能な3レシピ", () => {
    const d = initialData();
    expect(d.preferences.people).toBe(2);
    expect(d.preferences.servings).toBe(6);
    expect(d.recipes).toHaveLength(3);
    expect(d.runs).toEqual([]);
  });
  it("rawJSONとv1バックアップを同じ内容へ復元する", () => {
    const d = initialData();
    d.preferences.tastes = "しょうが";
    expect(migrateData(backup(d))).toEqual(d);
    expect(migrateData(d)).toEqual(d);
  });
  it("v0の設定だけ補い既存レシピ・希望を保持する", () => {
    const d = initialData();
    const legacy = {
      ...d,
      version: 0,
      preferences: { ...d.preferences, theme: undefined },
    };
    const next = migrateData(legacy);
    expect(next.version).toBe(1);
    expect(next.recipes).toEqual(d.recipes);
    expect(next.preferences.theme).toBe("system");
  });
  it("未来バージョン・壊れたデータを勝手に空へ初期化しない", () => {
    for (const v of [
      null,
      { ...initialData(), version: 9 },
      { ...backup(initialData()), version: 9 },
      { ...initialData(), recipes: null },
    ])
      expect(() => migrateData(v)).toThrow();
  });
});
