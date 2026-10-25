import type { KitchenData, Preferences } from "./types";
import { initialRecipes } from "./domain/recipes";
import { validateData } from "./domain/validation";
export const defaultPreferences: Preferences = {
  people: 2,
  servings: 6,
  tastes: "安くて美味しい、手軽な家庭料理",
  dislikes: "",
  allergies: "",
  equipment: ["フライパン", "鍋", "炊飯器", "電子レンジ"],
  minutes: 45,
  priorities: "コスパ・美味しさ・手軽さ。作り置きと使い切り重視",
  useUp: "",
  theme: "system",
};
export function initialData(): KitchenData {
  return {
    version: 1,
    preferences: {
      ...defaultPreferences,
      equipment: [...defaultPreferences.equipment],
    },
    recipes: initialRecipes(),
    runs: [],
    ratings: [],
    wish: "",
  };
}
export function migrateData(value: unknown): KitchenData {
  if (!value || typeof value !== "object")
    throw new Error("バックアップはJSONオブジェクトで指定してください。");
  const v = value as Record<string, unknown>;
  if (v.format === "kitchen-companion" && v.version !== 1)
    throw new Error("対応していないバックアップ形式のバージョンです。");
  const input = v.format === "kitchen-companion" ? v.data : v;
  if (!input || typeof input !== "object")
    throw new Error("バックアップにdataがありません。");
  const d = input as Record<string, unknown>;
  if (d.version === 0) {
    return validateData({
      ...d,
      version: 1,
      preferences: {
        ...defaultPreferences,
        ...Object.fromEntries(
          Object.entries((d.preferences as object) || {}).filter(
            ([, v]) => v !== undefined,
          ),
        ),
      },
    });
  }
  if (d.version !== 1)
    throw new Error(
      "対応していないデータバージョンです。保存データは変更していません。",
    );
  return validateData(input);
}
export function backup(data: KitchenData) {
  return {
    format: "kitchen-companion",
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
}
let connection: Promise<IDBDatabase> | undefined;
function openDB() {
  connection ||= new Promise<IDBDatabase>((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(
        Error(
          "端末内の保存機能が使えません。通常モードのSafari/Chromeで開いてください。",
        ),
      );
      return;
    }
    const request = indexedDB.open("kitchen-assistant-v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("state");
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () =>
      reject(
        Error(
          "保存領域を開けません。ブラウザのデータは消さず、バックアップを確認してください。",
        ),
      );
    request.onblocked = () =>
      reject(
        Error(
          "別のタブを閉じて再読み込みしてください。保存データは変更していません。",
        ),
      );
  });
  return connection;
}
export interface Saved {
  revision: number;
  data: KitchenData;
}
export async function readRawState(): Promise<unknown> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = db
      .transaction("state", "readonly")
      .objectStore("state")
      .get("main");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        Error(
          "元の記録を読み取れませんでした。ブラウザのデータは削除しないでください。",
        ),
      );
  });
}
// Recovery is only exposed behind an explicit, destructive-restore confirmation.
export async function recoverState(data: KitchenData): Promise<void> {
  const valid = validateData(data);
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("state", "readwrite");
    const store = tx.objectStore("state");
    const request = store.get("main");
    request.onsuccess = () => {
      const r = request.result?.revision;
      store.put(
        {
          data: valid,
          revision:
            Number.isSafeInteger(r) && r >= 0 && r < Number.MAX_SAFE_INTEGER
              ? r + 1
              : 0,
        },
        "main",
      );
    };
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () =>
      reject(Error("復旧できませんでした。元の記録は保持しています。"));
  });
}
export async function readState(): Promise<Saved> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("state", "readwrite");
    const store = tx.objectStore("state");
    const request = store.get("main");
    let state: Saved;
    request.onsuccess = () => {
      try {
        if (request.result !== undefined) {
          if (
            !Number.isSafeInteger(request.result.revision) ||
            request.result.revision < 0
          )
            throw Error();
          state = {
            revision: request.result.revision,
            data: migrateData(request.result.data),
          };
        } else {
          state = { revision: 0, data: initialData() };
          store.put(state, "main");
        }
      } catch {
        tx.abort();
      }
    };
    tx.oncomplete = () => resolve(state);
    tx.onerror = tx.onabort = () =>
      reject(
        Error(
          "保存データを読み込めませんでした。自動初期化は行いません。バックアップを確認してください。",
        ),
      );
  });
}
export async function saveState(
  data: KitchenData,
  revision: number,
): Promise<Saved> {
  if (
    !Number.isSafeInteger(revision) ||
    revision < 0 ||
    revision >= Number.MAX_SAFE_INTEGER
  )
    throw new Error("保存のバージョン番号を確認してください。");
  const valid = validateData(data);
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("state", "readwrite");
    const store = tx.objectStore("state");
    const request = store.get("main");
    let message =
      "保存に失敗しました。容量やブラウザの保存設定を確認してください。";
    const next = { revision: revision + 1, data: valid };
    request.onsuccess = () => {
      if (!request.result || request.result.revision !== revision) {
        message =
          "別のタブで更新されています。最新データを再読込して、もう一度操作してください。";
        tx.abort();
        return;
      }
      store.put(next, "main");
    };
    tx.oncomplete = () => resolve(next);
    tx.onerror = tx.onabort = () => reject(Error(message));
  });
}
