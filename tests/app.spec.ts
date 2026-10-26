import { test, expect, type Page, type Locator } from "@playwright/test";
import type { KitchenData, Recipe, CookingRun } from "../src/types";

test.describe.configure({ timeout: 60000 });

async function state(page: Page): Promise<KitchenData> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("kitchen-assistant-v1", 1);
        request.onerror = () =>
          reject(new Error("テスト用IndexedDBを読めません"));
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("state", "readonly");
          const get = tx.objectStore("state").get("main");
          get.onsuccess = () => resolve(get.result.data);
          get.onerror = () => reject(get.error);
          tx.oncomplete = () => db.close();
        };
      }),
  );
}
async function home(page: Page) {
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "今日は何作ろう？", exact: true }),
  ).toBeVisible();
}
async function navigate(page: Page, name: string) {
  await page
    .getByRole("navigation")
    .getByRole("button", { name, exact: true })
    .click();
}
function recipeCard(page: Page, title: string): Locator {
  return page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
}
async function saved(page: Page) {
  await expect(
    page.getByRole("status").filter({ hasText: "この端末に保存済み" }),
  ).toBeVisible();
}
const rawRecipe = {
  title: "E2Eの鶏ご飯",
  description: "架空のテストレシピ。実際の調理・購入は行いません。",
  baseServings: 6,
  ingredients: [
    {
      id: "rice",
      name: "米",
      quantity: 600,
      unit: "g",
      category: "grain",
      note: "製品・炊飯器の表示に従う",
    },
    {
      id: "chicken",
      name: "鶏肉",
      quantity: 600,
      unit: "g",
      category: "meat",
      note: "生肉と加熱後の器具を分ける",
    },
  ],
  prep: [
    {
      id: "prep-1",
      order: 1,
      title: "下準備をする",
      instructions: ["清潔な器具を用意して野菜を先、生肉を最後に準備する。"],
      heat: "火を使わない",
      minutes: 5,
      equipment: ["包丁"],
      ingredientIds: ["chicken"],
    },
  ],
  cook: [
    {
      id: "cook-1",
      order: 1,
      title: "中心まで加熱する",
      instructions: [
        "鶏肉の中心まで十分に加熱する。加熱後は清潔な器具を使う。",
      ],
      heat: "中火",
      minutes: 10,
      equipment: ["フライパン"],
      ingredientIds: ["chicken"],
    },
  ],
  storageNotes: [
    "清潔な浅い容器へ小分けし、速やかに冷却して冷蔵・冷凍へ収納する。常温に放置しない。予定日は安全期限ではない。",
  ],
  reheat: [
    {
      id: "reheat-1",
      order: 1,
      title: "保存状態を確認して再加熱する",
      instructions: [
        "保存状態が不明なら安全と判断せず、取り出す食数だけ中心まで十分に再加熱する。",
      ],
      heat: "製品表示に従う",
      minutes: null,
      equipment: ["電子レンジ"],
      ingredientIds: ["rice", "chicken"],
    },
  ],
  equipment: ["炊飯器", "フライパン", "電子レンジ"],
};
function aiJSON(recipe = rawRecipe) {
  return JSON.stringify({ schemaVersion: 1, kind: "recipe", recipe }, null, 2);
}
async function assistant(page: Page) {
  await navigate(page, "ホーム");
  await page
    .getByRole("button", { name: "AIに献立を相談", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "AIに相談する", exact: true }),
  ).toBeVisible();
}
async function previewAnswer(page: Page, text: string) {
  await page.getByLabel("ChatGPTのJSON回答", { exact: true }).fill(text);
  await page
    .getByRole("button", { name: "回答の内容を確認", exact: true })
    .click();
}

