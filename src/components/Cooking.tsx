import { useEffect, useRef, useState } from "react";
import type { AppProps, CookingRun } from "../types";
import { now } from "../types";
import { useScreenWakeLock } from "../hooks/useScreenWakeLock";
import {
  beginPreparation,
  finishStep,
  markShopping,
  recordStorage,
  resizeRun,
  SAFETY_CHECKS,
  SAFETY_LABELS,
  shoppingNeeded,
  startTimer,
  pauseTimer,
  timerRemaining,
  type StorageInput,
} from "../domain/cooking";

export function StorageFields({
  value,
  onChange,
}: {
  value: StorageInput;
  onChange: (value: StorageInput) => void;
}) {
  const number = (
    key: keyof StorageInput,
    label: string,
    min = 0,
    max = 48,
  ) => (
    <label className="field">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step="1"
        value={value[key] as number}
        onChange={(e) => onChange({ ...value, [key]: Number(e.target.value) })}
      />
    </label>
  );
  return (
    <div className="form-grid">
      {number("actualProduced", "実際に完成した食数", 1)}
      {number("ateToday", "当日食べた食数")}
      {number("fridge", "冷蔵の残り食数")}
      {number("freezer", "冷凍の残り食数")}
      {number("fridgeContainers", "冷蔵の容器数", 1)}
      {number("freezerContainers", "冷凍の容器数", 1)}
      <label className="field">
        食べる予定日（消費期限ではない）
        <input
          type="date"
          value={value.plannedEatOn ?? ""}
          onChange={(e) =>
            onChange({ ...value, plannedEatOn: e.target.value || null })
          }
        />
      </label>
      <label className="field">
        保存状態のメモ
        <input
          value={value.conditionNote}
          onChange={(e) =>
            onChange({ ...value, conditionNote: e.target.value })
          }
          placeholder="例：1食ずつ浅い容器に分けた"
        />
      </label>
      <details className="wide">
        <summary>保存日時を指定する（空欄なら記録した時刻）</summary>
        {(["fridge", "freezer"] as const).map((method) => {
          const key =
            method === "fridge" ? "fridgeStoredAt" : "freezerStoredAt";
          const date = value[key] ? new Date(value[key]!) : null;
          const local = date
            ? new Date(date.getTime() - date.getTimezoneOffset() * 60000)
                .toISOString()
                .slice(0, 16)
            : "";
          return (
            <label className="field" key={key}>
              {method === "fridge" ? "冷蔵した日時" : "冷凍した日時"}
              <input
                type="datetime-local"
                value={local}
                onChange={(e) =>
                  onChange({
                    ...value,
                    [key]: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : undefined,
                  })
                }
              />
            </label>
          );
        })}
      </details>
    </div>
  );
}

