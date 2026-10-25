import { useState, type FormEvent } from "react";
import type { AppProps, Preferences as PreferencesData } from "../types";

const tools = [
  "炊飯器",
  "フライパン",
  "鍋",
  "電子レンジ",
  "包丁・まな板",
  "保存容器",
  "温度計",
];

export function Preferences({ data, change }: AppProps) {
  const [form, setForm] = useState<PreferencesData>(() =>
    structuredClone(data.preferences),
  );
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const patch = <K extends keyof PreferencesData>(
    key: K,
    value: PreferencesData[K],
  ) => setForm((previous) => ({ ...previous, [key]: value }));
  async function save(event: FormEvent) {
    event.preventDefault();
    setNotice("");
    if (
      !Number.isInteger(form.people) ||
      form.people < 1 ||
      form.people > 12 ||
      !Number.isInteger(form.servings) ||
      form.servings < 1 ||
      form.servings > 12
    ) {
      setNotice("人数と基本食数は1〜12の整数で指定してください。");
      return;
    }
    if (
      !Number.isFinite(form.minutes) ||
      form.minutes < 1 ||
      form.minutes > 1440
    ) {
      setNotice("調理時間は1〜1440分で指定してください。");
      return;
    }
    setBusy(true);
    try {
      if (
        await change((draft) => {
          draft.preferences = structuredClone(form);
        })
      )
        setNotice("設定を保存しました。次のAI相談から引き継ぎます。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="stack" aria-labelledby="preferences-title">
      <header>
        <p className="eyebrow">一度決めたことは、繰り返さない。</p>
        <h1 id="preferences-title">いつもの料理設定</h1>
        <p className="muted">
          必要なところだけ変更できます。AI相談文に引き継ぎ、外部へは自動送信しません。
        </p>
      </header>
      <form className="panel stack" onSubmit={save}>
        <div className="form-grid">
          <label className="field">
            利用人数
            <input
              type="number"
              min="1"
              max="12"
              step="1"
              required
              value={form.people}
              onChange={(event) => patch("people", Number(event.target.value))}
            />
          </label>
          <label className="field">
            基本の調理量（食分）
            <input
              type="number"
              min="1"
              max="12"
              step="1"
              required
              value={form.servings}
              onChange={(event) =>
                patch("servings", Number(event.target.value))
              }
            />
          </label>
          <label className="field">
            好みの味
            <input
              value={form.tastes}
              onChange={(event) => patch("tastes", event.target.value)}
              placeholder="例：ご飯に合うしょうゆ味"
            />
          </label>
          <label className="field">
            苦手な料理・食材
            <input
              value={form.dislikes}
              onChange={(event) => patch("dislikes", event.target.value)}
              placeholder="例：辛い料理、セロリ"
            />
          </label>
          <div className="field wide">
            <label htmlFor="preferences-allergies">
              アレルギー・食事制限の注意
            </label>
            <textarea
              id="preferences-allergies"
              aria-describedby="preferences-allergies-help"
              value={form.allergies}
              onChange={(event) => patch("allergies", event.target.value)}
              placeholder="未入力なら未確認として引き継ぎます"
            />
            <small className="muted" id="preferences-allergies-help">
              注意喚起用です。AIやアプリは安全性を判定しません。食品・調味料の表示を本人が確認してください。
            </small>
          </div>
          <label className="field">
            希望する調理時間（分）
            <input
              type="number"
              min="1"
              max="1440"
              step="1"
              required
              value={form.minutes}
              onChange={(event) => patch("minutes", Number(event.target.value))}
            />
          </label>
          <label className="field">
            大切にしたいこと
            <input
              value={form.priorities}
              onChange={(event) => patch("priorities", event.target.value)}
              placeholder="例：安さ・美味しさ・少ない洗い物"
            />
          </label>
          <div className="field wide">
            <label htmlFor="preferences-use-up">今回使い切りたい食材</label>
            <textarea
              id="preferences-use-up"
              aria-describedby="preferences-use-up-help"
              value={form.useUp}
              onChange={(event) => patch("useUp", event.target.value)}
              placeholder="今あると確認した食材だけ。使ったら更新できます"
            />
            <small className="muted" id="preferences-use-up-help">
              在庫台帳ではありません。過去の食材が今もあるとは推定しません。
            </small>
          </div>
        </div>
        <fieldset>
          <legend>使用できる器具</legend>
          <div className="row">
            {[...new Set([...tools, ...form.equipment])].map((tool) => (
              <label className="check" key={tool}>
                <input
                  type="checkbox"
                  checked={form.equipment.includes(tool)}
                  onChange={(event) =>
                    patch(
                      "equipment",
                      event.target.checked
                        ? [...form.equipment, tool]
                        : form.equipment.filter((item) => item !== tool),
                    )
                  }
                />
                {tool}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="field">
          画面の配色
          <select
            value={form.theme}
            onChange={(event) =>
              patch("theme", event.target.value as PreferencesData["theme"])
            }
          >
            <option value="system">端末に合わせる</option>
            <option value="light">ライト</option>
            <option value="dark">ダーク</option>
          </select>
        </label>
        <button className="button" disabled={busy}>
          {busy ? "保存中…" : "設定を保存"}
        </button>
        {notice && <p role="status">{notice}</p>}
      </form>
      <section className="panel">
        <h2>追加料金を発生させない仕組み</h2>
        <p>
          ChatGPTへの相談は、相談文をコピーして公式サイトやアプリで行います。このアプリにAPIキーや決済情報を登録する機能はありません。ChatGPTの有料契約とAPI料金は別です。
        </p>
        <p className="muted">
          データはこのブラウザ内に保存します。端末間の自動同期はありません。ブラウザのデータを消す前に、バックアップを保存してください。
        </p>
      </section>
    </section>
  );
}
