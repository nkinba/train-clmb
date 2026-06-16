import { cn } from "@/lib/utils";

type Phase = "hang" | "rest" | "countdown";

const PHASE_COLOR: Record<Phase, string> = {
  hang: "text-timer-hang",
  rest: "text-timer-rest",
  countdown: "text-timer-countdown",
};

const PHASE_GLOW: Record<Phase, string> = {
  hang: "drop-shadow-[0_0_24px_rgba(239,68,68,0.5)]",
  rest: "drop-shadow-[0_0_16px_rgba(16,185,129,0.35)]",
  countdown: "drop-shadow-[0_0_16px_rgba(251,191,36,0.4)]",
};

const PHASE_LABEL: Record<Phase, string> = {
  hang: "매달리기",
  rest: "휴식",
  countdown: "시작 준비",
};

/**
 * 풀스크린 타이머 거대 숫자. 3m 떨어진 거리에서도 시인 가능 (10rem).
 * Wake Lock·Vibration·Audio는 S09 (timer screen)에서 wire.
 */
export function TimerDisplay({
  remainingSeconds,
  phase,
  className,
}: {
  remainingSeconds: number;
  phase: Phase;
  className?: string;
}) {
  const mm = Math.floor(remainingSeconds / 60);
  const ss = remainingSeconds % 60;
  const formatted = `${mm}:${ss.toString().padStart(2, "0")}`;
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4", className)}>
      {/* aria-live="off": 매 초 갱신을 SR이 스팸하지 않도록.
        * TODO(S09): phase 전환 시점에만 별도 aria-live="assertive" 영역으로 announce. */}
      <span
        className={cn(
          "text-timer tabular-nums leading-none",
          PHASE_COLOR[phase],
          PHASE_GLOW[phase],
        )}
        role="timer"
        aria-live="off"
        aria-label={`${PHASE_LABEL[phase]} ${formatted} 남음`}
      >
        {formatted}
      </span>
      <span className={cn("text-h2 font-semibold", PHASE_COLOR[phase])}>
        {PHASE_LABEL[phase]}
      </span>
    </div>
  );
}
