import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { initialData } from "../src/store";

test("HTTPキャッシュが残るローカル旧版から更新しても、新画面と保存済み記録をオフラインで使える", async ({
  page,
  context,
}) => {
  test.setTimeout(60000);
  let updated = false;
  const build = path.resolve("dist");
  const oldHTML =
    '<!doctype html><html><head><meta charset="utf-8"></head><body><h1>旧バージョン</h1><script src="./old.js"></script></body></html>';
  const oldWorker = `const CACHE='kitchen-%2F-old';self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['./','./index.html','./old.js'])).then(()=>self.skipWaiting())));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>{if(e.request.method==='GET')e.respondWith(caches.open(CACHE).then(c=>c.match(e.request.mode==='navigate'?'./index.html':e.request,{ignoreVary:true})).then(r=>r||fetch(e.request)));});`;
  const server = createServer(async (request, response) => {
    try {
      const name =
        new URL(request.url!, "http://localhost").pathname.slice(1) ||
        "index.html";
      if (name.includes("..")) throw Error("Invalid path");
      const old: Record<string, string> = {
        "index.html": oldHTML,
        "old.js": "navigator.serviceWorker.register('./sw.js')",
        "sw.js": oldWorker,
      };
      const data = updated ? await readFile(path.join(build, name)) : old[name];
      if (data === undefined) throw Error("Missing");
      const mime: Record<string, string> = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".webmanifest": "application/manifest+json",
      };
      response.writeHead(200, {
        "Content-Type": mime[path.extname(name)] || "application/octet-stream",
        "Cache-Control": name === "sw.js" ? "no-cache" : "public,max-age=3600",
        Vary: "Origin",
      });
      response.end(data);
    } catch {
      response.writeHead(404);
      response.end("Missing");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const port = (server.address() as { port: number }).port;
    await page.goto(`http://127.0.0.1:${port}/`);
    await expect(
      page.getByRole("heading", { name: "旧バージョン", exact: true }),
    ).toBeVisible();
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller)
        await new Promise<void>((resolve) =>
          navigator.serviceWorker.addEventListener(
            "controllerchange",
            () => resolve(),
            { once: true },
          ),
        );
    });
    const before = { revision: 7, data: initialData() };
    before.data.preferences.tastes = "更新前からある好み";
    await page.evaluate(
      (value) =>
        new Promise<void>((resolve, reject) => {
          const request = indexedDB.open("kitchen-assistant-v1", 1);
          request.onupgradeneeded = () =>
            request.result.createObjectStore("state");
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result,
              tx = db.transaction("state", "readwrite");
            tx.objectStore("state").put(value, "main");
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
            tx.onerror = () => reject(tx.error);
          };
        }),
      before,
    );
    updated = true;
    await page.evaluate(async () => {
      const old = navigator.serviceWorker.controller;
      const changed = new Promise<void>((resolve) => {
        const listener = () => {
          if (navigator.serviceWorker.controller !== old) {
            navigator.serviceWorker.removeEventListener(
              "controllerchange",
              listener,
            );
            resolve();
          }
        };
        navigator.serviceWorker.addEventListener("controllerchange", listener);
      });
      await (await navigator.serviceWorker.getRegistration())!.update();
      await changed;
    });
    const worker = await readFile(path.join(build, "sw.js"), "utf8");
    const version = JSON.parse(worker.match(/CACHE=PREFIX\+("[^"]+")/)![1]);
    const expectedCache = `kitchen-%2F-${version}`;
    await page.waitForFunction(async (key) => {
      const registration = await navigator.serviceWorker.getRegistration();
      return (
        registration?.active?.state === "activated" &&
        !registration.installing &&
        (await caches.has(key))
      );
    }, expectedCache);
    const html = await readFile(path.join(build, "index.html"), "utf8");
    const expectedScript = html.match(/src="([^\"]+\.js)"/)![1];
    const cachedHTML = await page.evaluate(async (key) => {
      const cache = await caches.open(key);
      return (await cache.match("./index.html"))!.text();
    }, expectedCache);
    expect(cachedHTML).toContain(expectedScript);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "今日は何作ろう？", exact: true }),
    ).toBeVisible();
    await context.setOffline(true);
    await page.reload();
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "設定", exact: true })
      .click();
    await expect(page.getByLabel("好みの味", { exact: true })).toHaveValue(
      "更新前からある好み",
    );
    const after = await page.evaluate(
      () =>
        new Promise<unknown>((resolve, reject) => {
          const request = indexedDB.open("kitchen-assistant-v1", 1);
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const db = request.result,
              tx = db.transaction("state", "readonly"),
              get = tx.objectStore("state").get("main");
            get.onsuccess = () => resolve(get.result);
            tx.oncomplete = () => db.close();
          };
        }),
    );
    expect(after).toEqual(before);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
