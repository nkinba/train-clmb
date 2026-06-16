"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Wake Lock API 래퍼 (ADR-7).
 * - enabled=true일 때 screen wake lock 요청 → 화면 꺼짐 방지.
 * - tab visibility 회복 시 자동 재요청 (Safari/Chrome에서 visibilitychange 후 lock이 풀린다).
 * - 컴포넌트 unmount/disabled 시 release.
 *
 * 미지원 디바이스(`navigator.wakeLock` 없음)는 silent skip + `supported=false` 표시만.
 */
export function useWakeLock(enabled: boolean): {
  supported: boolean;
  active: boolean;
  error: string | null;
} {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) {
      setSupported(false);
      return;
    }

    let cancelled = false;

    const acquire = async () => {
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) {
          await sentinel.release().catch(() => {});
          return;
        }
        sentinelRef.current = sentinel;
        setActive(true);
        setError(null);
        sentinel.addEventListener("release", () => {
          setActive(false);
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "wake lock failed");
      }
    };

    const release = async () => {
      const cur = sentinelRef.current;
      sentinelRef.current = null;
      if (cur) await cur.release().catch(() => {});
      setActive(false);
    };

    const onVisibility = () => {
      if (enabled && document.visibilityState === "visible" && !sentinelRef.current) {
        void acquire();
      }
    };

    if (enabled) {
      void acquire();
      document.addEventListener("visibilitychange", onVisibility);
    } else {
      void release();
    }

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void release();
    };
  }, [enabled]);

  return { supported, active, error };
}
