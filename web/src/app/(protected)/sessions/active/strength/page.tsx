"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Trash2 } from "lucide-react";
import { NumberStepper } from "@/components/number-stepper";
import { RpeSelector } from "@/components/rpe-selector";
import { cn } from "@/lib/utils";
import {
  STRENGTH_PRESETS,
  useCreateStrengthLog,
  useDeleteStrengthLog,
  useStrengthLogsForSession,
} from "@/lib/strength";
import {
  CAMPUS_EXERCISE_LABEL,
  RUNG_LABEL,
  useCampusLogsForSession,
  useCreateCampusLog,
  useDeleteCampusLog,
  type CampusExerciseType,
  type RungSize,
} from "@/lib/campus";
import { getActiveSessionId } from "@/lib/sessions";

type Mode = "strength" | "campus";
type Rpe = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

const CAMPUS_TYPES: { id: CampusExerciseType; label: string }[] = [
  { id: "ladder", label: CAMPUS_EXERCISE_LABEL.ladder },
  { id: "touch", label: CAMPUS_EXERCISE_LABEL.touch },
  { id: "double_dyno", label: CAMPUS_EXERCISE_LABEL.double_dyno },
];

const RUNGS: { id: RungSize; label: string }[] = [
  { id: "large", label: RUNG_LABEL.large },
  { id: "medium", label: RUNG_LABEL.medium },
  { id: "small", label: RUNG_LABEL.small },
];

export default function StrengthPage() {
  const router = useRouter();

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

  const [mode, setMode] = useState<Mode>("strength");

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

  return (
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
          <h1 className="text-h1 font-bold text-fg-primary">보조 근력</h1>
          <p className="text-caption text-fg-muted">
            웨이트 또는 캠퍼스 보드
          </p>
        </div>
      </header>

      <section
        role="radiogroup"
        aria-label="모드"
        className="grid grid-cols-2 gap-2"
      >
        {(
          [
            { id: "strength", label: "웨이트" },
            { id: "campus", label: "캠퍼스" },
          ] as { id: Mode; label: string }[]
        ).map(({ id, label }) => {
          const selected = id === mode;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => setMode(id)}
              className={cn(
                "h-tap-default rounded-md border-2 text-bodyLg font-semibold",
                selected
                  ? "border-brand bg-brand text-on-brand"
                  : "border-transparent bg-elevated text-fg-primary",
              )}
            >
              {label}
            </button>
          );
        })}
      </section>

      {/* 두 폼을 모두 마운트 유지 + hidden 토글 — 모드 전환 시 입력 손실 방지.
        * (각 폼의 useState 초기화를 피해 60초 연속 입력 흐름의 신뢰성 확보.) */}
      <div hidden={mode !== "strength"}>
        <StrengthForm sessionId={sessionId} />
      </div>
      <div hidden={mode !== "campus"}>
        <CampusForm sessionId={sessionId} />
      </div>
    </main>
  );
}

