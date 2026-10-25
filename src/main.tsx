import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./style.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`)
    .then((registration) => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "redundant")
          document.dispatchEvent(new CustomEvent("kitchen-sw-failed"));
      });
      return navigator.serviceWorker.ready;
    })
    .then(() =>
      document.dispatchEvent(new CustomEvent("kitchen-offline-ready")),
    )
    .catch(() => document.dispatchEvent(new CustomEvent("kitchen-sw-failed")));
}
