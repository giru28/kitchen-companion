import { useEffect, useRef, useState } from "react";

/** Browser screen lock only; no background service or notification permission. */
export function useScreenWakeLock(cooking: boolean) {
  const [enabled, setEnabled] = useState(false);
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState("");
  const requested = useRef(false);
  const mounted = useRef(false);
  const acquiring = useRef(false);
  const sentinel = useRef<WakeLockSentinel | null>(null);
  const supported = "wakeLock" in navigator;

  async function acquire() {
    if (
      !requested.current ||
      !mounted.current ||
      document.visibilityState !== "visible" ||
      acquiring.current ||
      sentinel.current
    )
      return;
    acquiring.current = true;
    try {
      const lock = await navigator.wakeLock.request("screen");
      if (
        !requested.current ||
        !mounted.current ||
        document.visibilityState !== "visible"
      ) {
        await lock.release();
        return;
      }
      sentinel.current = lock;
      setActive(true);
      setMessage("");
      lock.addEventListener("release", () => {
        if (sentinel.current !== lock) return;
        sentinel.current = null;
        if (mounted.current) setActive(false);
      });
    } catch {
      if (mounted.current)
        setMessage(
          "画面の点灯を保持できませんでした。省電力設定などを確認し、必要なら端末の自動ロック時間を調整してください。",
        );
    } finally {
      acquiring.current = false;
    }
  }
  function stop() {
    requested.current = false;
    const lock = sentinel.current;
    sentinel.current = null;
    void lock?.release().catch(() => {});
    if (mounted.current) {
      setEnabled(false);
      setActive(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    const visible = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      mounted.current = false;
      stop();
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  useEffect(() => {
    if (!cooking) stop();
  }, [cooking]);
  function toggle() {
    setMessage("");
    if (requested.current) return stop();
    if (!supported || !cooking) return;
    requested.current = true;
    setEnabled(true);
    void acquire();
  }
  return { enabled, active, supported, message, toggle };
}
