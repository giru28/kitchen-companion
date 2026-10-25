import { useEffect, useMemo, useRef, useState } from "react";
import type { AppProps, CookingRun, Recipe } from "../types";
import { now } from "../types";
import { AI_JSON_EXAMPLE, buildPrompt, parseAI } from "../domain/ai";
import { applyRecipeRevision } from "../domain/cooking";

type Parsed = ReturnType<typeof parseAI>;
function failure(cause: unknown) {
  return cause instanceof Error
    ? cause.message
    : "回答の形式を確認してください。";
}
const format = (value: number) =>
  new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 3 }).format(value);

export function Assistant({
  data,
  change,
  question: incomingQuestion,
  runId,
  openRun,
}: AppProps & { question: string; runId?: string }) {
  const [question, setQuestion] = useState(incomingQuestion);
  const [targetId, setTargetId] = useState(runId ?? "");
  const [answer, setAnswer] = useState("");
  const [preview, setPreview] = useState<Parsed | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const promptDetailsRef = useRef<HTMLDetailsElement>(null);
  const answerRef = useRef<HTMLTextAreaElement>(null);
  const lock = useRef(false);
  useEffect(() => {
    setQuestion(incomingQuestion);
    setTargetId(runId ?? "");
  }, [incomingQuestion, runId]);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    addEventListener("online", update);
    addEventListener("offline", update);
    return () => {
      removeEventListener("online", update);
      removeEventListener("offline", update);
    };
  }, []);
  const generated = useMemo(() => {
    try {
      return {
        text: buildPrompt(data, question, targetId || undefined),
        error: "",
      };
    } catch (cause) {
      return { text: "", error: failure(cause) };
    }
  }, [data, question, targetId]);
  const prompt = generated.text;
  const contextRun = data.runs.find((run) => run.id === targetId);
  const revision = useMemo<{
    current?: CookingRun;
    next?: CookingRun;
    error?: string;
  }>(() => {
    if (!preview || preview.kind !== "revision") return {};
    if (!preview.targetRunId)
      return {
        error:
          "手順の修正にはtargetRunIdが必要です。元の相談文のIDを使うようChatGPTへ依頼してください。",
      };
    if (!targetId || preview.targetRunId !== targetId)
      return {
        error:
          "回答の対象IDと選択中の調理記録が一致しません。対象を確認してから回答を生成し直してください。",
      };
    const current = data.runs.find((run) => run.id === preview.targetRunId);
    if (!current)
      return {
        error:
          "対象の調理記録が見つかりません。新規レシピとして取り込む場合はkindをrecipeにしてください。",
      };
    try {
      return { current, next: applyRecipeRevision(current, preview.recipe) };
    } catch (cause) {
      return { current, error: failure(cause) };
    }
  }, [preview, data.runs, targetId]);

  function manualCopy() {
    if (promptDetailsRef.current) promptDetailsRef.current.open = true;
    promptRef.current?.focus();
    promptRef.current?.select();
    setNotice(
      "相談文を選択しました。長押しまたは端末のコピー操作でコピーしてください。",
    );
  }
  async function copy() {
    setError("");
    try {
      if (!navigator.clipboard?.writeText) {
        manualCopy();
        return;
      }
      await navigator.clipboard.writeText(prompt);
      setNotice(
        "相談文をコピーしました。ChatGPTで貼り付け、内容を確認して送信してください。",
      );
    } catch {
      manualCopy();
    }
  }
  async function readClipboard() {
    setError("");
    setNotice("");
    try {
      if (!navigator.clipboard?.readText) throw new Error();
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setError(
          "クリップボードが空です。ChatGPTのJSON回答をコピーして、下の欄へ貼り付けてください。",
        );
        return;
      }
      setAnswer(text);
      setPreview(null);
      setConfirmed(false);
      setNotice("回答を読み取りました。次に内容を確認してください。");
    } catch {
      setNotice(
        "自動読み取りを利用できません。下の欄を長押しして貼り付けてください。",
      );
      answerRef.current?.focus();
    }
  }
  function inspect() {
    setError("");
    setNotice("");
    setPreview(null);
    setConfirmed(false);
    try {
      setPreview(parseAI(answer));
    } catch (cause) {
      setError(failure(cause));
    }
  }
  async function commit() {
    if (!preview || !confirmed || lock.current) return;
    if (preview.kind === "revision" && revision.error) {
      setError(revision.error);
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const ok = await change((draft) => {
        if (preview.kind === "recipe") {
          if (draft.recipes.some((recipe) => recipe.id === preview.recipe.id))
            throw new Error(
              "同じIDのレシピが登録済みです。回答をもう一度確認してください。",
            );
          draft.recipes.push(structuredClone(preview.recipe));
          return;
        }
        if (!targetId || preview.targetRunId !== targetId)
          throw new Error("対象の調理記録が一致しません。");
        const index = draft.runs.findIndex((run) => run.id === targetId);
        if (index < 0) throw new Error("対象の調理記録が見つかりません。");
        const next = applyRecipeRevision(draft.runs[index], preview.recipe);
        draft.runs[index] = next;
        const recipeIndex = draft.recipes.findIndex(
          (recipe) => recipe.id === next.recipeId,
        );
        if (recipeIndex >= 0) {
          const previous = draft.recipes[recipeIndex];
          draft.recipes[recipeIndex] = {
            ...structuredClone(next.recipe),
            id: previous.id,
            revision: previous.revision + 1,
            favorite: previous.favorite,
            source: "ai",
            updatedAt: now(),
          };
        }
      });
      if (ok) {
        setNotice(
          preview.kind === "recipe"
            ? "レシピを登録しました。「料理」から選んで始められます。"
            : "未完了の手順と買い物の変更を保存しました。完了した記録と購入済みの量は保持しています。",
        );
        setPreview(null);
        setConfirmed(false);
        setAnswer("");
      } else
        setError(
          "取り込みを保存できませんでした。画面上部の状態を確認してください。回答はこの欄に残しています。",
        );
    } catch (cause) {
      setError(failure(cause));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="stack" aria-labelledby="assistant-title">
      <header>
        <p className="eyebrow">状況の説明は、アプリがまとめます。</p>
        <h1 id="assistant-title">AIに相談する</h1>
        <p className="muted">
          追加のAI料金なし。ChatGPTの公式サイト・アプリで相談し、JSON回答をここへ戻します。自動入力・自動送信はしません。
        </p>
      </header>
      {offline && (
        <p className="alert">
          端末はオフラインです。相談文の作成・コピー、保存済み回答の取り込みは使えます。ChatGPTへの相談はオンラインで行ってください。
        </p>
      )}
      <section className="panel stack" aria-labelledby="prompt-title">
        <h2 id="prompt-title">1. 相談文をコピー</h2>
        {generated.error && (
          <p className="alert" role="alert">
            {generated.error} 下の対象を選び直してください。
          </p>
        )}
        <div className="field">
          <label htmlFor="assistant-question">相談したいこと</label>
          <textarea
            id="assistant-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="例：肉がフライパンに入り切らない、にんじんを使い切りたい"
          />
        </div>
        <label className="field">
          引き継ぐ調理記録
          <select
            value={targetId}
            onChange={(event) => {
              setTargetId(event.target.value);
              setConfirmed(false);
            }}
          >
            <option value="">新しい献立を相談する</option>
            {data.runs.map((run) => (
              <option key={run.id} value={run.id}>
                {run.recipe.title} · {run.servings}食分
              </option>
            ))}
          </select>
        </label>
        <p className="muted">
          人数・食数・好み・器具・使いたい食材を引き継ぎます。
          {contextRun &&
            "選択した料理の材料量・完了工程・購入記録も含みます。"}{" "}
          コピー前に、外へ渡す内容を確認できます。
        </p>
        <div className="row">
          <button
            className="button"
            disabled={!prompt}
            onClick={() => void copy()}
          >
            相談文をコピー
          </button>
          <a
            className="button secondary"
            href="https://chatgpt.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            ChatGPTを開く ↗
          </a>
        </div>
        <p className="muted">
          ChatGPTへ移動したら貼り付けて、ご自身で送信します。音声で続けたい場合はChatGPTアプリの音声機能を利用してください。このアプリからの自動連携ではありません。
        </p>
        <details ref={promptDetailsRef}>
          <summary>生成した相談文を確認・手動コピー</summary>
          <div className="field">
            <label htmlFor="assistant-prompt">ChatGPTへ渡す相談文</label>
            <textarea
              id="assistant-prompt"
              ref={promptRef}
              rows={14}
              readOnly
              value={prompt}
              onFocus={(event) => event.currentTarget.select()}
            />
          </div>
          <button className="button secondary" onClick={manualCopy}>
            相談文を選択
          </button>
        </details>
      </section>
      <section className="panel stack" aria-labelledby="answer-title">
        <h2 id="answer-title">2. AIの回答を取り込む</h2>
        <p className="muted">
          ChatGPTに返してもらったJSONをコピーし、貼り付けます。説明文やJSONコードブロックを含む回答も、形式を確認してから取り込みます。
        </p>
        <button
          className="button secondary"
          onClick={() => void readClipboard()}
        >
          クリップボードから読む
        </button>
        <div className="field">
          <label htmlFor="assistant-answer">ChatGPTのJSON回答</label>
          <textarea
            id="assistant-answer"
            ref={answerRef}
            rows={10}
            value={answer}
            onChange={(event) => {
              setAnswer(event.target.value);
              setPreview(null);
              setConfirmed(false);
            }}
            spellCheck={false}
            placeholder="ChatGPTの回答をここへ貼り付け"
          />
        </div>
        <button
          className="button"
          disabled={!answer.trim() || busy}
          onClick={inspect}
        >
          回答の内容を確認
        </button>
        <details>
          <summary>取り込めるJSONの例を見る</summary>
          <p className="muted">
            schemaVersion: 1
            の形式です。JSONが正しくても料理の内容が正しいとは限りません。
          </p>
          <pre>
            {typeof AI_JSON_EXAMPLE === "string"
              ? AI_JSON_EXAMPLE
              : JSON.stringify(AI_JSON_EXAMPLE, null, 2)}
          </pre>
        </details>
      </section>
      {error && (
        <p role="alert" className="alert">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="alert">
          {notice}
        </p>
      )}
      {preview && (
        <section className="panel stack" aria-labelledby="import-preview-title">
          <h2 id="import-preview-title">3. 取り込む前に確認</h2>
          <span className="badge">
            {preview.kind === "revision"
              ? "調理中の手順を更新"
              : "新しいレシピ"}
          </span>
          <RecipePreview recipe={preview.recipe} />
          {preview.kind === "revision" && (
            <>
              <h3>変更の影響</h3>
              <p>
                対象：{revision.current?.recipe.title ?? "対象未確認"}
                。完了工程・使用済み材料・購入した量を保持し、未完了部分を更新します。
              </p>
              {revision.error ? (
                <p role="alert" className="alert">
                  {revision.error}
                </p>
              ) : (
                revision.current &&
                revision.next && (
                  <>
                    <p>
                      残る完了記録 {revision.next.completed.length}件 ·
                      買い物項目 {revision.current.shopping.length} →{" "}
                      {revision.next.shopping.length}件
                    </p>
                    <ul>
                      {revision.next.shopping.map((item) => {
                        const old = revision.current!.shopping.find(
                          (previous) =>
                            previous.ingredientId === item.ingredientId &&
                            previous.name === item.name &&
                            previous.unit === item.unit,
                        );
                        return (
                          <li key={item.ingredientId}>
                            {item.name}：
                            {old
                              ? `${format(old.quantity)} → `
                              : "新しく必要："}
                            {format(item.quantity)} {item.unit} · 購入済み{" "}
                            {format(item.boughtQuantity)} · 家にある{" "}
                            {format(item.onHandQuantity)}
                          </li>
                        );
                      })}
                    </ul>
                    {!!revision.next.retiredShopping.length && (
                      <div className="alert">
                        <h4>変更前に確認した食材も記録に残します</h4>
                        <ul>
                          {revision.next.retiredShopping.map((item, index) => (
                            <li key={`${item.ingredientId}-${index}`}>
                              {item.name} · 購入済み{" "}
                              {format(item.boughtQuantity)} {item.unit} ·
                              家にある {format(item.onHandQuantity)} {item.unit}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p className="muted">
                      不足材料があれば買い物の確認へ戻ります。既存のレシピ一覧にも更新を反映しますが、ほかの調理記録には適用しません。
                    </p>
                  </>
                )
              )}
            </>
          )}
          <p className="alert">
            AIの数量・加熱・保存方法が適切か確認してください。食材と調味料の表示・アレルギーに注意し、保存日数だけで安全とは判断しません。予定日は消費期限ではありません。
          </p>
          <label className="check">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            材料量・手順・安全上の注意を確認した
          </label>
          <button
            className="button"
            disabled={
              !confirmed ||
              busy ||
              (preview.kind === "revision" && !!revision.error)
            }
            onClick={() => void commit()}
          >
            {busy
              ? "保存中…"
              : preview.kind === "revision"
                ? "確認して未完了の手順を更新"
                : "確認してレシピを登録"}
          </button>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => {
              setPreview(null);
              setConfirmed(false);
            }}
          >
            取り込みを取り消す
          </button>
        </section>
      )}
      {targetId && (
        <button className="button secondary" onClick={() => openRun(targetId)}>
          料理の続きへ戻る
        </button>
      )}
    </section>
  );
}

function RecipePreview({ recipe }: { recipe: Recipe }) {
  return (
    <div className="stack">
      <h3>{recipe.title}</h3>
      <p>{recipe.description}</p>
      <p>
        {recipe.baseServings}食分 · 器具：
        {recipe.equipment.join("・") || "記載なし"}
      </p>
      <ul>
        {recipe.ingredients.map((ingredient) => (
          <li key={ingredient.id}>
            {ingredient.name} {format(ingredient.quantity)} {ingredient.unit}
            {ingredient.note ? ` — ${ingredient.note}` : ""}
          </li>
        ))}
      </ul>
      <details>
        <summary>下準備・調理・保存・再加熱を確認する</summary>
        <h4>下準備</h4>
        <ol>
          {recipe.prep.map((step) => (
            <li key={step.id}>
              {step.title}：{step.instructions.join(" ")}
              {step.minutes === null ? "" : `（目安${step.minutes}分）`}
            </li>
          ))}
        </ol>
        <h4>調理</h4>
        <ol>
          {recipe.cook.map((step) => (
            <li key={step.id}>
              {step.title}：{step.instructions.join(" ")} · 火加減{" "}
              {step.heat || "記載なし"} ·{" "}
              {step.minutes === null ? "時間目安なし" : `目安${step.minutes}分`}{" "}
              · 器具 {step.equipment.join("・") || "記載なし"}
            </li>
          ))}
        </ol>
        <h4>保存時の注意</h4>
        <ul>
          {recipe.storageNotes.map((note, index) => (
            <li key={index}>{note}</li>
          ))}
        </ul>
        <h4>再加熱</h4>
        <ol>
          {recipe.reheat.map((step) => (
            <li key={step.id}>
              {step.title}：{step.instructions.join(" ")}
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
