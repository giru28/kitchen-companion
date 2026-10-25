import { useRef, useState } from "react";
import type { AppProps, Category, CookingRun, ShoppingItem } from "../types";
import { now } from "../types";

export const shoppingCategories: Record<Category, string> = {
  meat: "肉・魚",
  vegetable: "野菜",
  egg: "卵・乳製品",
  grain: "米・麺",
  seasoning: "調味料",
  other: "その他",
};
export const missingQuantity = (item: ShoppingItem) =>
  Math.max(
    0,
    Math.round(
      (item.quantity - item.onHandQuantity - item.boughtQuantity) * 10000,
    ) / 10000,
  );
const itemKey = (item: Pick<ShoppingItem, "name" | "unit" | "category">) =>
  JSON.stringify([item.name, item.unit, item.category]);
const pending = (run: CookingRun) =>
  ["shopping", "prep", "cook"].includes(run.stage);
const quantity = (value: number) =>
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

export function Shopping({ data, change, openRun, openAI }: AppProps) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [showReady, setShowReady] = useState(false);
  const locked = useRef(false);
  const runs = data.runs.filter(pending);
  const groups = aggregateShopping(runs);
  const needed = groups.filter((group) => group.missing > 0);
  const retired = data.runs.flatMap((run) =>
    run.retiredShopping
      .filter((item) => item.boughtQuantity > 0 || item.onHandQuantity > 0)
      .map((item) => ({ run, item })),
  );

  async function confirmGroup(
    group: ShoppingGroup,
    mode: "home" | "bought" | "missing",
  ) {
    if (locked.current) return;
    if (
      mode === "missing" &&
      !window.confirm(
        `「${group.name}」の買い物段階の確認を「まだ足りない」に戻しますか？購入・手元の確認数量を0に戻します。実際の食品を処分する操作ではありません。調理開始後の記録は消しません。`,
      )
    )
      return;
    locked.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const ok = await change((draft) => {
        for (const run of draft.runs.filter(pending)) {
          let changed = false;
          for (const item of run.shopping.filter(
            (item) => itemKey(item) === group.key,
          )) {
            if (mode === "missing") {
              if (run.stage !== "shopping") continue;
              item.onHandQuantity = 0;
              item.boughtQuantity = 0;
              changed = true;
            } else {
              const amount = missingQuantity(item);
              if (!amount) continue;
              if (mode === "home") item.onHandQuantity += amount;
              else item.boughtQuantity += amount;
              changed = true;
            }
          }
          if (changed) run.updatedAt = now();
        }
      });
      if (ok)
        setNotice(
          mode === "missing"
            ? `${group.name}の買い物段階の確認を戻しました。`
            : `${group.name}を${mode === "home" ? "家にある" : "購入した"}と記録しました。永続在庫は増やしていません。`,
        );
      else
        setError(
          "買い物の確認を保存できませんでした。保存状態を確認して再試行してください。",
        );
    } catch {
      setError(
        "買い物の確認を保存できませんでした。保存済みの数量を確認してください。",
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="stack shopping-page">
      <header>
        <p className="eyebrow">SHOP ONCE, COOK TOGETHER</p>
        <h1>買い物リスト</h1>
        <p className="muted">
          同じ食材・同じ単位だけをまとめました。店頭ではチェックだけで進められます。
        </p>
      </header>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="alert" role="status">
          {notice}
        </p>
      )}
      {!runs.length ? (
        <section className="panel">
          <h2>買い物待ちの料理はありません</h2>
          <p className="muted">
            ホームか料理一覧で作る料理を選ぶと、必要量がここにまとまります。以前あった食材が今もあるとは推定しません。
          </p>
        </section>
      ) : (
        <>
          <section className="panel stack" aria-label="買い物のまとめ">
            <div className="row">
              <span className="badge">料理 {runs.length}件</span>
              <span className="badge">
                まだ足りない食材 {needed.length}種類
              </span>
            </div>
            <p>
              {needed.length
                ? "必要量が家にあれば「家にある」、買ったら「購入した」。不足分だけを記録します。"
                : "必要量の確認がそろいました。料理の続きを開けます。"}
            </p>
            <p className="muted">
              数量は料理ごとの確認です。毎日の在庫台帳を作ったり、購入チェックで永続在庫を増やしたりしません。
            </p>
            <label className="check">
              <input
                type="checkbox"
                checked={showReady}
                onChange={(event) => setShowReady(event.target.checked)}
              />
              そろった食材も表示
            </label>
          </section>
          {(Object.keys(shoppingCategories) as Category[]).map((category) => {
            const rows = groups.filter(
              (group) =>
                group.category === category && (showReady || group.missing > 0),
            );
            if (!rows.length) return null;
            return (
              <section
                className="panel stack"
                aria-label={shoppingCategories[category]}
                key={category}
              >
                <h2>{shoppingCategories[category]}</h2>
                {rows.map((group) => (
                  <article
                    className="card stack"
                    data-testid="shopping-group"
                    key={group.key}
                  >
                    <div className="row">
                      <h3>{group.name}</h3>
                      <span className="badge">
                        {group.missing > 0 ? "まだ足りない" : "そろった"}
                      </span>
                    </div>
                    <p>
                      <strong>
                        {group.missing > 0
                          ? `買い足し ${quantity(group.missing)} ${group.unit}`
                          : `必要量 ${quantity(group.required)} ${group.unit}`}
                      </strong>
                    </p>
                    <p className="muted">
                      必要量 {quantity(group.required)} {group.unit} · 家にある{" "}
                      {quantity(group.onHand)} {group.unit} · 購入した{" "}
                      {quantity(group.bought)} {group.unit}
                    </p>
                    {group.missing > 0 && (
                      <div className="row">
                        <button
                          className="button secondary"
                          disabled={busy}
                          onClick={() => void confirmGroup(group, "home")}
                          aria-label={`${group.name}は家にある`}
                        >
                          家にある
                        </button>
                        <button
                          className="button"
                          disabled={busy}
                          onClick={() => void confirmGroup(group, "bought")}
                          aria-label={`${group.name}を購入した`}
                        >
                          購入した
                        </button>
                      </div>
                    )}
                    {(group.onHand > 0 || group.bought > 0) &&
                      runs.some(
                        (run) =>
                          run.stage === "shopping" &&
                          group.runIds.includes(run.id),
                      ) && (
                        <button
                          className="button secondary"
                          disabled={busy}
                          onClick={() => void confirmGroup(group, "missing")}
                          aria-label={`${group.name}の確認をまだ足りないに戻す`}
                        >
                          まだ足りないに戻す
                        </button>
                      )}
                  </article>
                ))}
              </section>
            );
          })}
          <section className="panel stack" aria-label="買い物中の料理">
            <h2>今回作る料理</h2>
            {runs.map((run) => (
              <article className="card stack" key={run.id}>
                <h3>{run.recipe.title}</h3>
                <p>
                  {run.servings}食分 ·{" "}
                  {run.shopping.some((item) => missingQuantity(item) > 0)
                    ? "材料を確認中"
                    : "必要量がそろった"}
                </p>
                <div className="row">
                  <button
                    className="button"
                    onClick={() => openRun(run.id)}
                    aria-label={`${run.recipe.title}の料理の続きを開く`}
                  >
                    料理の続きを開く
                  </button>
                  <button
                    className="button secondary"
                    onClick={() =>
                      openAI(
                        "材料を変更したいです。買い物内容と購入済みの記録を踏まえて相談したいです。",
                        run.id,
                      )
                    }
                    aria-label={`${run.recipe.title}の材料変更をAIに相談`}
                  >
                    材料変更をAIに相談
                  </button>
                </div>
              </article>
            ))}
          </section>
        </>
      )}
      {retired.length > 0 && (
        <section className="panel" aria-label="変更前に確認した食材">
          <h2>レシピ変更前に確認した食材</h2>
          <p className="muted">
            不要になった材料も、購入・手元の確認記録は残しています。今の買い物必要量には重複加算しません。食べられるか、使い道は本人が確認してください。
          </p>
          <ul>
            {retired.map(({ run, item }, index) => (
              <li key={`${run.id}-${item.ingredientId}-${index}`}>
                {run.recipe.title}：{item.name} · 購入{" "}
                {quantity(item.boughtQuantity)} {item.unit} · 家にある{" "}
                {quantity(item.onHandQuantity)} {item.unit}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
