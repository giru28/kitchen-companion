import type { Category, CookingRun, ShoppingItem } from "../types";
import { now } from "../types";
import { shoppingNeeded } from "./cooking";

export const shoppingCategories: Record<Category, string> = {
  vegetable: "野菜",
  grain: "米・麺",
  seasoning: "調味料",
  other: "その他",
  egg: "卵・乳製品",
  meat: "肉・魚",
};
export const missingQuantity = shoppingNeeded;
export const itemKey = (
  item: Pick<ShoppingItem, "name" | "unit" | "category">,
) => JSON.stringify([item.name, item.unit, item.category]);
export const pending = (run: CookingRun) =>
  ["shopping", "prep", "cook"].includes(run.stage);
export const quantity = (value: number) =>
  new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 4 }).format(value);

export interface ShoppingGroup {
  key: string;
  name: string;
  unit: string;
  category: Category;
  required: number;
  onHand: number;
  bought: number;
  missing: number;
  runIds: string[];
}
/** Only identical names, units, and categories are merged. Confirmed quantities stay allocated to their run. */
export function aggregateShopping(runs: CookingRun[]): ShoppingGroup[] {
  const groups = new Map<string, ShoppingGroup>();
  for (const run of runs.filter(pending))
    for (const item of run.shopping) {
      const key = itemKey(item);
      const group = groups.get(key) ?? {
        key,
        name: item.name,
        unit: item.unit,
        category: item.category,
        required: 0,
        onHand: 0,
        bought: 0,
        missing: 0,
        runIds: [],
      };
      group.required += item.quantity;
      group.onHand += item.onHandQuantity;
      group.bought += item.boughtQuantity;
      group.missing += missingQuantity(item);
      if (!group.runIds.includes(run.id)) group.runIds.push(run.id);
      groups.set(key, group);
    }
  return [...groups.values()].map((group) => ({
    ...group,
    required: Math.round(group.required * 10000) / 10000,
    onHand: Math.round(group.onHand * 10000) / 10000,
    bought: Math.round(group.bought * 10000) / 10000,
    missing: Math.round(group.missing * 10000) / 10000,
  }));
}

/** Allocate confirmed food only to shopping-stage recipes; never create perpetual inventory. */
export function confirmShoppingGroup(
  runs: CookingRun[],
  key: string,
  mode: "home" | "bought" | "missing",
  amount?: number,
): CookingRun[] {
  const targets = runs
    .filter((r) => r.stage === "shopping")
    .flatMap((r) => r.shopping.filter((i) => itemKey(i) === key));
  if (!targets.length)
    throw Error(
      "材料確認中の食材が見つかりません。最新の一覧を確認してください。",
    );
  const available = targets.reduce(
    (sum, item) => sum + missingQuantity(item),
    0,
  );
  let remaining = amount ?? available;
  if (
    mode !== "missing" &&
    (!Number.isFinite(remaining) ||
      remaining <= 0 ||
      remaining > available + 1e-8)
  )
    throw Error(
      "数量は0より大きく、不足分以下で入力してください。今回の料理に使う量だけを確認します。",
    );
  const next = structuredClone(runs);
  for (const run of next.filter((r) => r.stage === "shopping")) {
    let changed = false;
    for (const item of run.shopping.filter((i) => itemKey(i) === key)) {
      if (mode === "missing") {
        item.onHandQuantity = 0;
        item.boughtQuantity = 0;
        changed = true;
      } else {
        const allocated = Math.min(missingQuantity(item), remaining);
        if (allocated <= 0) continue;
        if (mode === "home")
          item.onHandQuantity =
            Math.round((item.onHandQuantity + allocated) * 1e6) / 1e6;
        else
          item.boughtQuantity =
            Math.round((item.boughtQuantity + allocated) * 1e6) / 1e6;
        remaining = Math.max(
          0,
          Math.round((remaining - allocated) * 1e6) / 1e6,
        );
        changed = true;
      }
    }
    if (changed) run.updatedAt = now();
  }
  return next;
}

export function shoppingText(runs: CookingRun[]): string {
  const groups = aggregateShopping(runs).filter((g) => g.missing > 0);
  if (!groups.length) return "買い足しが必要な食材はありません。";
  const sections = Object.entries(shoppingCategories).flatMap(
    ([category, label]) => {
      const rows = groups.filter((g) => g.category === category);
      return rows.length
        ? [
            label,
            ...rows.map((g) => `□ ${g.name} ${quantity(g.missing)} ${g.unit}`),
            "",
          ]
        : [];
    },
  );
  return [
    "買い足すもの（確認した不足分）",
    "",
    ...sections,
    "肉・魚・冷蔵品は買い物の最後に。保冷して持ち帰り、製品の表示に従って保存してください。",
  ].join("\n");
}
