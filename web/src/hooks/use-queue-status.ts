"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  flushQueue,
  getDeadLetters,
  queueLength,
  subscribeQueueChange,
} from "@/lib/mutation-queue";

export type QueueStatus = {
  length: number;
  deadLetters: number;
  online: boolean;
  flushing: boolean;
  lastFlushAt: number | null;
};

const FLUSH_INTERVAL_MS = 5000;

/**
 * S12 — 오프라인 큐 상태 + 자동 flush.
 *
 * - 초기 큐 길이 fetch + BroadcastChannel 구독.
 * - `online`/`offline` 이벤트로 online 상태 추적.
 * - online + 큐 길이 > 0이면 5초 주기 flush. online 이벤트 발생 시 즉시 flush.
 * - flush 성공 후 list query invalidate → 누적 row UI 갱신.
 */
export function useQueueStatus(): QueueStatus & { flushNow: () => void } {
  const qc = useQueryClient();

  const [length, setLength] = useState(0);
  const [deadLetters, setDeadLetters] = useState(0);
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [flushing, setFlushing] = useState(false);
  const [lastFlushAt, setLastFlushAt] = useState<number | null>(null);

  // 초기 길이 + dead-letter + 구독
  useEffect(() => {
    let cancelled = false;
    queueLength().then((n) => !cancelled && setLength(n));
    getDeadLetters().then((d) => !cancelled && setDeadLetters(d.length));
    const unsub = subscribeQueueChange((n) => setLength(n));
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  // online/offline 이벤트
  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // flush 락 — 두 effect가 동시에 flush 시작하지 않도록.
  const flushingRef = useRef(false);

  const flushNow = useCallback(() => {
    if (flushingRef.current) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    flushingRef.current = true;
    setFlushing(true);
    flushQueue()
      .then((res) => {
        setLastFlushAt(Date.now());
        setDeadLetters(res.deadLetters);
        if (res.succeeded > 0) {
          // 성공한 컬렉션의 세션별 list query만 명시적으로 invalidate.
          for (const col of res.succeededCollections) {
            qc.invalidateQueries({ queryKey: [col] });
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        flushingRef.current = false;
        setFlushing(false);
      });
  }, [qc]);

  // online 이벤트 발생 시 즉시 flush.
  useEffect(() => {
    if (online && length > 0) flushNow();
  }, [online, length, flushNow]);

  // 큐 있고 online이면 주기적 flush.
  useEffect(() => {
    if (!online || length === 0) return;
    const id = window.setInterval(() => flushNow(), FLUSH_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [online, length, flushNow]);

  return { length, deadLetters, online, flushing, lastFlushAt, flushNow };
}
