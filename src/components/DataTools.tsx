import { useState } from "react";
import type { AppProps, KitchenData } from "../types";
import { backup, migrateData } from "../store";
export function DataTools({ data, change }: AppProps) {
  const [preview, setPreview] = useState<KitchenData | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(backup(data), null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `kitchen-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function pick(file: File | undefined) {
    setPreview(null);
    setError("");
    if (!file) return;
    if (file.size > 5e6) {
      setError("バックアップは5MB以下で選んでください。");
      return;
    }
    try {
      setPreview(migrateData(JSON.parse(await file.text())));
    } catch (e) {
      setError(e instanceof Error ? e.message : "形式を確認してください。");
    }
  }
  async function restore() {
    if (
      !preview ||
      !confirm(
        "現在の全データを置き換えます。先にバックアップを保存してください。復元しますか？",
      )
    )
      return;
    const d = preview;
    if (
      await change((draft) => {
        Object.assign(draft, d);
      })
    ) {
      setPreview(null);
      setMessage("復元しました。");
    }
  }
  return (
    <section className="panel stack">
      <h2>データを守る</h2>
      <p className="muted">
        このブラウザ内だけに保存します。端末間では同期しません。ブラウザのデータ消去・URL変更・端末変更で記録を失うことがあるため、バックアップを保存してください。
      </p>
      <button className="button" onClick={download}>
        バックアップを保存
      </button>
      <label className="field">
        バックアップJSON
        <input
          type="file"
          accept=".json,application/json"
          onChange={(e) => void pick(e.target.files?.[0])}
        />
      </label>
      {preview && (
        <div className="notice">
          <h3>復元前の確認</h3>
          <p>
            レシピ{preview.recipes.length}件・料理{preview.runs.length}件・評価
            {preview.ratings.length}
            件。設定とタイマーを含む現在の全データを置き換えます。
          </p>
          <div className="row">
            <button className="button" onClick={() => void restore()}>
              確認して復元
            </button>
            <button
              className="button secondary"
              onClick={() => setPreview(null)}
            >
              取り消す
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <p className="muted">
        バックアップには好み・アレルギー等も含まれます。安全な場所に保管してください。共有端末の同じブラウザを使う人は記録を閲覧できます。
      </p>
    </section>
  );
}