test("初期設定の二人・六食と個人設定を保存し、再読込しても同じ条件で使える", async ({
  page,
}) => {
  await home(page);
  const initial = await state(page);
  expect(initial.preferences.people).toBe(2);
  expect(initial.preferences.servings).toBe(6);
  expect(initial.recipes).toHaveLength(3);
  await navigate(page, "設定");
  await page.getByLabel("好みの味", { exact: true }).fill("しょうがの味が好き");
  await page.getByLabel("苦手な料理・食材", { exact: true }).fill("パクチー");
  await page
    .getByLabel("今回使い切りたい食材", { exact: true })
    .fill("にんじんとキャベツ");
  await page.getByRole("button", { name: "設定を保存", exact: true }).click();
  await saved(page);
  await page.reload();
  await navigate(page, "設定");
  await expect(page.getByLabel("好みの味", { exact: true })).toHaveValue(
    "しょうがの味が好き",
  );
  expect((await state(page)).preferences.dislikes).toBe("パクチー");
});

test("サンプルをお気に入り・複製・編集・評価でき、確認した削除だけ反映する", async ({
  page,
}) => {
  await home(page);
  await navigate(page, "料理");
  const first = (await state(page)).recipes[0];
  await recipeCard(page, first.title)
    .getByRole("button", {
      name: `${first.title}をお気に入りにする`,
      exact: true,
    })
    .click();
  await expect
    .poll(
      async () =>
        (await state(page)).recipes.find((r) => r.id === first.id)?.favorite,
    )
    .toBe(true);
  await recipeCard(page, first.title)
    .getByRole("button", { name: `${first.title}を複製`, exact: true })
    .click();
  const cloneTitle = `${first.title}（コピー）`;
  await expect(recipeCard(page, cloneTitle)).toBeVisible();
  await recipeCard(page, cloneTitle)
    .getByRole("button", { name: `${cloneTitle}を編集`, exact: true })
    .click();
  await page.getByLabel("料理名", { exact: true }).fill("E2E自分の味付け");
  await page.getByRole("button", { name: "レシピを保存", exact: true }).click();
  const clone = recipeCard(page, "E2E自分の味付け");
  await expect(clone).toBeVisible();
  await clone.getByRole("button", { name: "評価する", exact: true }).click();
  await clone
    .getByRole("combobox", { name: "料理の評価", exact: true })
    .selectOption("4");
  await clone
    .getByLabel("味・次回のメモ", { exact: true })
    .fill("次は少し薄味で");
  await clone.getByRole("button", { name: "評価を保存", exact: true }).click();
  await expect(clone).toContainText("4.0/5");
  page.once("dialog", (d) => d.dismiss());
  await clone
    .getByRole("button", { name: "E2E自分の味付けを削除", exact: true })
    .click();
  await expect(clone).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await clone
    .getByRole("button", { name: "E2E自分の味付けを削除", exact: true })
    .click();
  await expect(clone).toHaveCount(0);
  expect(
    (await state(page)).ratings.some((r) => r.note === "次は少し薄味で"),
  ).toBe(true);
  await page.reload();
  await navigate(page, "料理");
  await expect(recipeCard(page, "E2E自分の味付け")).toHaveCount(0);
  expect(
    (await state(page)).recipes.find((r) => r.id === first.id)?.favorite,
  ).toBe(true);
});

test("食数を1〜12へ変更して材料を再計算し、単位の違う材料は勝手に換算しない", async ({
  page,
}) => {
  await home(page);
  await navigate(page, "料理");
  const first = (await state(page)).recipes[0];
  const card = recipeCard(page, first.title);
  await page.getByLabel("今回作る食数", { exact: true }).fill("1");
  await card.getByText("1食分の材料と手順", { exact: true }).click();
  const rice = first.ingredients.find((i) => i.category === "grain")!;
  await expect(card).toContainText(
    String(Math.round((rice.quantity / 6) * 100) / 100),
  );
  await page.getByLabel("今回作る食数", { exact: true }).fill("12");
  await expect(card).toContainText(`${rice.name} ${rice.quantity * 2}`);
  await card
    .getByRole("button", { name: "この料理を12食分作る", exact: true })
    .click();
  await expect.poll(async () => (await state(page)).runs[0]?.servings).toBe(12);
  const run = (await state(page)).runs[0];
  expect(run.shopping.find((i) => i.ingredientId === rice.id)?.unit).toBe(
    rice.unit,
  );
});

