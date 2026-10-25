import { useState, useRef, useEffect } from "react";
import type { AppProps, CookingRun } from "../types";
import { id, now } from "../types";
import {
  consumeLot,
  correctStorage,
  correctionInput,
  SAFETY_CHECKS,
  SAFETY_LABELS,
  type StorageInput,
} from "../domain/cooking";
import { StorageFields } from "./Cooking";

export function Leftovers({
  data,
  change,
  openAI,
  runId,
}: AppProps & { runId?: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [lotId, setLotId] = useState("");
  const [count, setCount] = useState(2);
  const [checks, setChecks] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [editChecks, setEditChecks] = useState<string[]>([]);
  const [editing, setEditing] = useState<StorageInput | null>(null);
  const [reason, setReason] = useState("");
  const [stars, setStars] = useState(3);
  const [ratingNote, setRatingNote] = useState("");
  const run = data.runs.find((r) => r.id === selected);
  const lot = run?.lots.find((l) => l.id === lotId);
  function select(r: CookingRun) {
    setSelected(r.id);
    setLotId(r.lots.find((l) => l.remaining > 0)?.id ?? "");
    setCount(2);
    setChecks([]);
    setError("");
    setEditing(null);
  }
  useEffect(() => {
    const target = data.runs.find(
      (r) => r.id === runId && ["leftovers", "done"].includes(r.stage),
    );
    if (target) select(target);
  }, [runId]);
  useEffect(() => {
    if (run && !run.lots.some((l) => l.id === lotId && l.remaining > 0)) {
      const next = run.lots.find((l) => l.remaining > 0);
      setLotId(next?.id ?? "");
      setCount(Math.min(2, next?.remaining ?? 2));
      setChecks([]);
    }
  }, [run, lotId]);
  async function save(action: (run: CookingRun) => CookingRun) {
    if (!run || lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      action(run);
      return await change((d) => {
        const i = d.runs.findIndex((r) => r.id === run.id);
        if (i < 0) throw Error("記録がありません。");
        d.runs[i] = action(d.runs[i]);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました。");
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const active = data.runs.filter((r) => r.stage === "leftovers");
  const done = data.runs.filter((r) => r.stage === "done");
  return (
    <div className="stack">
      <header>
        <p className="eyebrow">YOUR FREEZER</p>
        <h1>作り置きを食べる</h1>
        <p>
          食べる分だけ取り出して、保存状態を確認。日数だけで安全とは判定しません。
        </p>
      </header>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      <div className="cards">
        {active.map((r) => (
          <article className="card" key={r.id}>
            <h2>{r.recipe.title}</h2>
            <p>残り {r.lots.reduce((s, l) => s + l.remaining, 0)}食</p>
            <p>
              {r.lots
                .filter((l) => l.remaining > 0)
                .map(
                  (l) =>
                    `${l.method === "freezer" ? "冷凍" : "冷蔵"} ${l.remaining}食`,
                )
                .join(" ／ ")}
            </p>
            <button className="button" onClick={() => select(r)}>
              この作り置きを食べる
            </button>
          </article>
        ))}
      </div>
      {!active.length && <p className="empty">保存中の料理はありません。</p>}
      {run && (
        <section className="panel stack" aria-label="作り置きの詳細">
          <h2>{run.recipe.title}</h2>
          <p>
            予定{run.servings}食 → 実際{run.actualProduced}食／当日
            {run.ateToday}食
          </p>
          {run.stage === "leftovers" && (
            <>
              <div className="field">
                <label htmlFor="leftovers-lot">食べる保存分</label>
                <select
                  id="leftovers-lot"
                  value={lotId}
                  onChange={(e) => {
                    setLotId(e.target.value);
                    setChecks([]);
                  }}
                >
                  {run.lots
                    .filter((l) => l.remaining > 0)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.method === "freezer" ? "冷凍" : "冷蔵"}・残り
                        {l.remaining}食
                      </option>
                    ))}
                </select>
              </div>
              {lot && (
                <>
                  <p>
                    保存日時：{new Date(lot.storedAt).toLocaleString("ja-JP")}{" "}
                    ／ 容器 {lot.containers}個
                  </p>
                  <p>
                    状態メモ：{lot.conditionNote || "未記入"}
                    <br />
                    食べる予定：{lot.plannedEatOn ?? "未設定"}
                    （消費期限ではありません）
                  </p>
                  <p className="alert">
                    保存状況が不明、常温で長く放置したなどの場合は、再加熱すれば安全になると判断しないでください。見た目やにおいだけで安全とは決めません。
                  </p>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={checks.includes("condition")}
                      onChange={(e) =>
                        setChecks((v) =>
                          e.target.checked
                            ? [...v, "condition"]
                            : v.filter((x) => x !== "condition"),
                        )
                      }
                    />
                    保存状況を確認し、不明・不適切な場合は食べない判断をした
                  </label>
                  {run.recipe.reheat.map((s) => (
                    <label className="check" key={s.id}>
                      <input
                        type="checkbox"
                        checked={checks.includes(s.id)}
                        onChange={(e) =>
                          setChecks((v) =>
                            e.target.checked
                              ? [...v, s.id]
                              : v.filter((x) => x !== s.id),
                          )
                        }
                      />
                      <span>
                        <strong>{s.title}</strong>：{s.instructions.join(" ")}（
                        {s.heat}）
                      </span>
                    </label>
                  ))}
                  <label className="field">
                    今回食べた食数
                    <input
                      type="number"
                      min="1"
                      max={lot.remaining}
                      step="1"
                      value={count}
                      onChange={(e) => setCount(Number(e.target.value))}
                    />
                  </label>
                  <button
                    className="button"
                    disabled={busy}
                    onClick={async () => {
                      if (
                        !checks.includes("condition") ||
                        run.recipe.reheat.some((s) => !checks.includes(s.id))
                      ) {
                        setError(
                          "保存状態と再加熱の確認を毎回すべて行ってください。",
                        );
                        return;
                      }
                      const before = lot.remaining;
                      if (
                        await save((r) => {
                          const current = r.lots.find((l) => l.id === lot.id);
                          if (!current || current.remaining !== before)
                            throw Error(
                              "残りが更新されています。確認し直してください。",
                            );
                          return consumeLot(r, lot.id, count, checks);
                        })
                      ) {
                        setChecks([]);
                      }
                    }}
                  >
                    食べた分を記録
                  </button>
                </>
              )}
            </>
          )}
          {run.stage === "done" && <p className="badge">食べ切り</p>}
          <button
            className="button secondary"
            onClick={() => {
              setEditing(correctionInput(run));
              setEditChecks([...run.safetyChecks]);
              setReason("");
            }}
          >
            保存記録を修正
          </button>
          {editing && (
            <form
              className="stack"
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  !confirm(
                    "保存記録を修正します。すでに食べた分は保持し、修正履歴を残します。変更しますか？",
                  )
                )
                  return;
                if (
                  await save((r) =>
                    correctStorage(r, editing, reason, editChecks),
                  )
                )
                  setEditing(null);
              }}
            >
              <h3>記録のずれを修正</h3>
              <p className="muted">
                残数を修正します。既に食べた保存分は消さず、完成量との合計を検証します。
              </p>
              <StorageFields value={editing} onChange={setEditing} />
              {SAFETY_CHECKS.map((key) => (
                <label className="check" key={key}>
                  <input
                    type="checkbox"
                    checked={editChecks.includes(key)}
                    onChange={(e) =>
                      setEditChecks((v) =>
                        e.target.checked
                          ? [...new Set([...v, key])]
                          : v.filter((x) => x !== key),
                      )
                    }
                  />
                  {SAFETY_LABELS[key]}
                </label>
              ))}
              <label className="field">
                修正理由
                <input
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <button className="button" disabled={busy}>
                確認して記録を修正
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={() => setEditing(null)}
              >
                取り消す
              </button>
            </form>
          )}
          {run.corrections.length > 0 && (
            <details>
              <summary>修正履歴</summary>
              <ul>
                {run.corrections.map((text, i) => (
                  <li key={i}>{text}</li>
                ))}
              </ul>
            </details>
          )}
          <button
            className="button secondary"
            onClick={() =>
              openAI(
                "保存した料理の解凍・再加熱について相談したい。保存記録だけで安全と保証しないで。",
                run.id,
              )
            }
          >
            解凍・再加熱をAIに相談
          </button>
          {run.stage === "done" && (
            <form
              className="stack"
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  await change((d) => {
                    d.ratings.push({
                      id: id(),
                      recipeId: run.recipeId,
                      runId: run.id,
                      stars,
                      note: ratingNote,
                      at: now(),
                    });
                  })
                ) {
                  setRatingNote("");
                }
              }}
            >
              <h3>今回の料理を評価</h3>
              <label className="field">
                今回の評価
                <select
                  value={stars}
                  onChange={(e) => setStars(Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} / 5
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                次回に生かすメモ
                <input
                  value={ratingNote}
                  onChange={(e) => setRatingNote(e.target.value)}
                />
              </label>
              <button className="button">評価を保存</button>
            </form>
          )}
          <button
            className="button secondary"
            onClick={async () => {
              if (
                confirm(
                  "この料理の記録を削除しますか？実際の食品を廃棄する操作ではありません。",
                )
              ) {
                if (
                  await change((d) => {
                    d.runs = d.runs.filter((r) => r.id !== run.id);
                  })
                )
                  setSelected(null);
              }
            }}
          >
            料理記録を削除
          </button>
        </section>
      )}
      {done.length > 0 && (
        <details className="panel">
          <summary>最近食べ切った料理 {done.length}件</summary>
          <div className="cards">
            {done
              .slice()
              .reverse()
              .map((r) => (
                <article className="card" key={r.id}>
                  <h3>{r.recipe.title}</h3>
                  <p>実際 {r.actualProduced}食 · 食べ切り</p>
                  <button
                    className="button secondary"
                    onClick={() => select(r)}
                  >
                    記録を見る・評価
                  </button>
                </article>
              ))}
          </div>
        </details>
      )}
    </div>
  );
}