function StrengthForm({ sessionId }: { sessionId: string }) {
  const create = useCreateStrengthLog();
  const del = useDeleteStrengthLog();
  const logsQuery = useStrengthLogsForSession(sessionId);

  const onDelete = (id: string) => {
    if (!window.confirm("이 기록을 삭제할까요?")) return;
    del.mutate(id);
  };

  const [exerciseName, setExerciseName] = useState<string>(STRENGTH_PRESETS[0]);
  const [customName, setCustomName] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [weight, setWeight] = useState(0);
  const [reps, setReps] = useState(8);
  const [sets, setSets] = useState(3);
  const [rpe, setRpe] = useState<Rpe | null>(null);
  const [error, setError] = useState<string | null>(null);

  const effectiveName = useCustom ? customName.trim() : exerciseName;

  const onSave = () => {
    if (!effectiveName) {
      setError("종목 이름을 입력하세요.");
      return;
    }
    setError(null);
    create.mutate(
      {
        session_id: sessionId,
        exercise_name: effectiveName,
        added_weight_kg: weight,
        reps,
        sets,
        rpe: rpe ?? undefined,
      },
      {
        onSuccess: () => {
          // 다음 입력 준비 — 종목/세트/반복은 자주 같으므로 유지, 무게/RPE만 리셋.
          setWeight(0);
          setRpe(null);
        },
        onError: (err) =>
          setError(err instanceof Error ? err.message : "저장 실패"),
      },
    );
  };

  return (
    <>
      <section className="flex flex-col gap-2">
        <span className="text-caption text-fg-secondary">종목</span>
        <div className="grid grid-cols-2 gap-2">
          {STRENGTH_PRESETS.map((name) => {
            const selected = !useCustom && name === exerciseName;
            return (
              <button
                key={name}
                type="button"
                onClick={() => {
                  setUseCustom(false);
                  setExerciseName(name);
                }}
                className={cn(
                  "h-tap rounded-md text-caption font-semibold",
                  selected
                    ? "bg-brand text-on-brand"
                    : "bg-elevated text-fg-primary",
                )}
              >
                {name}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setUseCustom((v) => !v)}
          className={cn(
            "h-tap rounded-md text-caption font-semibold",
            useCustom
              ? "bg-brand text-on-brand"
              : "bg-elevated text-fg-primary",
          )}
        >
          {useCustom ? "직접 입력 사용 중" : "+ 직접 입력"}
        </button>
        {useCustom && (
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="종목 이름"
            maxLength={120}
            autoComplete="off"
            inputMode="text"
            className="h-tap-default w-full rounded-md bg-surface px-3 text-fg-primary outline-none placeholder:text-fg-muted"
          />
        )}
      </section>

      <NumberStepper
        label="추가 무게"
        value={weight}
        onChange={setWeight}
        min={-50}
        max={300}
        step={1}
        unit="kg"
      />
      <NumberStepper
        label="반복 횟수"
        value={reps}
        onChange={setReps}
        min={1}
        max={100}
        unit="회"
      />
      <NumberStepper
        label="세트 수"
        value={sets}
        onChange={setSets}
        min={1}
        max={20}
        unit="세트"
      />

      <RpeSelector value={rpe} onChange={setRpe} />

      {error && (
        <p
          role="alert"
          className="rounded-md bg-elevated px-3 py-2 text-caption text-status-danger"
        >
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={onSave}
        disabled={create.isPending}
        className="h-tap-default w-full rounded-lg bg-brand text-on-brand text-bodyLg font-semibold transition-colors hover:bg-brand-hover active:bg-brand-active disabled:cursor-not-allowed disabled:opacity-50"
      >
        {create.isPending ? "저장 중…" : "+ 기록 추가"}
      </button>

      <section aria-label="이번 세션 웨이트 기록" className="flex flex-col gap-2">
        <h2 className="text-h3 font-semibold text-fg-primary">이번 세션 기록</h2>
        {logsQuery.data?.length === 0 && (
          <p className="text-caption text-fg-muted">아직 기록 없음</p>
        )}
        {logsQuery.data && logsQuery.data.length > 0 && (
          <ul className="flex flex-col gap-2">
            {logsQuery.data.map((row) => (
              <li
                key={row.id}
                className="flex items-center gap-2 rounded-md bg-surface px-3 py-2"
              >
                <span className="flex-1 text-bodyLg text-fg-primary">
                  {row.exercise_name}
                </span>
                <span className="text-caption text-fg-muted tabular-nums">
                  {row.sets}×{row.reps}
                  {row.added_weight_kg !== 0 &&
                    ` · ${row.added_weight_kg > 0 ? "+" : ""}${row.added_weight_kg}kg`}
                  {row.rpe != null && ` · RPE ${row.rpe}`}
                </span>
                <button
                  type="button"
                  onClick={() => onDelete(row.id)}
                  disabled={del.isPending}
                  aria-label={`${row.exercise_name} 기록 삭제`}
                  className="flex h-tap w-tap items-center justify-center rounded-md text-fg-muted hover:bg-elevated hover:text-status-danger disabled:opacity-50"
                >
                  <Trash2 size={18} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function CampusForm({ sessionId }: { sessionId: string }) {
  const create = useCreateCampusLog();
  const del = useDeleteCampusLog();
  const logsQuery = useCampusLogsForSession(sessionId);

  const onDelete = (id: string) => {
    if (!window.confirm("이 기록을 삭제할까요?")) return;
    del.mutate(id);
  };

  const [exerciseType, setExerciseType] = useState<CampusExerciseType>("ladder");
  const [rungSize, setRungSize] = useState<RungSize>("medium");
  const [movements, setMovements] = useState("");
  const [successSets, setSuccessSets] = useState(0);
  const [totalSets, setTotalSets] = useState(3);
  const [error, setError] = useState<string | null>(null);

  const onSave = () => {
    setError(null);
    if (successSets > totalSets) {
      setError("성공 세트가 총 세트보다 많을 수 없습니다.");
      return;
    }
    create.mutate(
      {
        session_id: sessionId,
        exercise_type: exerciseType,
        rung_size: rungSize,
        movements,
        success_sets: successSets,
        total_sets: totalSets,
      },
      {
        onSuccess: () => {
          // movements/successSets만 리셋 (totalSets/rung/type 유지).
          setMovements("");
          setSuccessSets(0);
        },
        onError: (err) =>
          setError(err instanceof Error ? err.message : "저장 실패"),
      },
    );
  };

  return (
    <>
      <section
        role="radiogroup"
        aria-label="캠퍼스 종목"
        className="grid grid-cols-3 gap-2"
      >
        {CAMPUS_TYPES.map(({ id, label }) => {
          const selected = id === exerciseType;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => setExerciseType(id)}
              className={cn(
                "h-tap rounded-md text-caption font-semibold",
                selected
                  ? "bg-brand text-on-brand"
                  : "bg-elevated text-fg-primary",
              )}
            >
              {label}
            </button>
          );
        })}
      </section>

      <section
        role="radiogroup"
        aria-label="렁 사이즈"
        className="flex flex-col gap-2"
      >
        <span className="text-caption text-fg-secondary">렁 사이즈</span>
        <div className="grid grid-cols-3 gap-2">
          {RUNGS.map(({ id, label }) => {
            const selected = id === rungSize;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => setRungSize(id)}
                className={cn(
                  "h-tap rounded-md text-caption font-semibold",
                  selected
                    ? "bg-brand text-on-brand"
                    : "bg-elevated text-fg-primary",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </section>

      <label className="block">
        <span className="text-caption text-fg-secondary">무브먼트 (선택)</span>
        <input
          type="text"
          value={movements}
          onChange={(e) => setMovements(e.target.value)}
          placeholder="예) 1-3-5"
          maxLength={60}
          autoComplete="off"
          inputMode="text"
          className="mt-1 h-tap-default w-full rounded-md bg-surface px-3 text-fg-primary outline-none placeholder:text-fg-muted"
        />
      </label>

      <NumberStepper
        label="성공 세트"
        value={successSets}
        onChange={setSuccessSets}
        min={0}
        max={50}
        unit="세트"
      />
      <NumberStepper
        label="총 세트"
        value={totalSets}
        onChange={setTotalSets}
        min={1}
        max={50}
        unit="세트"
      />

      {error && (
        <p
          role="alert"
          className="rounded-md bg-elevated px-3 py-2 text-caption text-status-danger"
        >
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={onSave}
        disabled={create.isPending}
        className="h-tap-default w-full rounded-lg bg-brand text-on-brand text-bodyLg font-semibold transition-colors hover:bg-brand-hover active:bg-brand-active disabled:cursor-not-allowed disabled:opacity-50"
      >
        {create.isPending ? "저장 중…" : "+ 기록 추가"}
      </button>

      <section aria-label="이번 세션 캠퍼스 기록" className="flex flex-col gap-2">
        <h2 className="text-h3 font-semibold text-fg-primary">이번 세션 기록</h2>
        {logsQuery.data?.length === 0 && (
          <p className="text-caption text-fg-muted">아직 기록 없음</p>
        )}
        {logsQuery.data && logsQuery.data.length > 0 && (
          <ul className="flex flex-col gap-2">
            {logsQuery.data.map((row) => (
              <li
                key={row.id}
                className="flex items-center gap-2 rounded-md bg-surface px-3 py-2"
              >
                <span className="flex-1 text-bodyLg text-fg-primary">
                  {CAMPUS_EXERCISE_LABEL[row.exercise_type]}
                </span>
                <span className="text-caption text-fg-muted tabular-nums">
                  {RUNG_LABEL[row.rung_size]} · {row.success_sets}/{row.total_sets}
                  {row.movements && ` · ${row.movements}`}
                </span>
                <button
                  type="button"
                  onClick={() => onDelete(row.id)}
                  disabled={del.isPending}
                  aria-label={`${CAMPUS_EXERCISE_LABEL[row.exercise_type]} 기록 삭제`}
                  className="flex h-tap w-tap items-center justify-center rounded-md text-fg-muted hover:bg-elevated hover:text-status-danger disabled:opacity-50"
                >
                  <Trash2 size={18} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