test("保存済み設定・使い切り食材を相談文に引き継ぎ、コピー失敗でも手動操作へ戻れる", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    }),
  );
  await home(page);
  await navigate(page, "設定");
  await page.getByLabel("苦手な料理・食材", { exact: true }).fill("パクチー");
  await page
    .getByLabel("今回使い切りたい食材", { exact: true })
    .fill("にんじんとキャベツ");
  await page.getByRole("button", { name: "設定を保存", exact: true }).click();
  await saved(page);
  await assistant(page);
  await page
    .getByLabel("相談したいこと", { exact: true })
    .fill("濃い味のおかずを6食分作りたい");
  // Clipboard failure must expose the fallback even when its details were closed.
  await page
    .getByRole("button", { name: "相談文をコピー", exact: true })
    .click();
  const prompt = page.getByLabel("ChatGPTへ渡す相談文", { exact: true });
  await expect(prompt).toHaveValue(/パクチー/);
  await expect(prompt).toHaveValue(/にんじんとキャベツ/);
  await expect(prompt).toHaveValue(/濃い味のおかずを6食分作りたい/);
  await expect(prompt).toBeFocused();
  expect(
    await prompt.evaluate(
      (element: HTMLTextAreaElement) =>
        element.selectionEnd - element.selectionStart,
    ),
  ).toBeGreaterThan(100);
  await expect(
    page.getByRole("status").filter({ hasText: "相談文を選択しました" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "ChatGPTを開く ↗", exact: true }),
  ).toHaveAttribute("href", "https://chatgpt.com/");
  await expect(page.locator("main")).toContainText(
    "自動入力・自動送信はしません",
  );
  expect(page.context().pages()).toHaveLength(1);
});

test("説明文付きJSONを確認後だけ登録でき、不正JSONと不正工程番号は記録を変えず拒否する", async ({
  page,
}) => {
  await home(page);
  await assistant(page);
  await previewAnswer(
    page,
    "おすすめはこちらです。\n```json\n" +
      aiJSON() +
      "\n```\n内容を確認してください。",
  );
  await expect(
    page.getByRole("heading", { name: "3. 取り込む前に確認", exact: true }),
  ).toBeVisible();
  expect((await state(page)).recipes).toHaveLength(3);
  await expect(
    page.getByRole("button", { name: "確認してレシピを登録", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("材料量・手順・安全上の注意を確認した", { exact: true })
    .check();
  await page
    .getByRole("button", { name: "確認してレシピを登録", exact: true })
    .click();
  await expect.poll(async () => (await state(page)).recipes.length).toBe(4);
  await previewAnswer(page, '{"schemaVersion":1,"recipe":');
  await expect(page.getByRole("alert")).toContainText("JSON");
  expect((await state(page)).recipes).toHaveLength(4);
  const wrong = structuredClone(rawRecipe);
  wrong.cook[0].order = 9;
  await previewAnswer(page, aiJSON(wrong));
  await expect(page.getByRole("alert")).toContainText("order");
  expect((await state(page)).recipes).toHaveLength(4);
  await navigate(page, "料理");
  await expect(recipeCard(page, rawRecipe.title)).toBeVisible();
});

test("AIのHTML風の文字列を実行せずテキストとして安全に表示する", async ({
  page,
}) => {
  await home(page);
  await assistant(page);
  const title = '<img src=x onerror="window.e2eInjected=true">';
  await previewAnswer(page, aiJSON({ ...rawRecipe, title }));
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      Boolean((window as unknown as { e2eInjected?: boolean }).e2eInjected),
    ),
  ).toBe(false);
  expect(await page.locator("main img").count()).toBe(0);
  await page
    .getByLabel("材料量・手順・安全上の注意を確認した", { exact: true })
    .check();
  await page
    .getByRole("button", { name: "確認してレシピを登録", exact: true })
    .click();
  await expect.poll(async () => (await state(page)).recipes.length).toBe(4);
  await navigate(page, "料理");
  await expect(recipeCard(page, title)).toBeVisible();
  expect(await page.locator("main img").count()).toBe(0);
});

test("JSONバックアップのプレビューと確認復元で端末内のデータを保持する", async ({
  page,
}) => {
  await home(page);
  await navigate(page, "設定");
  const wait = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "バックアップを保存", exact: true })
    .click();
  expect((await wait).suggestedFilename()).toMatch(/\.json$/);
  const replacement = await state(page);
  replacement.preferences.tastes = "E2E復元した好み";
  await page.getByLabel("バックアップJSON", { exact: true }).setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(replacement)),
  });
  await expect(
    page.getByRole("heading", { name: "復元前の確認", exact: true }),
  ).toBeVisible();
  expect((await state(page)).preferences.tastes).not.toBe("E2E復元した好み");
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "確認して復元", exact: true }).click();
  expect((await state(page)).preferences.tastes).not.toBe("E2E復元した好み");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "確認して復元", exact: true }).click();
  await expect
    .poll(async () => (await state(page)).preferences.tastes)
    .toBe("E2E復元した好み");
  await page.reload();
  await navigate(page, "設定");
  await expect(page.getByLabel("好みの味", { exact: true })).toHaveValue(
    "E2E復元した好み",
  );
});

