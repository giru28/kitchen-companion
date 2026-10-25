import { useEffect, useRef, useState, type FormEvent } from "react";
import type { AppProps, CookingRun, Recipe } from "../types";
import { batchAgenda } from "../domain/batch";

const stages: Record<CookingRun["stage"], string> = {
  shopping: "材料をそろえる",
  prep: "下ごしらえの途中",
  cook: "調理の途中",
  store: "小分け・保存へ",
  leftovers: "保存している料理",
  done: "食べ切り",
};

export function Home({
  data,
  change,
  openAI,
  startRecipe,
  openRun,
  go,
}: AppProps & { go: (page: string) => void }) {
  const [wish, setWish] = useState(data.wish);
  const [showUseUp, setShowUseUp] = useState(false);
  const [useUp, setUseUp] = useState(data.preferences.useUp);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const savingWish = useRef<Promise<boolean> | null>(null);
  const savedWish = useRef(data.wish);
  const starting = useRef(false);
  useEffect(() => {
    setWish(data.wish);
    savedWish.current = data.wish;
  }, [data.wish]);
  useEffect(() => {
    setUseUp(data.preferences.useUp);
  }, [data.preferences.useUp]);

  async function persistWish(value: string): Promise<boolean> {
    if (savingWish.current) await savingWish.current;
    if (savedWish.current === value) return true;
    const operation = change((draft) => {
      draft.wish = value;
    });
    savingWish.current = operation;
    try {
      const ok = await operation;
      if (ok) savedWish.current = value;
      else
        setNotice(
          "希望を保存できませんでした。入力内容を残したまま再試行してください。",
        );
      return ok;
    } catch {
      setNotice(
        "希望を保存できませんでした。入力内容を残したまま再試行してください。",
      );
      return false;
    } finally {
      if (savingWish.current === operation) savingWish.current = null;
    }
  }
  async function consult(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      if (await persistWish(wish))
        openAI(wish.trim() || "今日の献立を相談したいです。");
    } finally {
      setBusy(false);
    }
  }
  async function consultUseUp(event: FormEvent) {
    event.preventDefault();
    if (!useUp.trim()) {
      setNotice(
        "使い切りたい食材を一つ書いてください。量が分からなければ、そのままで構いません。",
      );
      return;
    }
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      if (
        await change((draft) => {
          draft.preferences.useUp = useUp.trim();
        })
      ) {
        openAI(
          `使い切りたい食材：${useUp.trim()}。現在の量や保存状態が不明なものは推測せず、料理を考えるのを手伝ってください。`,
        );
      } else
        setNotice("食材のメモを保存できませんでした。もう一度試してください。");
    } catch {
      setNotice("食材のメモを保存できませんでした。もう一度試してください。");
    } finally {
      setBusy(false);
    }
  }
  async function begin(recipe: Recipe) {
    if (starting.current) return;
    starting.current = true;
    setBusy(true);
    setNotice("");
    try {
      await startRecipe(recipe.id, data.preferences.servings);
    } catch {
      setNotice(
        "料理を始められませんでした。保存状態を確認して再試行してください。",
      );
    } finally {
      starting.current = false;
      setBusy(false);
    }
  }

  const latestFirst = [...data.runs].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  const active = latestFirst.filter((run) =>
    ["shopping", "prep", "cook", "store"].includes(run.stage),
  );
  const stored = latestFirst.filter((run) =>
    run.lots.some((lot) => lot.remaining > 0),
  );
  const recent = latestFirst
    .filter((run) => run.actualProduced !== null)
    .slice(0, 3);
  const agenda = batchAgenda(data.runs);
  const favorites = data.recipes
    .filter((recipe) => recipe.favorite)
    .slice(0, 3);
  const starterRecipes = data.recipes.slice(0, 3);
  const renderRecipe = (recipe: Recipe) => (
    <article className="card stack" key={recipe.id}>
      <h3>{recipe.title}</h3>
      <p className="muted">{recipe.description}</p>
      <button
        className="button"
        disabled={busy}
        onClick={() => void begin(recipe)}
        aria-label={`${recipe.title}を${data.preferences.servings}食分作る`}
      >
        {data.preferences.servings}食分を作る
      </button>
    </article>
  );

  return (
    <div className="stack home-page">
      <header>
        <p className="eyebrow">KITCHEN COMPANION</p>
        <h1>今日は何作ろう？</h1>
        <p className="muted">
          考えるところから、食べ切るところまで。いつもの条件は覚えています。
        </p>
      </header>
      <section className="panel stack" aria-label="今日の献立相談">
        <div className="row">
          <span className="badge">{data.preferences.people}人暮らし</span>
          <span className="badge">基本{data.preferences.servings}食分</span>
          <span className="badge">追加のAI API料金なし</span>
        </div>
        <form className="stack" onSubmit={(event) => void consult(event)}>
          <label className="field">
            今日はどんな料理にする？
            <textarea
              rows={3}
              maxLength={3000}
              value={wish}
              onChange={(event) => setWish(event.target.value)}
              onBlur={() => void persistWish(wish)}
              placeholder="例：2人で3回食べられる、冷凍向けの料理"
            />
          </label>
          <button className="button" type="submit" disabled={busy}>
            AIに献立を相談
          </button>
        </form>
        <p className="muted">
          条件をまとめてコピーし、ChatGPTで相談できます。文章の自動入力・送信は行いません。
        </p>
      </section>
      {notice && (
        <p className="alert" role="status">
          {notice}
        </p>
      )}
      <div className="quick-grid row" aria-label="すぐ使える操作">
        <button
          className="button secondary"
          onClick={() => setShowUseUp((value) => !value)}
          aria-expanded={showUseUp}
        >
          家にある食材から考える
        </button>
        <button className="button secondary" onClick={() => go("shopping")}>
          買い物リストを見る
        </button>
        <button
          className="button secondary"
          onClick={() => (active[0] ? openRun(active[0].id) : go("library"))}
        >
          {active.length ? "料理の続きをする" : "料理を選ぶ"}
        </button>
        <button className="button secondary" onClick={() => go("leftovers")}>
          作り置きを食べる
        </button>
      </div>
      {showUseUp && (
        <section className="panel" aria-label="使い切りたい食材の相談">
          <h2>余っている食材を、一言で</h2>
          <form
            className="stack"
            onSubmit={(event) => void consultUseUp(event)}
          >
            <label className="field">
              使い切りたい食材
              <textarea
                rows={2}
                maxLength={2000}
                value={useUp}
                onChange={(event) => setUseUp(event.target.value)}
                placeholder="例：にんじんとキャベツ。残りの量は未確認"
              />
            </label>
            <p className="muted">
              毎日の在庫台帳は不要です。前回のメモが現在の在庫と一致するかは、手元で確認してください。
            </p>
            <button className="button" disabled={busy}>
              この食材をAIに相談
            </button>
          </form>
        </section>
      )}
      {active.length > 0 && (
        <section className="panel stack" aria-label="調理途中の料理">
          <h2>料理の続き</h2>
          {active.slice(0, 3).map((run) => (
            <article className="card row" key={run.id}>
              <div>
                <h3>{run.recipe.title}</h3>
                <span className="badge">{stages[run.stage]}</span>
                <p className="muted">
                  計画 {run.servings}食分 · 完了した工程 {run.completed.length}
                  件
                </p>
              </div>
              <button
                className="button secondary"
                onClick={() => openRun(run.id)}
                aria-label={`${run.recipe.title}の続きをする`}
              >
                続きから
              </button>
            </article>
          ))}
        </section>
      )}
      {stored.length > 0 && (
        <section className="panel stack" aria-label="保存している料理">
          <div className="row">
            <h2>冷蔵庫・冷凍庫にある料理</h2>
            <button
              className="button secondary"
              onClick={() => go("leftovers")}
            >
              保存一覧へ
            </button>
          </div>
          {stored.slice(0, 3).map((run) => {
            const cold = run.lots
              .filter((lot) => lot.method === "fridge")
              .reduce((n, lot) => n + lot.remaining, 0);
            const frozen = run.lots
              .filter((lot) => lot.method === "freezer")
              .reduce((n, lot) => n + lot.remaining, 0);
            return (
              <article className="card" key={run.id}>
                <h3>{run.recipe.title}</h3>
                <p>
                  冷蔵 {cold}食 · 冷凍 {frozen}食
                </p>
                <button
                  className="button secondary"
                  onClick={() => openRun(run.id)}
                  aria-label={`${run.recipe.title}の保存記録を開く`}
                >
                  食べる前の確認へ
                </button>
              </article>
            );
          })}
        </section>
      )}
      {agenda.length > 1 && (
        <section className="panel stack" aria-label="まとめ作りの段取り">
          <h2>まとめ作りの、次の一手</h2>
          <p className="muted">
            各料理の順番を守り、今できる工程だけを並べます。炊飯を先に、野菜は生肉より先に。器具の容量を超える調理や、生肉の器具の使い回しはしません。
          </p>
          {agenda.slice(0, 3).map((action) => (
            <div className="card" key={action.runId}>
              <h3>{action.step.title}</h3>
              <p>{action.recipeTitle}</p>
              <button
                className="button secondary"
                onClick={() => openRun(action.runId)}
              >
                この工程を開く
              </button>
            </div>
          ))}
        </section>
      )}
      {recent.length > 0 && (
        <section className="panel stack" aria-label="最近作った料理">
          <h2>最近作った料理</h2>
          {recent.map((run) => (
            <article className="card row" key={run.id}>
              <div>
                <h3>{run.recipe.title}</h3>
                <p className="muted">
                  実際の完成 {run.actualProduced}食 · {stages[run.stage]}
                </p>
              </div>
              <button
                className="button secondary"
                onClick={() => openRun(run.id)}
              >
                記録を見る
              </button>
            </article>
          ))}
        </section>
      )}
      {favorites.length > 0 && (
        <section className="panel stack" aria-label="お気に入り料理">
          <h2>お気に入りから</h2>
          <div className="cards">{favorites.map(renderRecipe)}</div>
        </section>
      )}
      {!favorites.length && starterRecipes.length > 0 && (
        <section className="panel stack" aria-label="すぐに作れる料理">
          <div>
            <h2>相談せず、すぐに作る</h2>
            <p className="muted">手元のレシピはオフラインでも使えます。</p>
          </div>
          <div className="cards">{starterRecipes.map(renderRecipe)}</div>
          <button className="button secondary" onClick={() => go("library")}>
            すべての料理を見る
          </button>
        </section>
      )}
      {!data.recipes.length && (
        <section className="panel">
          <h2>最初のレシピを取り込む</h2>
          <p>
            ChatGPTへの相談内容を作り、確認したJSON回答からレシピを追加できます。
          </p>
          <button className="button" onClick={() => openAI(wish)}>
            AI相談を開く
          </button>
        </section>
      )}
    </div>
  );
}
