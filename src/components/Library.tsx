import { useRef, useState, type FormEvent } from "react";
import type { AppProps, Recipe } from "../types";
import { id, now } from "../types";
import { scaleIngredients } from "../domain/recipes";
import { recipeSchema } from "../domain/validation";

function problem(cause: unknown) {
  if (
    cause &&
    typeof cause === "object" &&
    "issues" in cause &&
    Array.isArray(cause.issues)
  )
    return cause.issues
      .map(
        (item: { path?: unknown[]; message?: string }) =>
          `${item.path?.join(".") || "レシピ"}: ${item.message}`,
      )
      .slice(0, 5)
      .join(" / ");
  return cause instanceof Error
    ? cause.message
    : "入力内容を確認してください。";
}
function blankRecipe(): Recipe {
  const step = (prefix: string, title: string) => ({
    id: `${prefix}-1`,
    order: 1,
    title,
    instructions: ["具体的な手順へ書き換えてください。"],
    heat: "",
    minutes: null,
    equipment: [],
    ingredientIds: ["ingredient-1"],
  });
  return {
    id: id(),
    revision: 1,
    title: "",
    description: "",
    baseServings: 6,
    ingredients: [
      {
        id: "ingredient-1",
        name: "",
        quantity: 1,
        unit: "g",
        category: "other",
        note: "",
      },
    ],
    prep: [step("prep", "下準備")],
    cook: [step("cook", "中心まで十分に加熱する")],
    reheat: [step("reheat", "保存状態を確認して中心まで十分に再加熱する")],
    storageNotes: [
      "清潔な浅い容器へ小分けし、速やかに冷却して冷蔵・冷凍。常温に置きっぱなしにしない。",
    ],
    equipment: [],
    favorite: false,
    source: "manual",
    updatedAt: now(),
  };
}
function advanced(recipe: Recipe) {
  const { ingredients, prep, cook, storageNotes, reheat, equipment } = recipe;
  return JSON.stringify(
    { ingredients, prep, cook, storageNotes, reheat, equipment },
    null,
    2,
  );
}

