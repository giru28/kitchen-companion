import { useState } from "react";
import { migrateData, readRawState, recoverState } from "../store";
import type { KitchenData } from "../types";
export function Recovery({ reload }: { reload: () => Promise<void> }) {
  const [data, setData] = useState<KitchenData | null>(null);
  const [message, setMessage] = useState("");
  async function original() {
    try {
      const raw = await readRawState();
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(raw, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "kitchen-recovery-original.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setMessage(
        "元の記録を出力できませんでした。ブラウザのデータを消さずに保管してください。",
      );
    }
  }
  return (
    <section className="panel stack">
      <h2>バックアップから復旧する</h2>
      <p>
        保存データは自動で初期化しません。ほかのKitchenタブを閉じ、まず元の記録を保全してください。検証できたバックアップだけを確認後に復元できます。
      </p>
      <button className="button secondary" onClick={() => void original()}>
        元の記録を保全する
      </button>
      <label className="field">
        復旧用バックアップJSON
        <input
          type="file"
          accept=".json,application/json"
          onChange={async (e) => {
            setData(null);
            setMessage("");
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              if (f.size > 5e6)
                throw Error("5MB以下のバックアップを選んでください。");
              setData(migrateData(JSON.parse(await f.text())));
            } catch (error) {
              setMessage(
                error instanceof Error
                  ? error.message
                  : "バックアップを確認してください。",
              );
            }
          }}
        />
      </label>
      {data && (
        <div className="notice">
          <h3>復旧前の確認</h3>
          <p>
            レシピ{data.recipes.length}件・料理{data.runs.length}
            件で、端末内の全記録を置き換えます。
          </p>
          <button
            className="button"
            onClick={async () => {
              if (
                !confirm(
                  "ほかのタブを閉じ、元の記録を保全しましたか？ このバックアップで全データを置き換えます。",
                )
              )
                return;
              try {
                await recoverState(data);
                await reload();
              } catch {
                setMessage(
                  "復旧できませんでした。元の記録は自動削除していません。",
                );
              }
            }}
          >
            確認してバックアップから復旧
          </button>
        </div>
      )}
      {message && (
        <p role="alert" className="alert">
          {message}
        </p>
      )}
    </section>
  );
}
