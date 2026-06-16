"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAudioBeep, vibrate } from "@/hooks/use-audio-beep";

/**
 * 볼더링 세트 간 휴식 타이머 — STORIES S10 "세트 간 휴식 타이머 (3분)".
 *
 * S09의 풀스크린 머신을 재사용하지 않고 단순 1-페이즈 카운트다운으로 둠:
 *   - 폼 옆 사이드바 위젯이지 풀스크린 전환이 아니므로.
 *   - 페이즈 cycle/상태머신 분리의 이점이 없음.
 *
 * Wake Lock은 동반하지 않음 — 사용자가 타이머 진행 중에도 폼을 작성할 수 있어
 * 일반적인 페이지 인터랙션이 화면을 깨어있게 한다.
 */
export function RestTimer({ defaultSec = 180 }: { defaultSec?: number }) {
  const [endAt, setEndAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(defaultSec);
  const firedRef = useRef(false);
  const audio = useAudioBeep();

  const running = endAt != null;

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      const rem = Math.max(0, Math.ceil((endAt! - now) / 1000));
      setRemaining(rem);
      if (rem === 0 && !firedRef.current) {
        firedRef.current = true;
        audio.beep({ freqHz: 880, durationMs: 250, count: 2 });
        vibrate([300, 100, 300]);
        setEndAt(null);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [running, endAt, audio]);

  const startFresh = async () => {
    await audio.unlock();
    firedRef.current = false;
    setRemaining(defaultSec);
    setEndAt(Date.now() + defaultSec * 1000);
  };
  const onStart = startFresh;
  const onReset = startFresh;
  const onStop = () => {
    setEndAt(null);
    setRemaining(defaultSec);
  };

  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;
  const formatted = `${mm}:${ss.toString().padStart(2, "0")}`;

  return (
    <section
      aria-label="휴식 타이머"
      className={cn(
        "flex items-center gap-3 rounded-lg p-3",
        running ? "bg-timer-rest/10 ring-1 ring-timer-rest" : "bg-surface",
      )}
    >
      <span
        className={cn(
          "flex-1 text-h2 tabular-nums leading-none",
          running ? "text-timer-rest" : "text-fg-primary",
        )}
        role="timer"
        aria-live="off"
        aria-label={`휴식 ${formatted} 남음`}
      >
        {formatted}
      </span>

      {!running && (
        <button
          type="button"
          onClick={onStart}
          aria-label="휴식 타이머 시작"
          className="flex h-tap w-tap items-center justify-center rounded-md bg-brand text-on-brand"
        >
          <Play size={20} aria-hidden />
        </button>
      )}

      {running && (
        <>
          <button
            type="button"
            onClick={onReset}
            aria-label="휴식 타이머 재시작"
            className="flex h-tap w-tap items-center justify-center rounded-md bg-elevated text-fg-primary"
          >
            <RotateCcw size={20} aria-hidden />
          </button>
          <button
            type="button"
            onClick={onStop}
            aria-label="휴식 타이머 정지"
            className="flex h-tap w-tap items-center justify-center rounded-md bg-elevated text-fg-primary"
          >
            <Pause size={20} aria-hidden />
          </button>
        </>
      )}
    </section>
  );
}
