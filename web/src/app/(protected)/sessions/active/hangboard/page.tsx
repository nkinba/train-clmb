"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { HangboardSetup, type HangboardSetupValue } from "@/components/hangboard/hangboard-setup";
import { FullScreenTimer } from "@/components/hangboard/full-screen-timer";
import { HangboardSummary } from "@/components/hangboard/hangboard-summary";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { useAudioBeep, vibrate } from "@/hooks/use-audio-beep";
import { usePhaseNotification } from "@/hooks/use-phase-notification";
import { useCreateHangboardLog } from "@/lib/hangboard";
import {
  DEFAULT_CONFIG,
  completedCount,
  makeInitialState,
  reduce,
  remainingSeconds,
  successCount,
  type Phase,
  type SetResult,
  type TimerAction,
  type TimerState,
} from "@/lib/hangboard-timer";
import { getActiveSessionId } from "@/lib/sessions";

type Rpe = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

const DEFAULT_SETUP: HangboardSetupValue = {
  gripType: "half_crimp",
  holdSizeMm: 18,
  weightKg: 0,
  config: DEFAULT_CONFIG,
};

export default function HangboardPage() {
  const router = useRouter();

  // 세션 ID는 localStorage. 없으면 진입 차단.
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    const id = getActiveSessionId();
    if (!id) {
      router.replace("/sessions/new/");
      return;
    }
    setSessionId(id);
    setChecked(true);
  }, [router]);

  const [setup, setSetup] = useState<HangboardSetupValue>(DEFAULT_SETUP);

  // 머신을 useState로 운영 → setup.config 변경 시 idle이면 자동 reset 가능.
  const [state, setState] = useState<TimerState>(() => makeInitialState(setup.config));

  // idle 상태에서 setup.config 변경 시 머신을 새 길이/시간으로 갱신.
  useEffect(() => {
    if (state.phase === "idle") {
      setState(makeInitialState(setup.config));
    }
    // state.phase 의존성 추가하면 idle→countdown 직후 리셋 위험.
    // setup.config만 의존 + 내부에서 phase 가드.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup.config]);

  const dispatch = (action: TimerAction) => setState((s) => reduce(s, action));

  const isRunning = state.phase !== "idle" && state.phase !== "done";

  const { active: wakeActive, supported: wakeSupported } = useWakeLock(isRunning);
  const audio = useAudioBeep();
  const phaseNotif = usePhaseNotification();
  const createLog = useCreateHangboardLog();
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── tick 루프 ──
  // setInterval ~100ms (10Hz) — 디스플레이는 초 단위라 60Hz RAF는 배터리 낭비.
  // wall-clock Date.now()를 매 tick 비교하므로 백그라운드 throttle/포그라운드 복귀에 강건.
  // setInterval 자체도 백그라운드에서 throttle되지만 ADR-7대로 포그라운드 유지가 전제.
  const [, setNowTick] = useState(0);
  useEffect(() => {
    if (!isRunning) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      setState((s) => reduce(s, { type: "tick", now }));
      setNowTick((n) => n + 1);
    }, 100);
    return () => window.clearInterval(id);
  }, [isRunning]);

  // ── 페이즈 전환 신호 (beep + vibrate + 백그라운드 notification) ──
  // 자연 완료(done && !aborted)에만 완료 신호. abort는 사용자 의도이므로 silent.
  const prevPhaseRef = useRef<Phase>("idle");
  useEffect(() => {
    const prev = prevPhaseRef.current;
    const cur = state.phase;
    if (prev === cur) return;
    prevPhaseRef.current = cur;

    if (cur === "hang") {
      audio.beep({ freqHz: 1000, durationMs: 200, count: 1 });
      vibrate([200, 80, 200]);
      phaseNotif.notifyPhase("매달리기 시작", `세트 ${state.setIndex + 1}`);
    } else if (cur === "rest") {
      audio.beep({ freqHz: 660, durationMs: 250, count: 1 });
      vibrate(180);
      phaseNotif.notifyPhase("휴식", "다음 세트까지 휴식");
    } else if (cur === "countdown") {
      audio.beep({ freqHz: 440, durationMs: 100, count: 3 });
      vibrate([80, 60, 80, 60, 80]);
    } else if (cur === "done" && !state.aborted) {
      audio.beep({ freqHz: 800, durationMs: 250, count: 2 });
      vibrate([200, 100, 200, 100, 400]);
      phaseNotif.notifyPhase("세션 완료", "결과를 입력하세요");
    }
  }, [state.phase, state.setIndex, state.aborted, audio, phaseNotif]);

  const onStart = async () => {
    // 사용자 제스처 안에서 AudioContext unlock.
    // Notification 권한은 setup 화면의 명시적 버튼에서만 요청 — onStart에서 자동 요청 시
    // iOS Safari가 `await` 후 사용자 제스처 문맥을 잃어 권한 프롬프트가 무시될 수 있음.
    await audio.unlock();
    // 머신을 새로 시작 — 최신 setup.config 반영.
    setState(makeInitialState(setup.config));
    setState((s) => reduce(s, { type: "start", now: Date.now() }));
  };

  const onReset = () => {
    setState(makeInitialState(setup.config));
  };

  const onChangeResult = (index: number, result: SetResult) =>
    dispatch({ type: "set_result", index, result });

  const onSave = (rpe: Rpe | null) => {
    if (!sessionId) return;
    setSaveError(null);
    // total_sets: completedCount = 실제 결과 입력된 세트 수.
    //   PRD §5 성공 지표의 "주간 행보드 총 매달리기 초" 계산은 시도한 세트만 카운트해야
    //   abort된 미수행 세트가 볼륨에 잡히지 않음. setup.config.totalSets(계획치)는 부정확.
    // actual_hang_seconds: 현재는 setup.config.hangSeconds(target)와 동일.
    //   PRD §3은 실패 세트의 actual을 별도 기록 가능하다고 두지만, 세트별 actual을 측정하려면
    //   행보드 모듈을 hangboard_logs 1개 → hangboard_set_logs N개로 분할해야 해서 v1.1로 미룸.
    // rpe: PB는 undefined 키를 직렬화에서 제외하므로 미설정 시 omit해 PB schema의 min:1 검증 회피.
    const payload: Parameters<typeof createLog.mutate>[0] = {
      session_id: sessionId,
      hold_size_mm: setup.holdSizeMm,
      grip_type: setup.gripType,
      weight_offset_kg: setup.weightKg,
      success_sets: successCount(state),
      total_sets: completedCount(state),
      target_hang_seconds: setup.config.hangSeconds,
      actual_hang_seconds: setup.config.hangSeconds,
    };
    if (rpe != null) payload.rpe = rpe;
    createLog.mutate(payload, {
      onSuccess: () => router.replace("/sessions/active/"),
      onError: (err) =>
        setSaveError(err instanceof Error ? err.message : "저장 실패"),
    });
  };

  if (!checked || !sessionId) {
    return (
      <main
        role="status"
        aria-live="polite"
        className="flex flex-1 items-center justify-center"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-subtle border-t-fg-primary" />
      </main>
    );
  }

  const phase = state.phase;
  const showSetup = phase === "idle";
  const showTimer = isRunning;
  const showSummary = phase === "done";
  const now = Date.now();
  const remSec = remainingSeconds(state, now);

  return (
    <>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6 pb-[calc(var(--spacing-tab-bar)+2rem)]">
        <header className="flex items-center gap-2">
          <Link
            href="/sessions/active/"
            aria-label="세션 화면으로"
            className="flex h-tap w-tap items-center justify-center rounded-md text-fg-primary hover:bg-elevated"
          >
            <ChevronLeft size={24} aria-hidden />
          </Link>
          <div>
            <h1 className="text-h1 font-bold text-fg-primary">행보드</h1>
            <p className="text-caption text-fg-muted">
              {showSetup && "조건 설정 → 시작"}
              {showTimer && "매달리기 / 휴식 자동 사이클"}
              {showSummary && "결과 확인 후 저장"}
            </p>
          </div>
        </header>

        {showSetup && (
          <>
            <HangboardSetup
              value={setup}
              onChange={setSetup}
              onStart={onStart}
              startLabel="+ 타이머 시작"
            />
            <DeviceCapabilityHints
              wakeSupported={wakeSupported}
              notifPermission={phaseNotif.permission}
              onRequestNotif={phaseNotif.request}
            />
          </>
        )}

        {showSummary && (
          <HangboardSummary
            state={state}
            isSaving={createLog.isPending}
            saveError={saveError}
            onChangeResult={onChangeResult}
            onSave={onSave}
            onReset={onReset}
          />
        )}
      </main>

      {showTimer && (
        <FullScreenTimer
          state={state}
          remainingSec={remSec}
          now={now}
          onMarkResult={(r) =>
            dispatch({
              type: "set_result",
              index: state.setIndex,
              result: r,
            })
          }
          onAbort={() => dispatch({ type: "abort", now: Date.now() })}
          onSkipRest={() => dispatch({ type: "skip_rest", now: Date.now() })}
        />
      )}

      {showTimer && (
        <span className="sr-only" aria-live="assertive">
          {phase === "hang" && "매달리기 시작"}
          {phase === "rest" && "휴식"}
          {phase === "countdown" && "곧 시작"}
        </span>
      )}

      {showTimer && wakeSupported && !wakeActive && (
        <p
          role="status"
          aria-live="polite"
          className="fixed left-1/2 top-2 z-[60] -translate-x-1/2 rounded-full bg-elevated px-3 py-1 text-micro text-fg-muted"
        >
          화면 켜짐 잠금 비활성 — 시스템 권한 확인 필요
        </p>
      )}
    </>
  );
}

