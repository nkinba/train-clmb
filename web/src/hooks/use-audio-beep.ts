"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Web Audio API 비프 (ADR-7).
 *
 * iOS Safari는 사용자 제스처 안에서 AudioContext를 생성/resume해야 unlock된다.
 * → `unlock()` 을 첫 탭(예: "시작" 버튼) 핸들러 안에서 호출하라.
 * 이후 `beep()` 으로 sine tone을 짧게 재생.
 *
 * 다른 디바이스에서도 동일 패턴이 안전 (사용자 제스처 후 한 번 init).
 */
export function useAudioBeep() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [ready, setReady] = useState(false);

  const unlock = useCallback(async () => {
    if (typeof window === "undefined") return;
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return;
    if (!ctxRef.current) {
      ctxRef.current = new AC();
    }
    if (ctxRef.current.state === "suspended") {
      await ctxRef.current.resume().catch(() => {});
    }
    setReady(ctxRef.current.state === "running");
  }, []);

  const beep = useCallback(
    (opts?: {
      freqHz?: number;
      durationMs?: number;
      volume?: number;
      count?: number; // n번 연속 재생 (간격 60ms)
    }) => {
      const ctx = ctxRef.current;
      if (!ctx || ctx.state !== "running") return;
      const freq = opts?.freqHz ?? 880;
      const dur = (opts?.durationMs ?? 150) / 1000;
      const vol = opts?.volume ?? 0.3;
      const count = opts?.count ?? 1;
      const now = ctx.currentTime;

      for (let i = 0; i < count; i++) {
        const start = now + i * (dur + 0.06);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        // 짧은 attack/release로 클릭 노이즈 회피
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(vol, start + 0.01);
        gain.gain.linearRampToValueAtTime(0, start + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + dur);
      }
    },
    [],
  );

  useEffect(() => {
    return () => {
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
    };
  }, []);

  // 반환 객체를 useMemo로 안정화 → 호출 측 useEffect deps에서 매 렌더 재발사 회피.
  return useMemo(() => ({ unlock, beep, ready }), [unlock, beep, ready]);
}

/** 디바이스가 진동을 지원하면 짧게 진동. 미지원/거절은 silent. */
export function vibrate(pattern: number | number[]) {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
}
