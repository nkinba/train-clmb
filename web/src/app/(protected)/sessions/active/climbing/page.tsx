"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Trash2 } from "lucide-react";
import { GradePicker } from "@/components/climbing/grade-picker";
import { RestTimer } from "@/components/climbing/rest-timer";
import { NumberStepper } from "@/components/number-stepper";
import { RpeSelector } from "@/components/rpe-selector";
import { cn } from "@/lib/utils";
import {
  gradesFor,
  useClimbingLogsForSession,
  useCreateClimbingLog,
  useDeleteClimbingLog,
  type ClimbingType,
} from "@/lib/climbing";
import { getActiveSessionId } from "@/lib/sessions";

type Rpe = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export default function ClimbingPage() {
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

  const [type, setType] = useState<ClimbingType>("Bouldering");
  const [grade, setGrade] = useState<string>(() => gradesFor("Bouldering")[0]);
  const [attempts, setAttempts] = useState(1);
  const [isSend, setIsSend] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [notes, setNotes] = useState("");
  const [rpe, setRpe] = useState<Rpe | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onChangeType = (next: ClimbingType) => {
    setType(next);
    // 그레이드 디폴트를 모드에 맞게 리셋
    setGrade(gradesFor(next)[0]);
    if (next === "Lead") setIsSend(false);
  };

  const create = useCreateClimbingLog();
  const del = useDeleteClimbingLog();
  const logsQuery = useClimbingLogsForSession(sessionId);

  const onDelete = (id: string) => {
    if (!window.confirm("이 기록을 삭제할까요?")) return;
    del.mutate(id);
  };

  const onSave = () => {
    if (!sessionId) return;
    setError(null);
    create.mutate(
      {
        session_id: sessionId,
        type,
        grade,
        attempts,
        is_send: type === "Bouldering" ? isSend : false,
        project_name: projectName,
        notes,
        rpe: rpe ?? undefined,
      },
      {
        onSuccess: () => {
          // 다음 입력 준비 — 핵심 옵션만 유지, 메모/시도 횟수 리셋.
          setAttempts(1);
          setIsSend(false);
          setNotes("");
          setRpe(null);
        },
        onError: (err) =>
          setError(err instanceof Error ? err.message : "저장 실패"),
      },
    );
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
          <h1 className="text-h1 font-bold text-fg-primary">등반</h1>
          <p className="text-caption text-fg-muted">
            시도/완등 기록 — 저장 시 누적
          </p>
        </div>
      </header>

      {/* 모드 토글 */}
      <section
        role="radiogroup"
        aria-label="등반 모드"
        className="grid grid-cols-2 gap-2"
      >
        {(["Bouldering", "Lead"] as ClimbingType[]).map((m) => {
          const selected = m === type;
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChangeType(m)}
              className={cn(
                "h-tap-default rounded-md border-2 text-bodyLg font-semibold",
                selected
                  ? "border-brand bg-brand text-on-brand"
                  : "border-transparent bg-elevated text-fg-primary",
              )}
            >
              {m === "Bouldering" ? "볼더링" : "리드"}
            </button>
          );
        })}
      </section>

      {/* 그레이드 */}
      <GradePicker
        value={grade}
        options={gradesFor(type)}
        onChange={setGrade}
        label="그레이드"
      />

      {/* 시도 */}
      <NumberStepper
        label="시도 횟수"
        value={attempts}
        onChange={setAttempts}
        min={1}
        max={50}
        unit="회"
      />

      {/* 완등 토글 — 볼더링에만 표시. Lead는 PRD §3 "Lead일 때 의미 없음". */}
      {type === "Bouldering" && (
        <section className="flex flex-col gap-2">
          <span className="text-caption text-fg-secondary">완등 여부</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={!isSend}
              onClick={() => setIsSend(false)}
              className={cn(
                "h-tap-default rounded-md border-2 text-bodyLg font-semibold",
                !isSend
                  ? "border-fg-primary bg-elevated text-fg-primary"
                  : "border-transparent bg-elevated text-fg-muted",
              )}
            >
              시도만
            </button>
            <button
              type="button"
              role="switch"
              aria-checked={isSend}
              onClick={() => setIsSend(true)}
              className={cn(
                "h-tap-default rounded-md border-2 text-bodyLg font-semibold",
                isSend
                  ? "border-success bg-success text-on-success"
                  : "border-transparent bg-elevated text-fg-muted",
              )}
            >
              ✓ 완등
            </button>
          </div>
        </section>
      )}

      {/* 프로젝트 이름 (옵션) */}
      <label className="block">
        <span className="text-caption text-fg-secondary">프로젝트 이름 (선택)</span>
        <input
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder="예) 빨간 슬랩"
          maxLength={100}
          autoComplete="off"
          inputMode="text"
          className="mt-1 h-tap-default w-full rounded-md bg-surface px-3 text-fg-primary outline-none placeholder:text-fg-muted"
        />
      </label>

      {/* 메모 */}
      <label className="block">
        <span className="text-caption text-fg-secondary">메모 (선택)</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          maxLength={2000}
          autoComplete="off"
          inputMode="text"
          className="mt-1 w-full rounded-md bg-surface px-3 py-2 text-fg-primary outline-none"
        />
      </label>

      {/* RPE */}
      <RpeSelector value={rpe} onChange={setRpe} />

      {/* 볼더링 휴식 타이머 (3분) */}
      {type === "Bouldering" && <RestTimer defaultSec={180} />}

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

      {/* 누적된 row */}
      <section aria-label="이번 세션 기록" className="flex flex-col gap-2">
        <h2 className="text-h3 font-semibold text-fg-primary">
          이번 세션 기록
        </h2>
        {logsQuery.isPending && (
          <p className="text-caption text-fg-muted">불러오는 중…</p>
        )}
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
                <span className="text-bodyLg text-fg-primary tabular-nums">
                  {row.grade}
                </span>
                <span className="flex-1 text-caption text-fg-muted">
                  {row.type === "Bouldering" ? "볼더링" : "리드"} · 시도{" "}
                  {row.attempts}
                  {row.type === "Bouldering" && row.is_send && " · ✓"}
                  {row.rpe != null && row.rpe > 0 ? ` · RPE ${row.rpe}` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => onDelete(row.id)}
                  disabled={del.isPending}
                  aria-label={`${row.grade} 기록 삭제`}
                  className="flex h-tap w-tap items-center justify-center rounded-md text-fg-muted hover:bg-elevated hover:text-status-danger disabled:opacity-50"
                >
                  <Trash2 size={18} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
