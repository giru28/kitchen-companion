import { describe, it, expect } from "vitest";
import { runInNewContext } from "node:vm";
import { workerSource } from "./service-worker";
function harness(fetcher: (r: unknown) => Promise<Response>, cached = true) {
  const handlers: Record<string, (e: any) => void> = {};
  const added: Request[][] = [];
  const deleted: string[] = [];
  const matched: { key: unknown; options: unknown }[] = [];
  const opened: string[] = [];
  const self = {
    location: { origin: "https://example.test" },
    registration: { scope: "https://example.test/kitchen/" },
    clients: { claim: async () => {} },
    skipWaiting: async () => {},
    addEventListener: (name: string, fn: (e: any) => void) => {
      handlers[name] = fn;
    },
  };
  const caches = {
    open: async (name: string) => {
      opened.push(name);
      return {
        addAll: async (f: Request[]) => {
          added.push(f);
        },
        match: async (key: unknown, options: unknown) => {
          matched.push({ key, options });
          return cached ? new Response("current build") : undefined;
        },
      };
    },
    keys: async () => ["kitchen-%2Fkitchen%2F-old", "kitchen-%2Fother%2F-old"],
    delete: async (key: string) => {
      deleted.push(key);
      return true;
    },
  };
  runInNewContext(workerSource(["./", "./index.html", "./app.js"], "new"), {
    self,
    caches,
    fetch: fetcher,
    URL,
    Response,
    Request,
  });
  return { handlers, added, deleted, matched, opened };
}
describe("Service Workerとビルド単位のオフライン保存", () => {
  it("自分の配信範囲だけを事前保存し他アプリのキャッシュを消さない", async () => {
    const h = harness(async () => new Response("network"));
    let task: Promise<unknown> = Promise.resolve();
    h.handlers.install({ waitUntil: (p: Promise<unknown>) => (task = p) });
    await task;
    expect(h.added[0].map((r) => r.url)).toContain(
      "https://example.test/kitchen/app.js",
    );
    expect(h.added[0].every((r) => r.cache === "reload")).toBe(true);
    h.handlers.activate({ waitUntil: (p: Promise<unknown>) => (task = p) });
    await task;
    expect(h.deleted).toEqual(["kitchen-%2Fkitchen%2F-old"]);
  });
  it("HTMLとアセットを同じビルドから読み、OriginのVary差でオフライン起動を壊さない", async () => {
    const h = harness(async () => {
      throw Error("offline");
    });
    for (const mode of ["navigate", "cors"]) {
      let result!: Promise<Response>;
      const request = {
        url: "https://example.test/kitchen/app.js",
        method: "GET",
        mode,
      };
      h.handlers.fetch({
        request,
        respondWith: (p: Promise<Response>) => (result = p),
      });
      expect(await (await result).text()).toBe("current build");
      expect(h.matched.at(-1)).toEqual({
        key: mode === "navigate" ? "./index.html" : request,
        options: { ignoreVary: true },
      });
    }
    expect(h.opened).toEqual([
      "kitchen-%2Fkitchen%2F-new",
      "kitchen-%2Fkitchen%2F-new",
    ]);
  });
  it("未保存のGETはネットワークへ戻し、外部通信や書き込み要求を扱わない", async () => {
    const h = harness(async () => new Response("network"), false);
    let result!: Promise<Response>;
    h.handlers.fetch({
      request: {
        url: "https://example.test/kitchen/other.js",
        method: "GET",
        mode: "cors",
      },
      respondWith: (p: Promise<Response>) => (result = p),
    });
    expect(await (await result).text()).toBe("network");
    let called = false;
    for (const request of [
      { url: "https://chatgpt.com/", method: "GET" },
      { url: "https://example.test/save", method: "POST" },
    ])
      h.handlers.fetch({ request, respondWith: () => (called = true) });
    expect(called).toBe(false);
  });
});
