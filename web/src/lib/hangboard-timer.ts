/**
 * 행보드 인터벌 타이머 상태머신 (ADR-7).
 *
 * 페이즈 사이클:
 *   idle → countdown(set 1) → hang → rest → countdown(set 2) → hang → ... → done
 *   마지막 세트는 hang 종료 직후 done으로 (rest 생략).
 *
 * 정확성:
 *   매 tick에서 wall-clock(`Date.now()`)을 phaseEndAt과 비교.
 *   setInterval/RAF는 백그라운드에서 throttle되지만 포그라운드 복귀 시 catch-up 정확.
 *   ADR-7에 따라 포그라운드 유지가 기본 전제 (Wake Lock으로 보장).
 *
 * 순수 함수 + 1개 reducer로 표현 — React 외부에서도 단위 테스트 가능.
 */

export type Phase = "idle" | "countdown" | "hang" | "rest" | "done";

export type SetResult = "success" | "fail" | null;

export type TimerConfig = {
  hangSeconds: number; // 매달리기 시간 (기본 10)
  restSeconds: number; // 휴식 시간 (기본 180)
  countdownSeconds: number; // 시작/세트 간 카운트다운 (기본 3)
  totalSets: number; // 총 세트 수 (기본 5)
};

export type TimerState = {
  phase: Phase;
  setIndex: number; // 0-based; 현재 진행 중(또는 완료된 직후) 세트
  phaseStartAt: number | null;
  phaseEndAt: number | null;
  setResults: SetResult[];
  config: TimerConfig;
  // 자연 종료(마지막 hang 후) vs abort(사용자 중단) 구분.
  // effect에서 done 신호(완료 비프/진동/알림)를 자연 종료에만 발사.
  aborted: boolean;
};

export const DEFAULT_CONFIG: TimerConfig = {
  hangSeconds: 10,
  restSeconds: 180,
  countdownSeconds: 3,
  totalSets: 5,
};

export function makeInitialState(config: TimerConfig): TimerState {
  return {
    phase: "idle",
    setIndex: 0,
    phaseStartAt: null,
    phaseEndAt: null,
    setResults: Array.from({ length: config.totalSets }, () => null),
    config,
    aborted: false,
  };
}

function durationFor(phase: Phase, config: TimerConfig): number {
  switch (phase) {
    case "countdown":
      return config.countdownSeconds * 1000;
    case "hang":
      return config.hangSeconds * 1000;
    case "rest":
      return config.restSeconds * 1000;
    default:
      return 0;
  }
}

function enterPhase(state: TimerState, phase: Phase, now: number): TimerState {
  if (phase === "idle" || phase === "done") {
    return { ...state, phase, phaseStartAt: null, phaseEndAt: null };
  }
  return {
    ...state,
    phase,
    phaseStartAt: now,
    phaseEndAt: now + durationFor(phase, state.config),
  };
}

export type TimerAction =
  | { type: "start"; now: number }
  | { type: "tick"; now: number }
  | { type: "abort"; now: number }
  | { type: "set_result"; index: number; result: SetResult }
  | { type: "skip_rest"; now: number };

export function reduce(state: TimerState, action: TimerAction): TimerState {
  switch (action.type) {
    case "start": {
      if (state.phase !== "idle") return state;
      return enterPhase(
        { ...state, setIndex: 0 },
        "countdown",
        action.now,
      );
    }

    case "tick": {
      if (state.phaseEndAt == null) return state;
      if (action.now < state.phaseEndAt) return state;

      // 페이즈 종료 → 다음 페이즈로
      if (state.phase === "countdown") {
        return enterPhase(state, "hang", action.now);
      }
      if (state.phase === "hang") {
        // 마지막 세트면 done, 아니면 rest
        if (state.setIndex >= state.config.totalSets - 1) {
          return enterPhase(state, "done", action.now);
        }
        return enterPhase(state, "rest", action.now);
      }
      if (state.phase === "rest") {
        return enterPhase(
          { ...state, setIndex: state.setIndex + 1 },
          "countdown",
          action.now,
        );
      }
      return state;
    }

    case "abort": {
      return enterPhase({ ...state, aborted: true }, "done", action.now);
    }

    case "set_result": {
      if (action.index < 0 || action.index >= state.config.totalSets) return state;
      const next = [...state.setResults];
      next[action.index] = action.result;
      return { ...state, setResults: next };
    }

    case "skip_rest": {
      // 휴식 단축: 즉시 다음 카운트다운으로
      if (state.phase !== "rest") return state;
      return enterPhase(
        { ...state, setIndex: state.setIndex + 1 },
        "countdown",
        action.now,
      );
    }
  }
}

// ── 파생 selectors ──

export function remainingMs(state: TimerState, now: number): number {
  if (state.phaseEndAt == null) return 0;
  return Math.max(0, state.phaseEndAt - now);
}

export function remainingSeconds(state: TimerState, now: number): number {
  return Math.ceil(remainingMs(state, now) / 1000);
}

export function progress01(state: TimerState, now: number): number {
  if (state.phaseStartAt == null || state.phaseEndAt == null) return 0;
  const total = state.phaseEndAt - state.phaseStartAt;
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, (now - state.phaseStartAt) / total));
}

export function successCount(state: TimerState): number {
  return state.setResults.filter((r) => r === "success").length;
}

export function completedCount(state: TimerState): number {
  return state.setResults.filter((r) => r !== null).length;
}