function DeviceCapabilityHints({
  wakeSupported,
  notifPermission,
  onRequestNotif,
}: {
  wakeSupported: boolean;
  notifPermission: "default" | "granted" | "denied" | "unsupported";
  onRequestNotif: () => void;
}) {
  return (
    <section className="rounded-lg bg-surface p-4 text-caption text-fg-secondary">
      <h2 className="text-bodyLg font-semibold text-fg-primary">디바이스 권한</h2>
      <ul className="mt-2 space-y-1">
        <li>
          • Wake Lock:{" "}
          {wakeSupported ? (
            <span className="text-status-success">지원</span>
          ) : (
            <span className="text-status-warning">미지원 (자동 화면 꺼짐 가능)</span>
          )}
        </li>
        <li>
          • 백그라운드 알림:{" "}
          {notifPermission === "granted" && (
            <span className="text-status-success">허용</span>
          )}
          {notifPermission === "denied" && (
            <span className="text-status-warning">차단됨 (포그라운드 사용 권장)</span>
          )}
          {notifPermission === "unsupported" && (
            <span className="text-status-warning">미지원</span>
          )}
          {notifPermission === "default" && (
            <button
              type="button"
              onClick={onRequestNotif}
              className="ml-2 rounded-md bg-elevated px-2 py-1 text-fg-primary"
            >
              권한 요청
            </button>
          )}
        </li>
        <li className="text-micro text-fg-muted">
          포그라운드 유지 + Wake Lock 조합이 권장 경로 (ADR-7).
        </li>
      </ul>
    </section>
  );
}
