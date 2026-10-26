import { useRef, useState } from "react";
import type { AppProps, Category } from "../types";
import {
  aggregateShopping,
  confirmShoppingGroup,
  missingQuantity,
  pending,
  quantity,
  shoppingCategories,
  shoppingText,
  type ShoppingGroup,
} from "../domain/shopping";

export function Shopping({ data, change, openRun, openAI }: AppProps) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [showReady, setShowReady] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const textRef = useRef<HTMLTextAreaElement>(null);
  const memoRef = useRef<HTMLDetailsElement>(null);
  const locked = useRef(false);
  const runs = data.runs.filter(pending);
  const groups = aggregateShopping(runs);
  const needed = groups.filter((group) => group.missing > 0);
  const memo = shoppingText(data.runs);
  function selectMemo() {
    if (memoRef.current) memoRef.current.open = true;
    textRef.current?.focus();
    textRef.current?.select();
    setNotice("買い物メモを選択しました。長押ししてコピーできます。");
  }
  async function copyMemo() {
    try {
      if (!navigator.clipboard?.writeText) return selectMemo();
      await navigator.clipboard.writeText(memo);
      setNotice(
        "不足分をコピーしました。メモやメッセージへ、ご自身で貼り付けられます。",
      );
    } catch {
      selectMemo();
    }
  }
  const retired = data.runs.flatMap((run) =>
    run.retiredShopping
      .filter((item) => item.boughtQuantity > 0 || item.onHandQuantity > 0)
      .map((item) => ({ run, item })),
  );

  async function confirmGroup(
    group: ShoppingGroup,
    mode: "home" | "bought" | "missing",
    amount?: number,
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
      confirmShoppingGroup(data.runs, group.key, mode, amount);
      const ok = await change((draft) => {
        draft.runs = confirmShoppingGroup(draft.runs, group.key, mode, amount);
      });
      if (ok) {
        setAmounts((values) => ({ ...values, [group.key]: "" }));
        setNotice(
          mode === "missing"
            ? `${group.name}の買い物段階の確認を戻しました。`
            : `${group.name} ${quantity(amount ?? group.missing)} ${group.unit}を${mode === "home" ? "家にある" : "購入した"}と記録しました。`,
        );
      } else
        setError(
          "買い物の確認を保存できませんでした。保存状態を確認して再試行してください。",
        );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "買い物の確認を保存できませんでした。",
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
              記録は今回の料理で使う量です。家の在庫を毎日入力する必要はありません。
            </p>
            <label className="check">
              <input
                type="checkbox"
                checked={showReady}
                onChange={(event) => setShowReady(event.target.checked)}
              />
              そろった食材も表示
            </label>
            <button
              className="button secondary"
              onClick={() => void copyMemo()}
            >
              不足分をコピー
            </button>
            <details ref={memoRef}>
              <summary>買い物メモを表示</summary>
              <div className="field">
                <label htmlFor="shopping-memo">コピーする買い物メモ</label>
                <textarea
                  id="shopping-memo"
                  rows={10}
                  readOnly
                  ref={textRef}
                  value={memo}
                />
              </div>
            </details>
            <p className="muted">
              肉・魚・冷蔵品は買い物の最後に。保冷して持ち帰り、製品の表示に従って保存してください。
            </p>
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
                {rows.map((group, index) => (
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
                      <>
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
                        <details>
                          <summary>一部だけそろえる</summary>
                          <div className="stack">
                            <p className="muted">
                              今回の料理に使う量だけを入力します。同じ食材を複数の料理へ二重に数えません。
                            </p>
                            <div className="field">
                              <label htmlFor={`amount-${category}-${index}`}>
                                入力する数量（{group.name}・{group.unit}）
                              </label>
                              <input
                                id={`amount-${category}-${index}`}
                                type="number"
                                min="0"
                                max={group.missing}
                                step="any"
                                value={amounts[group.key] ?? ""}
                                placeholder={`最大 ${quantity(group.missing)}`}
                                onChange={(e) =>
                                  setAmounts((values) => ({
                                    ...values,
                                    [group.key]: e.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="row">
                              <button
                                className="button secondary"
                                disabled={busy || !amounts[group.key]}
                                onClick={() =>
                                  void confirmGroup(
                                    group,
                                    "home",
                                    Number(amounts[group.key]),
                                  )
                                }
                                aria-label={`${group.name}の入力した量は家にある`}
                              >
                                この量は家にある
                              </button>
                              <button
                                className="button secondary"
                                disabled={busy || !amounts[group.key]}
                                onClick={() =>
                                  void confirmGroup(
                                    group,
                                    "bought",
                                    Number(amounts[group.key]),
                                  )
                                }
                                aria-label={`${group.name}の入力した量を購入した`}
                              >
                                この量を購入した
                              </button>
                            </div>
                          </div>
                        </details>
                      </>
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
