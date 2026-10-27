import { useEffect, useRef, useState } from "react";
import type { AppProps, KitchenData, Recipe } from "./types";
import { readState, saveState, type Saved } from "./store";
import { createRun } from "./domain/cooking";
import { Home } from "./components/Home";
import { Shopping } from "./components/Shopping";
import { Cooking } from "./components/Cooking";
import { Leftovers } from "./components/Leftovers";
import { Library } from "./components/Library";
import { Assistant } from "./components/Assistant";
import { Preferences } from "./components/Preferences";
import { DataTools } from "./components/DataTools";
import { Recovery } from "./components/Recovery";
type Page =
  | "home"
  | "library"
  | "shopping"
  | "cooking"
  | "leftovers"
  | "settings"
  | "assistant";
const pages: Page[] = [
  "home",
  "library",
  "shopping",
  "cooking",
  "leftovers",
  "settings",
  "assistant",
];
export function App() {
  const [offlineReady, setOfflineReady] = useState(false);
  const [offlineFailed, setOfflineFailed] = useState(false);
  const [page, setPage] = useState<Page>(() => {
    const h = location.hash.slice(1);
    return pages.includes(h as Page) ? (h as Page) : "home";
  });
  const [data, setData] = useState<KitchenData | null>(null);
  const [status, setStatus] = useState("読み込み中");
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(!navigator.onLine);
  const [runId, setRunId] = useState<string | undefined>(() => {
    try {
      return sessionStorage.getItem("kitchen-current-run") || undefined;
    } catch {
      return undefined;
    }
  });
  const [question, setQuestion] = useState("");
  const [install, setInstall] = useState<Event | null>(null);
  const current = useRef<Saved | null>(null);
  const queue = useRef(Promise.resolve());
  function go(value: string) {
    const next = pages.includes(value as Page) ? (value as Page) : "home";
    setPage(next);
    location.hash = next;
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  async function load() {
    try {
      const s = await readState();
      current.current = s;
      setData(s.data);
      setStatus("この端末に保存済み");
      setError("");
    } catch (e) {
      setStatus("読込失敗");
      setError(e instanceof Error ? e.message : "読み込みに失敗しました。");
    }
  }
  useEffect(() => {
    void load();
    const hash = () => {
      const h = location.hash.slice(1);
      setPage(pages.includes(h as Page) ? (h as Page) : "home");
    };
    const network = () => setOffline(!navigator.onLine);
    const prompt = (e: Event) => {
      e.preventDefault();
      setInstall(e);
    };
    addEventListener("hashchange", hash);
    addEventListener("online", network);
    addEventListener("offline", network);
    addEventListener("beforeinstallprompt", prompt);
    return () => {
      removeEventListener("hashchange", hash);
      removeEventListener("online", network);
      removeEventListener("offline", network);
      removeEventListener("beforeinstallprompt", prompt);
    };
  }, []);
  useEffect(() => {
    const ready = () => setOfflineReady(true);
    const failed = () => setOfflineFailed(true);
    document.addEventListener("kitchen-offline-ready", ready);
    document.addEventListener("kitchen-sw-failed", failed);
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller)
      setOfflineReady(true);
    return () => {
      document.removeEventListener("kitchen-offline-ready", ready);
      document.removeEventListener("kitchen-sw-failed", failed);
    };
  }, []);
  useEffect(() => {
    if (!data) return;
    const pref = data.preferences.theme;
    document.documentElement.dataset.theme = pref;
  }, [data?.preferences.theme]);
  const change: AppProps["change"] = (mutate) =>
    new Promise((resolve) => {
      queue.current = queue.current.then(async () => {
        if (!current.current) {
          resolve(false);
          return;
        }
        setStatus("保存中…");
        setError("");
        try {
          const next = structuredClone(current.current.data);
          mutate(next);
          const saved = await saveState(next, current.current.revision);
          current.current = saved;
          setData(saved.data);
          setStatus("この端末に保存済み");
          resolve(true);
        } catch (e) {
          setStatus("未保存");
          setError(e instanceof Error ? e.message : "保存できませんでした。");
          resolve(false);
        }
      });
    });
  function openRun(id: string) {
    setRunId(id);
    try {
      sessionStorage.setItem("kitchen-current-run", id);
    } catch {}
    go(
      ["leftovers", "done"].includes(
        current.current?.data.runs.find((r) => r.id === id)?.stage ?? "",
      )
        ? "leftovers"
        : "cooking",
    );
  }
  function openAI(q = "", id?: string) {
    setQuestion(q);
    setRunId(id);
    go("assistant");
  }
  async function startRecipe(
    id: string,
    servings?: number,
    suggestion?: Recipe,
  ) {
    try {
      let runId: string | undefined;
      if (
        await change((d) => {
          let recipe = d.recipes.find((r) => r.id === id);
          if (!recipe && suggestion?.id === id) {
            recipe = structuredClone(suggestion);
            d.recipes.push(recipe);
          }
          if (!recipe)
            throw Error(
              "レシピが見つかりません。レシピ一覧を確認してください。",
            );
          const run = createRun(recipe, servings ?? d.preferences.servings);
          d.runs.push(run);
          runId = run.id;
        })
      ) {
        if (runId) openRun(runId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "食数を確認してください。");
    }
  }
  const props = data ? { data, change, openAI, startRecipe, openRun } : null;
  return (
    <div className="shell">
      <header className="app-header">
        <a href="#home" className="brand" aria-label="ホームへ">
          ◒ <span>Kitchen</span>
          <small>料理の迷いを、ひとつずつ。</small>
        </a>
        <span className="offline-pill">
          {offline ? "オフライン" : "端末内保存"}
        </span>
      </header>
      <main>
        <div className="save-status" role="status" aria-live="polite">
          {status}
        </div>
        {offline && (
          <p className="notice">
            料理・買い物・記録は使えます。ChatGPTでの相談はオンラインで行ってください。
          </p>
        )}
        {error && (
          <div role="alert" className="alert">
            {error}
            <button className="button secondary" onClick={() => void load()}>
              最新データを再読込
            </button>
          </div>
        )}
        {props ? (
          page === "home" ? (
            <Home {...props} go={go} />
          ) : page === "library" ? (
            <Library {...props} />
          ) : page === "shopping" ? (
            <Shopping {...props} />
          ) : page === "cooking" ? (
            <Cooking {...props} runId={runId} />
          ) : page === "leftovers" ? (
            <Leftovers {...props} runId={runId} />
          ) : page === "assistant" ? (
            <Assistant {...props} question={question} runId={runId} />
          ) : (
            <div className="stack">
              <Preferences {...props} />
              <section className="panel">
                <h2>ホーム画面に追加</h2>
                <p role="status">
                  {offlineReady
                    ? "オフライン準備済み"
                    : offlineFailed
                      ? "オフライン準備に失敗しました。通信中に再読み込みしてください。"
                      : import.meta.env.PROD
                        ? "オフライン用の準備中です。初回は通信を保ってください。"
                        : "開発モードです。オフライン利用は本番ビルドで確認できます。"}
                </p>
                <p>
                  iPhoneはSafariの共有メニューから「ホーム画面に追加」。AndroidはChromeのメニューからインストールできます。初回表示後はオフラインでも主要機能を使えます。
                </p>
                {install && (
                  <button
                    className="button"
                    onClick={async () => {
                      await (
                        install as Event & { prompt: () => Promise<void> }
                      ).prompt();
                      setInstall(null);
                    }}
                  >
                    アプリをインストール
                  </button>
                )}
                <p className="muted">
                  バックグラウンドのタイマー音は保証されません。端末の時計でも確認してください。
                </p>
              </section>
              <DataTools {...props} />
            </div>
          )
        ) : (
          <section className="panel">
            <h1>Kitchen</h1>
            {error ? (
              <Recovery reload={load} />
            ) : (
              <p>保存データを確認しています。</p>
            )}
          </section>
        )}
      </main>
      <nav className="bottom-nav" aria-label="メインナビゲーション">
        {[
          { id: "home", label: "ホーム", icon: "⌂" },
          { id: "library", label: "料理", icon: "♧" },
          { id: "leftovers", label: "作り置き", icon: "▣" },
          { id: "settings", label: "設定", icon: "⚙" },
        ].map((n) => (
          <button
            key={n.id}
            className={
              page === n.id ||
              (n.id === "library" &&
                ["cooking", "shopping", "assistant"].includes(page))
                ? "active"
                : ""
            }
            aria-current={page === n.id ? "page" : undefined}
            onClick={() => go(n.id)}
          >
            <span aria-hidden>{n.icon}</span>
            {n.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
