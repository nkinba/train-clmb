"use client";

import { Check, Square, X } from "lucide-react";
import { TimerDisplay } from "@/components/timer-display";
import { cn } from "@/lib/utils";
import {
  progress01,
  type SetResult,
  type TimerState,
} from "@/lib/hangboard-timer";

/**
 * 행보드 풀스크린 타이머.
 * - countdown / hang / rest 페이즈만 표시 (idle/done은 부모가 다른 UI).
 * - hang 페이즈 동안 "방금 세트" 결과 입력 prompt는 hang이 끝나는 즉시 rest 위에 overlay.
 *   여기서는 rest 페이즈에 진입한 후에 직전 세트(setIndex)의 결과가 null이면 prompt를 띄움.
 */
export function FullScreenTimer({
  state,
  remainingSec,
  now,
  onMarkResult,
  onAbort,
  onSkipRest,
}: {
  state: TimerState;
  remainingSec: number;
  now: number;
  onMarkResult: (result: SetResult) => void;
  onAbort: () => void;
  onSkipRest: () => void;
}) {
  const phase = state.phase;
  if (phase === "idle" || phase === "done") return null;

  const accent =
    phase === "hang"
      ? "bg-timer-hang"
      : phase === "rest"
        ? "bg-timer-rest"
        : "bg-timer-countdown";

  const showResultPrompt =
    phase === "rest" && state.setResults[state.setIndex] == null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center bg-canvas px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <header className="mt-4 flex w-full max-w-md items-center justify-between">
        <span className="text-caption text-fg-muted">
          세트 {state.setIndex + 1} / {state.config.totalSets}
        </span>
        <button
          type="button"
          onClick={onAbort}
          aria-label="타이머 중단"
          className="flex h-tap w-tap items-center justify-center rounded-md bg-elevated text-fg-primary"
        >
          <Square size={20} aria-hidden />
        </button>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center">
        <TimerDisplay phase={phase} remainingSeconds={remainingSec} />
      </div>

      {/* 진행 바 */}
      <div className="mb-4 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-subtle">
        <div
          className={cn("h-full transition-[width] duration-150", accent)}
          style={{ width: `${(progress01(state, now) * 100).toFixed(1)}%` }}
        />
      </div>

      {/* 세트 도트 — 결과 시각화 */}
      <div className="mb-6 flex w-full max-w-md items-center justify-center gap-2">
        {state.setResults.map((r, idx) => (
          <span
            key={idx}
            aria-label={
              r === "success"
                ? "성공"
                : r === "fail"
                  ? "실패"
                  : idx === state.setIndex && phase !== "rest"
                    ? "진행 중"
                    : "미진행"
            }
            className={cn(
              "h-3 w-3 rounded-full",
              r === "success" && "bg-success",
              r === "fail" && "bg-danger",
              r === null &&
                (idx === state.setIndex
                  ? "bg-fg-secondary"
                  : "bg-elevated"),
            )}
          />
        ))}
      </div>

      {/* rest 페이즈 단축 */}
      {phase === "rest" && !showResultPrompt && (
        <button
          type="button"
          onClick={onSkipRest}
          className="mb-4 h-tap-default w-full max-w-md rounded-lg bg-elevated text-fg-primary text-body font-semibold"
        >
          휴식 건너뛰기
        </button>
      )}

      {showResultPrompt && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-canvas/95 px-6">
          <p className="text-h2 font-semibold text-fg-primary">
            세트 {state.setIndex + 1} 결과
          </p>
          <button
            type="button"
            onClick={() => onMarkResult("success")}
            className="flex h-tap-hero w-full max-w-sm items-center justify-center gap-2 rounded-lg bg-success text-on-success text-h2 font-semibold"
          >
            <Check size={28} aria-hidden /> 성공
          </button>
          <button
            type="button"
            onClick={() => onMarkResult("fail")}
            className="flex h-tap-hero w-full max-w-sm items-center justify-center gap-2 rounded-lg bg-danger text-on-danger text-h2 font-semibold"
          >
            <X size={28} aria-hidden /> 실패
          </button>
          {/* 결과 입력 중에도 휴식 시간이 흘러가고 있음을 알려줌 */}
          <p className="mt-2 text-caption text-fg-muted tabular-nums">
            휴식 남음 {remainingSec}s
          </p>
        </div>
      )}
    </div>
  );
}
