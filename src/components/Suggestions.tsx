import { useEffect, useRef, useState } from "react";
import type { AppProps, Recipe } from "../types";
import { scaleIngredients } from "../domain/recipes";
import { suggestMenus, type MenuMode } from "../domain/suggestions";

export function Suggestions({
  data,
  startRecipe,
  openAI,
}: Pick<AppProps, "data" | "startRecipe" | "openAI">) {
  const [mode, setMode] = useState<MenuMode>("all");
  const [seen, setSeen] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const { choices, total, resetCycle } = suggestMenus(data, mode, seen);
  useEffect(
    () => setSeen([]),
    [
      data.preferences.useUp,
      data.preferences.dislikes,
      data.preferences.allergies,
    ],
  );
  async function choose(recipe: Recipe) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await startRecipe(recipe.id, data.preferences.servings, recipe);
    } catch {
      setError(
        "料理を始められませんでした。保存状態を確認して、もう一度選んでください。",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      className="stack menu-suggestions"
      aria-label="アプリからの献立提案"
    >
      <div>
        <h2>この中から選ぶだけ</h2>
        <p className="muted">
          {data.preferences.people}人・{data.preferences.servings}
          食分。買い物から保存まで、手順つきで始められます。
        </p>
      </div>
      <div className="tabs" aria-label="献立の種類">
        {(
          [
            ["all", "おまかせ"],
            ["chicken", "鶏肉"],
            ["pork", "豚肉"],
            ["plant", "野菜・豆腐"],
            ["few", "材料少なめ"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            aria-pressed={mode === value}
            className={mode === value ? "active" : ""}
            disabled={busy}
            onClick={() => {
              setMode(value);
              setSeen([]);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {data.preferences.useUp.trim() && (
        <p className="muted">
          使い切りメモに出てくる食材を優先しています。手元にある量は買い物画面で確認できます。
        </p>
      )}
      {data.preferences.allergies.trim() && (
        <p className="notice">
          アレルギー設定：{data.preferences.allergies}
          。分かる範囲で候補を除いていますが、安全の保証はできません。食材と調味料の原材料表示を確認してください。
        </p>
      )}
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      <div className="suggestion-cards">
        {choices.map(({ recipe, reasons }) => (
          <article className="card stack menu-choice" key={recipe.id}>
            <h3>{recipe.title}</h3>
            <div className="row">
              {reasons.map((reason) => (
                <span className="badge" key={reason}>
                  {reason}
                </span>
              ))}
            </div>
            <p className="muted">
              {recipe.ingredients
                .filter(
                  (i) =>
                    i.category !== "seasoning" &&
                    i.id !== "water" &&
                    i.category !== "grain",
                )
                .map((i) => i.name)
                .slice(0, 3)
                .join("・") || recipe.description}
            </p>
            <button
              className="button"
              disabled={busy}
              onClick={() => void choose(recipe)}
              aria-label={`${recipe.title}にする`}
            >
              これにする → 買い物へ
            </button>
            <details>
              <summary>材料・作り方を確認</summary>
              <p className="muted">{recipe.description}</p>
              <h4>{data.preferences.servings}食分の材料</h4>
              <ul>
                {scaleIngredients(recipe, data.preferences.servings).map(
                  (i) => (
                    <li key={i.id}>
                      {i.name} {i.quantity} {i.unit}
                    </li>
                  ),
                )}
              </ul>
              <p className="muted">
                炊飯器・鍋やフライパンなど、必要な道具を確認してください。時間は器具と量で変わります。
              </p>
              <ol>
                {[...recipe.prep, ...recipe.cook].map((step) => (
                  <li key={step.id}>
                    <strong>{step.title}</strong>：{step.instructions.join(" ")}
                    （{step.heat}）
                  </li>
                ))}
              </ol>
              <h4>保存と再加熱</h4>
              <ul>
                {recipe.storageNotes.map((note, index) => (
                  <li key={index}>{note}</li>
                ))}
              </ul>
              <ol>
                {recipe.reheat.map((step) => (
                  <li key={step.id}>{step.instructions.join(" ")}</li>
                ))}
              </ol>
            </details>
          </article>
        ))}
      </div>
      {!choices.length && (
        <div className="panel">
          <p>
            この条件に合う候補がありません。別の種類を選ぶか、食材の制限に合わせて相談できます。
          </p>
          <button
            className="button secondary"
            onClick={() => openAI("食事制限と好みに合う料理を相談したい")}
          >
            条件に合わせて相談する
          </button>
        </div>
      )}
      {choices.length > 0 && (
        <div className="row">
          <button
            className="button secondary"
            disabled={busy || total <= choices.length}
            onClick={() =>
              setSeen((previous) => [
                ...(resetCycle ? [] : previous),
                ...choices.map((item) => item.recipe.id),
              ])
            }
          >
            ほかの候補を見る
          </button>
          <span className="muted">{total}品の候補から提案</span>
        </div>
      )}
      <p className="muted">
        アプリ内の献立と保存済みレシピから提案します。相談文の入力・コピーは不要で、オフラインでも選べます。
      </p>
    </section>
  );
}