export function Library({ data, change, startRecipe, openAI }: AppProps) {
  const [servings, setServings] = useState(data.preferences.servings);
  const [filter, setFilter] = useState<"all" | "favorite">("all");
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [details, setDetails] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [ratingRecipe, setRatingRecipe] = useState<string | null>(null);
  const [stars, setStars] = useState(5);
  const [ratingNote, setRatingNote] = useState("");
  async function persist(
    mutate: Parameters<AppProps["change"]>[0],
    message: string,
  ) {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const ok = await change(mutate);
      if (ok) setNotice(message);
      else
        setError(
          "保存できませんでした。入力内容と画面上部の状態を確認してください。",
        );
      return ok;
    } catch (cause) {
      setError(problem(cause));
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function edit(recipe: Recipe) {
    setEditing(structuredClone(recipe));
    setDetails(advanced(recipe));
    setError("");
    setNotice("");
  }
  async function saveRecipe(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    try {
      const original = data.recipes.find((recipe) => recipe.id === editing.id);
      const next = recipeSchema.parse({
        ...editing,
        ...JSON.parse(details),
        id: editing.id,
        title: editing.title.trim(),
        description: editing.description.trim(),
        baseServings: editing.baseServings,
        revision: original ? original.revision + 1 : 1,
        source: "manual",
        favorite: original?.favorite ?? false,
        updatedAt: now(),
      });
      if (
        await persist((draft) => {
          const index = draft.recipes.findIndex(
            (recipe) => recipe.id === next.id,
          );
          if (index < 0) draft.recipes.push(next);
          else draft.recipes[index] = next;
        }, "レシピを保存しました。調理中の記録は変更していません。")
      )
        setEditing(null);
    } catch (cause) {
      setError(problem(cause));
    }
  }
  const visible = data.recipes.filter(
    (recipe) => filter === "all" || recipe.favorite,
  );
  return (
    <section className="stack" aria-labelledby="library-title">
      <header>
        <p className="eyebrow">いつもの料理も、新しい一皿も。</p>
        <h1 id="library-title">料理を選ぶ</h1>
        <p className="muted">
          AIの回答を取り込めば、新しい料理もそのまま追加できます。
        </p>
      </header>
      <div className="row">
        <button
          className="button"
          onClick={() => openAI("新しい献立を相談したい")}
        >
          AIに献立を相談
        </button>
        <button
          className="button secondary"
          onClick={() => edit(blankRecipe())}
        >
          手入力でレシピを追加
        </button>
      </div>
      <div className="panel row">
        <label className="field">
          今回作る食数
          <input
            type="number"
            min="1"
            max="12"
            step="1"
            value={servings || ""}
            onChange={(event) => setServings(Number(event.target.value))}
          />
        </label>
        <label className="field">
          レシピの表示
          <select
            value={filter}
            onChange={(event) =>
              setFilter(event.target.value as "all" | "favorite")
            }
          >
            <option value="all">すべて</option>
            <option value="favorite">お気に入り</option>
          </select>
        </label>
      </div>
      {notice && (
        <p role="status" className="alert">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="alert">
          {error}
        </p>
      )}
      {editing && (
        <section className="panel stack" aria-labelledby="recipe-editor-title">
          <h2 id="recipe-editor-title">
            {data.recipes.some((recipe) => recipe.id === editing.id)
              ? "レシピを編集"
              : "レシピを作る"}
          </h2>
          <p className="muted">
            編集は次に作る料理へ反映されます。すでに始めた料理の完了工程・購入記録は変更しません。
          </p>
          <form className="stack" onSubmit={saveRecipe}>
            <div className="form-grid">
              <label className="field">
                料理名
                <input
                  required
                  value={editing.title}
                  onChange={(event) =>
                    setEditing({ ...editing, title: event.target.value })
                  }
                />
              </label>
              <label className="field">
                レシピの基準食数
                <input
                  type="number"
                  required
                  min="1"
                  max="12"
                  value={editing.baseServings}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      baseServings: Number(event.target.value),
                    })
                  }
                />
              </label>
              <label className="field wide">
                料理の説明
                <textarea
                  value={editing.description}
                  onChange={(event) =>
                    setEditing({ ...editing, description: event.target.value })
                  }
                />
              </label>
            </div>
            <details>
              <summary>材料・工程を編集する</summary>
              <p className="muted">
                食材IDと工程の参照を一致させてください。数量・単位は勝手に換算しません。
              </p>
              <label className="field">
                材料・工程JSON
                <textarea
                  rows={18}
                  spellCheck={false}
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                />
              </label>
            </details>
            <div className="row">
              <button className="button" disabled={busy}>
                レシピを保存
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={() => setEditing(null)}
              >
                編集を取り消す
              </button>
            </div>
          </form>
        </section>
      )}
      {!visible.length && (
        <p className="panel muted">
          この条件のレシピはありません。AIの回答から追加するか、手入力で登録できます。
        </p>
      )}
      <div className="recipe-grid">
        {visible.map((recipe) => {
          let ingredients: Recipe["ingredients"] = [];
          try {
            ingredients = scaleIngredients(recipe, servings);
          } catch {
            /* The action gives the input error without changing data. */
          }
          const ratings = data.ratings.filter(
            (rating) => rating.recipeId === recipe.id,
          );
          const average = ratings.length
            ? ratings.reduce((sum, rating) => sum + rating.stars, 0) /
              ratings.length
            : null;
          return (
            <article className="card stack" key={recipe.id}>
              <div className="row">
                <span className="badge">
                  {recipe.source === "sample"
                    ? "サンプル"
                    : recipe.source === "ai"
                      ? "AIから登録"
                      : "自分のレシピ"}
                </span>
                <button
                  className="button secondary"
                  disabled={busy}
                  aria-label={`${recipe.title}を${recipe.favorite ? "お気に入りから外す" : "お気に入りにする"}`}
                  onClick={() =>
                    void persist(
                      (draft) => {
                        const current = draft.recipes.find(
                          (item) => item.id === recipe.id,
                        );
                        if (current) current.favorite = !current.favorite;
                      },
                      recipe.favorite
                        ? "お気に入りから外しました。"
                        : "お気に入りにしました。",
                    )
                  }
                >
                  {recipe.favorite ? "★ お気に入り" : "☆"}
                </button>
              </div>
              <h2>{recipe.title}</h2>
              <p>{recipe.description}</p>
              <p className="muted">
                {recipe.equipment.join("・") || "器具は手順で確認"}
                {average !== null
                  ? ` · 評価 ${average.toFixed(1)}/5 (${ratings.length}件)`
                  : ""}
              </p>
              <details>
                <summary>{servings || "未入力"}食分の材料と手順</summary>
                <ul>
                  {ingredients.map((ingredient) => (
                    <li key={ingredient.id}>
                      {ingredient.name} {ingredient.quantity} {ingredient.unit}
                      {ingredient.note ? ` — ${ingredient.note}` : ""}
                    </li>
                  ))}
                </ul>
                <p className="muted">
                  本・個・gなどは異なる単位のまま扱います。買うパック数と実量は店頭で確認してください。
                </p>
                <h3>下準備</h3>
                <ol>
                  {recipe.prep.map((step) => (
                    <li key={step.id}>
                      {step.title}：{step.instructions.join(" ")}
                    </li>
                  ))}
                </ol>
                <h3>調理</h3>
                <ol>
                  {recipe.cook.map((step) => (
                    <li key={step.id}>
                      {step.title}：{step.instructions.join(" ")}
                    </li>
                  ))}
                </ol>
                <h3>保存</h3>
                <ul>
                  {recipe.storageNotes.map((note, index) => (
                    <li key={index}>{note}</li>
                  ))}
                </ul>
              </details>
              <button
                className="button"
                disabled={busy}
                onClick={async () => {
                  if (
                    !Number.isInteger(servings) ||
                    servings < 1 ||
                    servings > 12
                  ) {
                    setError("食数は1〜12の整数で指定してください。");
                    return;
                  }
                  try {
                    await startRecipe(recipe.id, servings);
                  } catch (cause) {
                    setError(problem(cause));
                  }
                }}
              >
                この料理を{servings || "?"}食分作る
              </button>
              <div className="row">
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => edit(recipe)}
                  aria-label={`${recipe.title}を編集`}
                >
                  編集
                </button>
                <button
                  className="button secondary"
                  disabled={busy}
                  aria-label={`${recipe.title}を複製`}
                  onClick={() =>
                    void persist((draft) => {
                      draft.recipes.push({
                        ...structuredClone(recipe),
                        id: id(),
                        title: `${recipe.title}（コピー）`,
                        revision: 1,
                        favorite: false,
                        source: "manual",
                        updatedAt: now(),
                      });
                    }, "レシピを複製しました。")
                  }
                >
                  複製
                </button>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => {
                    setRatingRecipe(recipe.id);
                    setStars(5);
                    setRatingNote("");
                  }}
                >
                  評価する
                </button>
                <button
                  className="button secondary"
                  disabled={busy}
                  aria-label={`${recipe.title}を削除`}
                  onClick={() => {
                    if (
                      confirm(
                        `「${recipe.title}」をレシピ一覧から削除しますか？すでに始めた調理記録と評価履歴は残ります。`,
                      )
                    )
                      void persist((draft) => {
                        draft.recipes = draft.recipes.filter(
                          (item) => item.id !== recipe.id,
                        );
                      }, "レシピを削除しました。調理記録は保持しています。");
                  }}
                >
                  削除
                </button>
              </div>
              {ratingRecipe === recipe.id && (
                <form
                  className="stack"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    if (
                      await persist((draft) => {
                        draft.ratings.push({
                          id: id(),
                          recipeId: recipe.id,
                          runId: null,
                          stars,
                          note: ratingNote,
                          at: now(),
                        });
                      }, "評価を保存しました。次のAI相談に引き継げます。")
                    )
                      setRatingRecipe(null);
                  }}
                >
                  <label className="field">
                    料理の評価
                    <select
                      value={stars}
                      onChange={(event) => setStars(Number(event.target.value))}
                    >
                      {[5, 4, 3, 2, 1].map((star) => (
                        <option key={star} value={star}>
                          {star} / 5
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    味・次回のメモ
                    <textarea
                      value={ratingNote}
                      onChange={(event) => setRatingNote(event.target.value)}
                    />
                  </label>
                  <div className="row">
                    <button className="button" disabled={busy}>
                      評価を保存
                    </button>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => setRatingRecipe(null)}
                    >
                      やめる
                    </button>
                  </div>
                </form>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