test("PWAの準備後はオフライン再読み込みでレシピと保存した設定を使える", async ({
  page,
  context,
}) => {
  await home(page);
  await navigate(page, "設定");
  await page
    .getByLabel("好みの味", { exact: true })
    .fill("オフラインに残る好み");
  await page.getByRole("button", { name: "設定を保存", exact: true }).click();
  await saved(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.evaluate(async () => {
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        ),
      );
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("main")).toBeVisible();
  await navigate(page, "料理");
  await expect(
    page.getByRole("heading", { name: "料理を選ぶ", exact: true }),
  ).toBeVisible();
  expect((await state(page)).recipes).toHaveLength(3);
  await navigate(page, "設定");
  await expect(page.getByLabel("好みの味", { exact: true })).toHaveValue(
    "オフラインに残る好み",
  );
});

test("390px幅ですべての主画面を操作でき、バックグラウンドで有料APIへ送信しない", async ({
  page,
  baseURL,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => {
    const url = new URL(r.url());
    if (url.origin !== new URL(baseURL!).origin || r.method() !== "GET")
      requests.push(r.url());
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await home(page);
  for (const name of ["ホーム", "料理", "作り置き", "設定"]) {
    await navigate(page, name);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      name,
    ).toBe(true);
  }
  expect(requests).toEqual([]);
});

async function importTestRecipe(page: Page) {
  await home(page);
  await assistant(page);
  await previewAnswer(page, aiJSON());
  await page
    .getByLabel("材料量・手順・安全上の注意を確認した", { exact: true })
    .check();
  await page
    .getByRole("button", { name: "確認してレシピを登録", exact: true })
    .click();
  await expect.poll(async () => (await state(page)).recipes.length).toBe(4);
  await navigate(page, "料理");
  await recipeCard(page, rawRecipe.title)
    .getByRole("button", { name: "この料理を6食分作る", exact: true })
    .click();
  await expect.poll(async () => (await state(page)).runs.length).toBe(1);
}
async function procure(page: Page) {
  const items = (await state(page)).runs[0].shopping;
  for (const item of items) {
    const name = item.name;
    await page
      .getByRole("button", { name: `${name}を購入した`, exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await state(page)).runs[0].shopping.find((s) => s.name === name)
            ?.boughtQuantity,
      )
      .toBe(item.quantity);
  }
  await page
    .getByRole("button", { name: "材料を確認して料理を進める", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "現在の調理工程" }),
  ).toBeVisible();
}

