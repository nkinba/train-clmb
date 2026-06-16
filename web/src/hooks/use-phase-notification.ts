"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Page-visibility 기반 보조 알림 (ADR-7).
 *
 * ADR-7 §4: SW 백그라운드 타이머는 보조용 (iOS 백그라운드 ~30s 후 정지).
 * → 주 타이밍은 포그라운드 + Wake Lock. 이 훅은 사용자가 다른 탭/앱으로 잠깐 갔다가
 *   돌아왔을 때 페이즈 전환을 알리는 부가 기능.
 *
 * 페이즈 전환 시 `notifyPhase()`를 호출하면:
 * - document.hidden 인 경우만 OS 알림 발사.
 * - 권한 없으면 silent.
 */
export type NotificationPermissionState = "default" | "granted" | "denied" | "unsupported";

export function usePhaseNotification(): {
  permission: NotificationPermissionState;
  request: () => Promise<NotificationPermissionState>;
  notifyPhase: (title: string, body: string) => void;
} {
  const [permission, setPermission] = useState<NotificationPermissionState>("default");

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as NotificationPermissionState);
  }, []);

  const request = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "unsupported" as const;
    }
    if (Notification.permission === "granted" || Notification.permission === "denied") {
      setPermission(Notification.permission as NotificationPermissionState);
      return Notification.permission as NotificationPermissionState;
    }
    const next = await Notification.requestPermission();
    setPermission(next as NotificationPermissionState);
    return next as NotificationPermissionState;
  }, []);

  const notifyPhase = useCallback((title: string, body: string) => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    if (typeof document !== "undefined" && !document.hidden) return; // 포그라운드는 UI로 충분
    try {
      // SW registration이 있으면 SW notification (iOS PWA 호환), 아니면 inline.
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistration().then((reg) => {
          if (reg) {
            reg
              .showNotification(title, { body, silent: false, tag: "cf-phase" })
              .catch(() => {});
          } else {
            new Notification(title, { body, tag: "cf-phase" });
          }
        });
      } else {
        new Notification(title, { body, tag: "cf-phase" });
      }
    } catch {
      /* ignore — best effort */
    }
  }, []);

  // useMemo로 안정화 → 호출 측 useEffect deps에서 매 렌더 재발사 회피.
  return useMemo(
    () => ({ permission, request, notifyPhase }),
    [permission, request, notifyPhase],
  );
}
