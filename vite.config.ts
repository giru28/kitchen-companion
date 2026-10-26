import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { workerSource } from "./src/service-worker";
function offline(): Plugin {
  return {
    name: "kitchen-offline",
    apply: "build",
    enforce: "post",
    transformIndexHtml(html) {
      return html.replace(
        "<head>",
        "<head><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'\"/>",
      );
    },
    generateBundle(_options, bundle) {
      const assets = [
        "./",
        "./index.html",
        "./manifest.webmanifest",
        "./icon.svg",
        "./icon-192.png",
        "./icon-512.png",
        "./apple-touch-icon.png",
        ...Object.keys(bundle)
          .filter((k) => k !== "index.html")
          .map((k) => "./" + k),
      ];
      const version = createHash("sha256")
        .update(
          Object.values(bundle)
            .map((item) =>
              item.type === "chunk" ? item.code : String(item.source),
            )
            .join(""),
        )
        .update(workerSource.toString())
        .update(readFileSync("public/icon.svg"))
        .update(readFileSync("public/icon-192.png"))
        .update(readFileSync("public/icon-512.png"))
        .update(readFileSync("public/apple-touch-icon.png"))
        .digest("hex")
        .slice(0, 12);
      this.emitFile({
        type: "asset",
        fileName: "manifest.webmanifest",
        source: JSON.stringify({
          id: "./",
          name: "Kitchen — 料理生活アシスタント",
          short_name: "Kitchen",
          lang: "ja",
          start_url: "./",
          scope: "./",
          display: "standalone",
          background_color: "#f7f7f2",
          theme_color: "#2c6655",
          icons: [
            {
              src: "./icon-192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "./icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "./icon.svg",
              sizes: "any",
              type: "image/svg+xml",
              purpose: "maskable",
            },
          ],
        }),
      });
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: workerSource(assets, version),
      });
    },
  };
}
export default defineConfig({
  base: "./",
  server: { host: "127.0.0.1", port: 3300, strictPort: true },
  preview: { host: "127.0.0.1", port: 3300, strictPort: true },
  plugins: [react(), offline()],
  test: { include: ["src/**/*.test.ts"] },
} as import("vite").UserConfig);