export function Cooking(props: AppProps & { runId?: string }) {
  const { data, change, openAI, runId } = props;
  const run =
    data.runs.find((r) => r.id === runId) ??
    data.runs.find((r) => !["done", "leftovers"].includes(r.stage));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [clock, setClock] = useState(Date.now());
  const [minutes, setMinutes] = useState(3);
  const [memo, setMemo] = useState("");
  const pendingMemo = useRef<{
    runId: string;
    stepId: string;
    text: string;
  } | null>(null);
  const changeRef = useRef(change);
  changeRef.current = change;
  const [question, setQuestion] = useState("");
  const [size, setSize] = useState(run?.servings ?? 6);
  const [storage, setStorage] = useState<StorageInput>({
    actualProduced: run?.servings ?? 6,
    ateToday: Math.min(2, run?.servings ?? 6),
    fridge: 0,
    freezer: Math.max(0, (run?.servings ?? 6) - 2),
    fridgeContainers: 1,
    freezerContainers: 2,
    plannedEatOn: null,
    conditionNote: "",
  });
  const [checks, setChecks] = useState<string[]>([]);
  const wake = useScreenWakeLock(
    run?.stage === "prep" || run?.stage === "cook",
  );
  function persistMemo(value: NonNullable<typeof pendingMemo.current>) {
    return changeRef.current((d) => {
      const current = d.runs.find((r) => r.id === value.runId);
      if (
        !current ||
        ![...current.recipe.prep, ...current.recipe.cook].some(
          (s) => s.id === value.stepId,
        )
      )
        return;
      current.notes[value.stepId] = value.text;
      current.updatedAt = now();
    });
  }
  useEffect(
    () => () => {
      if (pendingMemo.current) void persistMemo(pendingMemo.current);
    },
    [],
  );
  useEffect(() => {
    const pending = pendingMemo.current;
    if (!pending) return;
    const timer = setTimeout(() => {
      void persistMemo(pending).then((ok) => {
        if (ok && pendingMemo.current === pending) pendingMemo.current = null;
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [memo]);
  useEffect(() => {
    const t = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    setViewId(null);
    setError("");
    setSize(run?.servings ?? 6);
    setStorage({
      actualProduced: run?.servings ?? 6,
      ateToday: Math.min(2, run?.servings ?? 6),
      fridge: 0,
      freezer: Math.max(0, (run?.servings ?? 6) - 2),
      fridgeContainers: 1,
      freezerContainers: 2,
      plannedEatOn: null,
      conditionNote: "",
    });
    setChecks([]);
  }, [run?.id, run?.servings]);
  const allSteps = run ? [...run.recipe.prep, ...run.recipe.cook] : [];
  const step =
    allSteps.find((s) => s.id === (viewId ?? run?.activeStepId)) ??
    allSteps.find((s) => !run?.completed.includes(s.id));
  useEffect(() => {
    setMemo(run?.notes[step?.id ?? ""] ?? "");
    setMinutes(step?.minutes ?? 3);
  }, [run?.id, step?.id]);
  async function update(action: (current: CookingRun) => CookingRun) {
    if (!run || lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      action(run);
      return await change((d) => {
        const i = d.runs.findIndex((r) => r.id === run.id);
        if (i < 0) throw Error("料理記録が見つかりません。");
        d.runs[i] = action(d.runs[i]);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "記録を保存できませんでした。");
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (!run)
    return (
      <section className="panel">
        <h1>料理の続きをする</h1>
        <p>調理途中の料理はありません。ホームかレシピから料理を選べます。</p>
      </section>
    );
  const remaining = timerRemaining(run.timer, clock);
  const index = step ? allSteps.findIndex((s) => s.id === step.id) : -1;
  async function next() {
    if (!run || !step) return;
    if (run.completed.includes(step.id)) {
      if (!(await update(withMemo))) return;
      setViewId(allSteps[index + 1]?.id ?? run.activeStepId);
      return;
    }
    if (await update((current) => finishStep(withMemo(current), step.id)))
      setViewId(null);
  }
  function withMemo(current: CookingRun) {
    return step
      ? {
          ...current,
          notes: { ...current.notes, [step.id]: memo },
          updatedAt: now(),
        }
      : current;
  }
  async function consult(questionText: string) {
    if (!run) return;
    if (!step || (await update(withMemo))) openAI(questionText, run.id);
  }
  return (
    <div className="stack cooking-screen">
      <header>
        <p className="eyebrow">COOKING</p>
        <h1>{run.recipe.title}</h1>
        <p>
          {run.servings}食分 · {run.recipe.description}
        </p>
      </header>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {run.stage === "shopping" && (
        <section className="panel stack">
          <h2>材料をそろえる</h2>
          <div className="row">
            <label className="field">
              作る食数
              <input
                type="number"
                min="1"
                max="12"
                step="1"
                value={size}
                disabled={busy || run.completed.length > 0}
                onChange={(e) => setSize(Number(e.target.value))}
              />
            </label>
            <button
              className="button secondary"
              disabled={busy || run.completed.length > 0}
              onClick={() => void update((r) => resizeRun(r, size))}
            >
              分量を変更
            </button>
          </div>
          <p className="muted">
            購入済みの量は消しません。分量を増やすと追加の不足量が表示されます。
          </p>
          <a className="button secondary" href="#shopping">
            買い物をまとめる・一部の量を入力
          </a>
          {run.shopping.map((item) => (
            <article className="card" key={item.ingredientId}>
              <strong>
                {item.name} {item.quantity} {item.unit}
              </strong>
              <p className="muted">
                家にある {item.onHandQuantity} / 購入済み {item.boughtQuantity}{" "}
                / 不足 {shoppingNeeded(item)} {item.unit}
              </p>
              <div className="row">
                <button
                  className="button secondary"
                  aria-label={`${item.name}は家にある`}
                  disabled={busy || shoppingNeeded(item) === 0}
                  onClick={() =>
                    void update((r) =>
                      markShopping(r, item.ingredientId, "home"),
                    )
                  }
                >
                  家にある
                </button>
                <button
                  className="button secondary"
                  aria-label={`${item.name}を購入した`}
                  disabled={busy || shoppingNeeded(item) === 0}
                  onClick={() =>
                    void update((r) =>
                      markShopping(r, item.ingredientId, "bought"),
                    )
                  }
                >
                  購入した
                </button>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => {
                    if (confirm("この材料の調達確認を取り消しますか？"))
                      void update((r) =>
                        markShopping(r, item.ingredientId, "missing"),
                      );
                  }}
                >
                  取り消す
                </button>
              </div>
            </article>
          ))}
          {run.retiredShopping.length > 0 && (
            <div className="alert">
              <h3>変更前に確認した材料</h3>
              <p>レシピから外れた材料も購入記録は残しています。</p>
              {run.retiredShopping.map((i, n) => (
                <p key={n}>
                  {i.name}：購入 {i.boughtQuantity} / 手元 {i.onHandQuantity}{" "}
                  {i.unit}
                </p>
              ))}
            </div>
          )}
          <button
            className="button"
            disabled={busy}
            onClick={async () => {
              if (await update(beginPreparation)) setViewId(null);
            }}
          >
            材料を確認して料理を進める
          </button>
          <button
            className="button secondary"
            onClick={() =>
              openAI(
                "高い食材や余った食材で代用したい。購入済みの情報を残したまま修正して。",
                run.id,
              )
            }
          >
            材料変更をAIに相談
          </button>
        </section>
      )}
      {["prep", "cook"].includes(run.stage) && step && (
        <section
          className="panel stack current-step"
          aria-label="現在の調理工程"
        >
          <div className="row">
            <span className="badge">
              工程 {index + 1} / {allSteps.length}
            </span>
            {run.completed.includes(step.id) && (
              <span className="badge">完了済み・閲覧中</span>
            )}
          </div>
          <progress
            className="cooking-progress"
            aria-label="料理の進み具合"
            max={allSteps.length}
            value={run.completed.length}
          />
          <div className="row">
            <button
              className="button secondary small"
              disabled={!wake.supported}
              onClick={wake.toggle}
              aria-pressed={wake.enabled}
            >
              {wake.enabled ? "画面の点灯保持をやめる" : "画面の点灯を保つ"}
            </button>
            <span className="muted" role="status">
              {wake.active
                ? "点灯を保持中"
                : wake.enabled
                  ? "画面が表示されている間に保持します"
                  : !wake.supported
                    ? "このブラウザでは端末の自動ロック設定を使ってください"
                    : "調理中だけ使えます"}
            </span>
          </div>
          {wake.message && (
            <p className="notice" role="status">
              {wake.message}
            </p>
          )}
          <h2>{step.title}</h2>
          <p className="step-instruction">{step.instructions[0]}</p>
          <details open={step.instructions.length < 3}>
            <summary>詳しく</summary>
            <ol>
              {step.instructions.slice(1).map((text, n) => (
                <li key={n}>{text}</li>
              ))}
            </ol>
          </details>
          <div className="row">
            <span className="badge">火加減：{step.heat || "加熱なし"}</span>
            <span className="badge">目安 {step.minutes ?? "未指定"} 分</span>
          </div>
          <p>道具：{step.equipment.join("・") || "未指定"}</p>
          <div className="card">
            <h3>この工程の材料</h3>
            {step.ingredientIds.length ? (
              step.ingredientIds.map((i) => {
                const item = run.shopping.find((s) => s.ingredientId === i);
                return (
                  item && (
                    <label className="check" key={i}>
                      <input
                        type="checkbox"
                        checked={run.usedIngredientIds.includes(i)}
                        disabled={busy || run.completed.includes(step.id)}
                        onChange={(e) =>
                          void update((r) => ({
                            ...r,
                            usedIngredientIds: e.target.checked
                              ? [...new Set([...r.usedIngredientIds, i])]
                              : r.usedIngredientIds.filter((x) => x !== i),
                          }))
                        }
                      />
                      {item.name} {item.quantity} {item.unit} · 使用済み
                    </label>
                  )
                );
              })
            ) : (
              <p>材料を直接使わない工程です。</p>
            )}
          </div>
          <div className="field">
            <label htmlFor="cooking-memo">この工程のメモ</label>
            <textarea
              id="cooking-memo"
              maxLength={10000}
              value={memo}
              onChange={(e) => {
                pendingMemo.current = {
                  runId: run.id,
                  stepId: step.id,
                  text: e.target.value,
                };
                setMemo(e.target.value);
              }}
            />
            <small className="muted">
              入力後に自動保存します。次へ進む時やAI相談へ移る時も、メモを引き継ぎます。
            </small>
          </div>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => void update(withMemo)}
          >
            工程メモを保存
          </button>
          <div className="row cook-controls">
            <button
              className="button secondary"
              disabled={busy || index <= 0}
              onClick={async () => {
                if (await update(withMemo))
                  setViewId(allSteps[index - 1]?.id ?? null);
              }}
            >
              戻る
            </button>
            <button
              className="button"
              disabled={busy}
              onClick={() => void next()}
            >
              {run.completed.includes(step.id)
                ? "次の工程を見る"
                : "この工程を完了して次へ"}
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() =>
                void consult(question || "今の工程について詳しく教えて")
              }
            >
              AIに質問
            </button>
          </div>
        </section>
      )}
      {["prep", "cook"].includes(run.stage) && (
        <section className="panel">
          <h2>タイマー</h2>
          <p role="timer" className="timer">
            {run.timer?.endAt && clock > run.timer.endAt
              ? `終了から ${Math.floor((clock - run.timer.endAt) / 60000)}分${Math.floor((clock - run.timer.endAt) / 1000) % 60}秒`
              : `残り ${Math.floor(remaining / 60)}分${remaining % 60}秒`}
          </p>
          <label className="field">
            タイマーの分数
            <input
              type="number"
              min="0.1"
              max="1440"
              step="0.1"
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
            />
          </label>
          <div className="row">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() =>
                void update((r) => startTimer(r, Math.round(minutes * 60)))
              }
            >
              タイマー開始
            </button>
            <button
              className="button secondary"
              disabled={busy || !run.timer}
              onClick={() => void update(pauseTimer)}
            >
              一時停止
            </button>
            {run.timer?.endAt === null && run.timer.remainingSeconds > 0 && (
              <button
                className="button secondary"
                disabled={busy}
                onClick={() =>
                  void update((r) => startTimer(r, r.timer!.remainingSeconds))
                }
              >
                再開
              </button>
            )}
          </div>
          <p className="muted">
            再読込しても終了時刻から復元します。アプリを閉じた間の音・通知は保証しません。
          </p>
        </section>
      )}
      {run.stage === "store" && (
        <section className="panel stack">
          <h2>完成した量と保存を記録</h2>
          <p>
            予定は{run.servings}
            食分。実際の完成量が違う場合は下で変更します。当日分と冷蔵・冷凍の合計を合わせてください。
          </p>
          <StorageFields value={storage} onChange={setStorage} />
          <ul>
            {run.recipe.storageNotes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
          {SAFETY_CHECKS.filter(
            (key) => key === "heated" || storage.fridge + storage.freezer > 0,
          ).map((key) => (
            <label className="check" key={key}>
              <input
                type="checkbox"
                checked={checks.includes(key)}
                onChange={(e) =>
                  setChecks((values) =>
                    e.target.checked
                      ? [...values, key]
                      : values.filter((x) => x !== key),
                  )
                }
              />
              {SAFETY_LABELS[key]}
            </label>
          ))}
          <p className="muted">
            食べる予定日は安全期限ではありません。冷却・保存状態が不明な食品を、再加熱だけで安全と判断しないでください。
          </p>
          <button
            className="button"
            disabled={busy}
            onClick={() =>
              void update((r) => recordStorage(r, storage, checks))
            }
          >
            完成量と保存を記録
          </button>
        </section>
      )}
      {["leftovers", "done"].includes(run.stage) && (
        <section className="panel">
          <h2>
            {run.stage === "done" ? "食べ切りました" : "作り置きに保存しました"}
          </h2>
          <p>
            実際に完成 {run.actualProduced}食 · 当日食べた {run.ateToday}食 ·
            保存中 {run.lots.reduce((s, l) => s + l.remaining, 0)}食
          </p>
          <button className="button" onClick={() => props.openRun(run.id)}>
            この記録を開く
          </button>
          <p className="muted">
            保存した分を食べる操作と記録修正は「作り置き」から行えます。
          </p>
        </section>
      )}
      <section className="panel">
        <h2>いま困っていること</h2>
        <label className="field">
          AIに聞きたいこと
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="焦げそう／肉が入り切らない／フタがない"
          />
        </label>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() =>
            void consult(question || "今の状態で次に何をすればよいか教えて")
          }
        >
          状況をまとめてAIに相談
        </button>
      </section>
    </div>
  );
}