test("調理とタイマーを再開し、実際6食→当日2食・冷凍4食→後日2食ずつ食べ切る", async ({
  page,
}) => {
  await importTestRecipe(page);
  await procure(page);
  await page.getByLabel("タイマーの分数", { exact: true }).fill("3");
  await page.getByRole("button", { name: "タイマー開始", exact: true }).click();
  await expect
    .poll(async () => (await state(page)).runs[0].timer?.endAt)
    .toBeGreaterThan(Date.now());
  const end = (await state(page)).runs[0].timer!.endAt;
  await page.reload();
  await expect(
    page.getByRole("region", { name: "現在の調理工程" }),
  ).toBeVisible();
  expect((await state(page)).runs[0].timer!.endAt).toBe(end);
  for (let i = 1; i <= 2; i++) {
    await page
      .getByRole("button", { name: "この工程を完了して次へ", exact: true })
      .click();
    await expect
      .poll(async () => (await state(page)).runs[0].completed.length)
      .toBe(i);
  }
  await expect(
    page.getByRole("heading", { name: "完成した量と保存を記録", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "完成量と保存を記録", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("確認");
  for (const label of [
    "料理の中心まで十分に加熱したことを確認",
    "清潔な浅い容器へ小分けし、常温放置せず速やかに冷却",
    "実際に冷蔵・冷凍庫へ収納し、保存状態を確認",
  ])
    await page.getByLabel(label, { exact: true }).check();
  await page
    .getByRole("button", { name: "完成量と保存を記録", exact: true })
    .click();
  await expect
    .poll(async () => (await state(page)).runs[0].stage)
    .toBe("leftovers");
  await navigate(page, "作り置き");
  const detail = page.getByRole("region", { name: "作り置きの詳細" });
  await expect(detail).toBeVisible();
  await detail
    .getByRole("button", { name: "食べた分を記録", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("毎回");
  for (let remaining = 2; remaining >= 0; remaining -= 2) {
    const checks = detail.getByRole("checkbox");
    for (let i = 0; i < (await checks.count()); i++)
      await checks.nth(i).check();
    await detail.getByLabel("今回食べた食数", { exact: true }).fill("2");
    await detail
      .getByRole("button", { name: "食べた分を記録", exact: true })
      .click();
    await expect
      .poll(async () => (await state(page)).runs[0].lots[0].remaining)
      .toBe(remaining);
    await page.reload();
    await expect(detail).toBeVisible();
  }
  expect((await state(page)).runs[0].stage).toBe("done");
  await expect(detail).toContainText("食べ切り");
});

test("作る食数の変更を完成量へ引き継ぎ、冷蔵分を食べ切ると冷凍分へ切り替わる", async ({
  page,
}) => {
  await importTestRecipe(page);
  await page.getByLabel("作る食数", { exact: true }).fill("4");
  await page.getByRole("button", { name: "分量を変更", exact: true }).click();
  await expect.poll(async () => (await state(page)).runs[0].servings).toBe(4);
  await procure(page);
  for (let i = 1; i <= 2; i++) {
    await page
      .getByRole("button", { name: "この工程を完了して次へ", exact: true })
      .click();
    await expect
      .poll(async () => (await state(page)).runs[0].completed.length)
      .toBe(i);
  }
  await expect(
    page.getByLabel("実際に完成した食数", { exact: true }),
  ).toHaveValue("4");
  await expect(page.getByLabel("冷凍の残り食数", { exact: true })).toHaveValue(
    "2",
  );
  await page.getByLabel("冷蔵の残り食数", { exact: true }).fill("1");
  await page.getByLabel("冷凍の残り食数", { exact: true }).fill("1");
  for (const label of [
    "料理の中心まで十分に加熱したことを確認",
    "清潔な浅い容器へ小分けし、常温放置せず速やかに冷却",
    "実際に冷蔵・冷凍庫へ収納し、保存状態を確認",
  ])
    await page.getByLabel(label, { exact: true }).check();
  await page
    .getByRole("button", { name: "完成量と保存を記録", exact: true })
    .click();
  await expect
    .poll(async () => (await state(page)).runs[0].stage)
    .toBe("leftovers");
  await navigate(page, "作り置き");
  const detail = page.getByRole("region", { name: "作り置きの詳細" });
  await expect(
    detail.getByLabel("食べる保存分", { exact: true }),
  ).toContainText("冷蔵");
  await detail.getByLabel("今回食べた食数", { exact: true }).fill("1");
  const checks = detail.getByRole("checkbox");
  for (let i = 0; i < (await checks.count()); i++) await checks.nth(i).check();
  await detail
    .getByRole("button", { name: "食べた分を記録", exact: true })
    .click();
  const run = (await state(page)).runs[0];
  const frozen = run.lots.find((lot) => lot.method === "freezer")!;
  await expect(detail.getByLabel("食べる保存分", { exact: true })).toHaveValue(
    frozen.id,
  );
  await expect(
    detail.getByLabel("今回食べた食数", { exact: true }),
  ).toHaveValue("1");
  for (let i = 0; i < (await checks.count()); i++)
    await expect(checks.nth(i)).not.toBeChecked();
  for (let i = 0; i < (await checks.count()); i++) await checks.nth(i).check();
  await detail
    .getByRole("button", { name: "食べた分を記録", exact: true })
    .click();
  await expect.poll(async () => (await state(page)).runs[0].stage).toBe("done");
});

test("材料変更の差分と購入済みを保持し、完了工程を変えるAI修正を拒否する", async ({
  page,
}) => {
  await importTestRecipe(page);
  await procure(page);
  await page
    .getByRole("button", { name: "この工程を完了して次へ", exact: true })
    .click();
  await expect
    .poll(async () => (await state(page)).runs[0].completed.length)
    .toBe(1);
  const run = (await state(page)).runs[0];
  await page.getByRole("button", { name: "AIに質問", exact: true }).click();
  await page
    .getByText("生成した相談文を確認・手動コピー", { exact: true })
    .click();
  await expect(
    page.getByLabel("ChatGPTへ渡す相談文", { exact: true }),
  ).toHaveValue(new RegExp(run.id));
  const wrong = structuredClone(rawRecipe);
  wrong.prep[0].title = "完了工程を勝手に変更";
  await previewAnswer(
    page,
    JSON.stringify({
      schemaVersion: 1,
      kind: "revision",
      targetRunId: run.id,
      recipe: wrong,
    }),
  );
  await expect(
    page.getByRole("alert").filter({ hasText: "完了済み" }),
  ).toBeVisible();
  expect((await state(page)).runs[0].recipe.prep[0].title).toBe(
    rawRecipe.prep[0].title,
  );
  const revised = structuredClone(rawRecipe);
  revised.cook[0].instructions = ["フタを使わず、分けて中心まで十分加熱する。"];
  await previewAnswer(
    page,
    JSON.stringify({
      schemaVersion: 1,
      kind: "revision",
      targetRunId: run.id,
      recipe: revised,
    }),
  );
  await page
    .getByLabel("材料量・手順・安全上の注意を確認した", { exact: true })
    .check();
  await page
    .getByRole("button", { name: "確認して未完了の手順を更新", exact: true })
    .click();
  await expect
    .poll(
      async () => (await state(page)).runs[0].recipe.cook[0].instructions[0],
    )
    .toContain("フタを使わず");
  const after = (await state(page)).runs[0];
  expect(after.completed).toEqual(run.completed);
  expect(after.shopping.map((s) => s.boughtQuantity)).toEqual(
    run.shopping.map((s) => s.boughtQuantity),
  );
});

test("複数料理の同じ食材だけを合算し、確認量を各料理へ配賦する", async ({
  page,
}) => {
  await home(page);
  await navigate(page, "料理");
  const recipes = (await state(page)).recipes;
  for (const recipe of recipes.slice(0, 2)) {
    await navigate(page, "料理");
    await recipeCard(page, recipe.title)
      .getByRole("button", { name: "この料理を6食分作る", exact: true })
      .click();
    await saved(page);
  }
  await navigate(page, "ホーム");
  await page
    .getByRole("button", { name: "買い物リストを見る", exact: true })
    .click();
  const rice = page.getByTestId("shopping-group").filter({
    has: page.getByRole("heading", { name: "米（未炊飯）", exact: true }),
  });
  await expect(rice).toContainText("1,200");
  await rice
    .getByRole("button", { name: "米（未炊飯）を購入した", exact: true })
    .click();
  await expect
    .poll(async () =>
      (await state(page)).runs.reduce(
        (sum, r) =>
          sum +
          (r.shopping.find((i) => i.name === "米（未炊飯）")?.boughtQuantity ??
            0),
        0,
      ),
    )
    .toBe(1200);
});

for (const [name, invalid] of [
  ["未来バージョン", { revision: 99, data: { version: 999 } }],
  ["null", null],
  ["false", false],
] as const)
  test(`壊れた保存データ（${name}）を初期化せず、確認したバックアップから復旧できる`, async ({
    page,
  }) => {
    await home(page);
    const good = await state(page);
    await page.evaluate(
      (invalid) =>
        new Promise<void>((resolve, reject) => {
          const req = indexedDB.open("kitchen-assistant-v1", 1);
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction("state", "readwrite");
            tx.objectStore("state").put(invalid, "main");
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
            tx.onerror = () => reject(tx.error);
          };
        }),
      invalid,
    );
    await page.reload();
    await expect(
      page.getByRole("heading", {
        name: "バックアップから復旧する",
        exact: true,
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const request = indexedDB.open("kitchen-assistant-v1", 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
              const db = request.result;
              const tx = db.transaction("state", "readonly");
              const get = tx.objectStore("state").get("main");
              get.onsuccess = () => resolve(get.result);
              tx.oncomplete = () => db.close();
            };
          }),
      ),
    ).toEqual(invalid);
    await page
      .getByLabel("復旧用バックアップJSON", { exact: true })
      .setInputFiles({
        name: "good.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(good)),
      });
    page.once("dialog", (d) => d.accept());
    await page
      .getByRole("button", {
        name: "確認してバックアップから復旧",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("heading", { name: "今日は何作ろう？", exact: true }),
    ).toBeVisible();
    expect((await state(page)).recipes).toHaveLength(3);
  });

test("一部だけ家にある・購入した数量を保存し、不足分のメモを手動コピーできる", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    }),
  );
  await importTestRecipe(page);
  await page
    .getByRole("link", {
      name: "買い物をまとめる・一部の量を入力",
      exact: true,
    })
    .click();
  const rice = page
    .getByTestId("shopping-group")
    .filter({ has: page.getByRole("heading", { name: "米", exact: true }) });
  await rice.getByText("一部だけそろえる", { exact: true }).click();
  const amount = rice.getByLabel("入力する数量（米・g）", { exact: true });
  await amount.fill("200");
  await rice
    .getByRole("button", { name: "米の入力した量は家にある", exact: true })
    .click();
  await expect
    .poll(async () => (await state(page)).runs[0].shopping[0].onHandQuantity)
    .toBe(200);
  await expect(rice).toContainText("買い足し 400 g");
  await amount.fill("401");
  await rice
    .getByRole("button", { name: "米の入力した量は家にある", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("不足分以下");
  expect((await state(page)).runs[0].shopping[0].onHandQuantity).toBe(200);
  await amount.fill("100");
  await rice
    .getByRole("button", { name: "米の入力した量を購入した", exact: true })
    .click();
  await expect
    .poll(async () => (await state(page)).runs[0].shopping[0].boughtQuantity)
    .toBe(100);
  await expect(rice).toContainText("買い足し 300 g");
  await page
    .getByRole("button", { name: "不足分をコピー", exact: true })
    .click();
  const memo = page.getByLabel("コピーする買い物メモ", { exact: true });
  await expect(memo).toBeVisible();
  await expect(memo).toHaveValue(/米 300 g/);
  await expect(memo).toHaveValue(/保冷/);
  await expect(memo).toBeFocused();
  await page.reload();
  await expect(rice).toContainText("買い足し 300 g");
});

test("料理名・食材を全角でも検索でき、お気に入りと組み合わせられる", async ({
  page,
}) => {
  await importTestRecipe(page);
  await navigate(page, "料理");
  const search = page.getByLabel("料理名・食材で探す", { exact: true });
  await search.fill("Ｅ２Ｅ　鶏");
  await expect(page.locator(".recipe-grid > article")).toHaveCount(1);
  await expect(recipeCard(page, rawRecipe.title)).toBeVisible();
  await recipeCard(page, rawRecipe.title)
    .getByRole("button", {
      name: `${rawRecipe.title}をお気に入りにする`,
      exact: true,
    })
    .click();
  await page
    .getByRole("combobox", { name: "レシピの表示", exact: true })
    .selectOption("favorite");
  await expect(page.locator(".recipe-grid > article")).toHaveCount(1);
  await search.fill("存在しない料理名");
  await expect(page.locator(".recipe-grid > article")).toHaveCount(0);
  await page.getByRole("button", { name: "検索をクリア", exact: true }).click();
  await expect(page.locator(".recipe-grid > article")).toHaveCount(1);
});

test("工程メモを次へ・AI相談・別画面へ移る時に保存し、料理を再開できる", async ({
  page,
}) => {
  await importTestRecipe(page);
  await procure(page);
  await page
    .getByLabel("この工程のメモ", { exact: true })
    .fill("下準備の量を確認した");
  await page
    .getByRole("button", { name: "この工程を完了して次へ", exact: true })
    .click();
  await expect
    .poll(async () => (await state(page)).runs[0].completed.length)
    .toBe(1);
  expect((await state(page)).runs[0].notes["prep-1"]).toBe(
    "下準備の量を確認した",
  );
  await page
    .getByLabel("この工程のメモ", { exact: true })
    .fill("肉が一度に入り切らない");
  await page.getByRole("button", { name: "AIに質問", exact: true }).click();
  await page
    .getByText("生成した相談文を確認・手動コピー", { exact: true })
    .click();
  await expect(
    page.getByLabel("ChatGPTへ渡す相談文", { exact: true }),
  ).toHaveValue(/肉が一度に入り切らない/);
  await navigate(page, "ホーム");
  await page
    .getByRole("button", {
      name: `${rawRecipe.title}の続きをする`,
      exact: true,
    })
    .click();
  await expect(page.getByLabel("この工程のメモ", { exact: true })).toHaveValue(
    "肉が一度に入り切らない",
  );
  await page
    .getByLabel("この工程のメモ", { exact: true })
    .fill("分けて加熱することにした");
  await navigate(page, "ホーム");
  await expect
    .poll(async () => (await state(page)).runs[0].notes["cook-1"])
    .toBe("分けて加熱することにした");
  await page.reload();
  await page
    .getByRole("button", {
      name: `${rawRecipe.title}の続きをする`,
      exact: true,
    })
    .click();
  await expect(page.getByLabel("この工程のメモ", { exact: true })).toHaveValue(
    "分けて加熱することにした",
  );
  await expect(
    page.getByRole("progressbar", { name: "料理の進み具合", exact: true }),
  ).toHaveAttribute("value", "1");
});

for (const denied of [false, true])
  test(`画面点灯の保持を明示操作だけで要求し、${denied ? "拒否時は説明する" : "別画面へ移ると解除する"}`, async ({
    page,
  }) => {
    await page.addInitScript((denied) => {
      const record = window as unknown as {
        wakeRequests: number;
        wakeReleases: number;
      };
      record.wakeRequests = 0;
      record.wakeReleases = 0;
      Object.defineProperty(navigator, "wakeLock", {
        configurable: true,
        value: {
          request: async () => {
            record.wakeRequests++;
            if (denied) throw Error("NotAllowedError");
            const lock = new EventTarget();
            return Object.assign(lock, {
              released: false,
              release: async () => {
                record.wakeReleases++;
                lock.dispatchEvent(new Event("release"));
              },
            });
          },
        },
      });
    }, denied);
    await importTestRecipe(page);
    await procure(page);
    expect(
      await page.evaluate(
        () => (window as unknown as { wakeRequests: number }).wakeRequests,
      ),
    ).toBe(0);
    await page
      .getByRole("button", { name: "画面の点灯を保つ", exact: true })
      .click();
    if (denied) {
      await expect(
        page
          .getByRole("status")
          .filter({ hasText: "画面の点灯を保持できませんでした" }),
      ).toBeVisible();
    } else {
      await expect(
        page.getByRole("status").filter({ hasText: "点灯を保持中" }),
      ).toBeVisible();
      await navigate(page, "ホーム");
      await expect
        .poll(async () =>
          page.evaluate(
            () => (window as unknown as { wakeReleases: number }).wakeReleases,
          ),
        )
        .toBe(1);
    }
  });
