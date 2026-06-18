"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Dumbbell, Hand, Mountain, Plus, Timer, type LucideIcon } from "lucide-react";
import { AddModuleSheet } from "@/components/add-module-sheet";
import { NumberStepper } from "@/components/number-stepper";
import { PainSelector } from "@/components/pain-selector";
import {
  getActiveSessionId,
  setActiveSessionId,
  useEndSession,
  useSession,
  type PainLevel,
} from "@/lib/sessions";
import {
  labelOfKind,
  routeOfKind,
  useActiveSessionLogs,
  type TimelineEntry,
  type TimelineKind,
} from "@/lib/active-logs";

export default function ActiveSessionPage() {
  const router = useRouter();

  // 활성 세션 ID는 localStorage. SSR/static export에서는 항상 null로 시작.
  const [activeId, setActiveId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const id = getActiveSessionId();
    if (!id) {
      router.replace("/sessions/new/");
      return;
    }
    setActiveId(id);
    setChecked(true);
  }, [router]);

  const sessionQuery = useSession(activeId);
  const endSession = useEndSession(activeId);
  const timeline = useActiveSessionLogs(activeId);
  const [addOpen, setAddOpen] = useState(false);

  // PB에서 해당 ID가 404면 localStorage가 stale — 정리 후 새 세션 폼으로.
  // (다른 디바이스에서 종료했거나 admin UI에서 삭제된 경우.)
  useEffect(() => {
    const err = sessionQuery.error as { status?: number } | null;
    if (err?.status === 404) {
      setActiveSessionId(null);
      router.replace("/sessions/new/");
    }
  }, [sessionQuery.error, router]);

  const [showEndForm, setShowEndForm] = useState(false);
  const [shoulderPainEnd, setShoulderPainEnd] = useState<PainLevel>(0);
  const [fingerPainEnd, setFingerPainEnd] = useState<PainLevel>(0);
  const [totalMins, setTotalMins] = useState(60);
  const [notes, setNotes] = useState("");

  if (!checked) {
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

  const session = sessionQuery.data;

  const onEnd = (e: React.FormEvent) => {
    e.preventDefault();
    endSession.mutate(
      {
        shoulder_pain_end: shoulderPainEnd,
        finger_pain_end: fingerPainEnd,
        total_time_mins: totalMins,
        notes: notes.trim(),
      },
      {
        onSuccess: () => {
          router.replace("/");
        },
      },
    );
  };

  const endErrMessage =
    endSession.error instanceof Error
      ? endSession.error.message
      : endSession.error
        ? "세션 종료 실패"
        : null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6 pb-[calc(var(--spacing-tab-bar)+2rem)]">
      <header>
        <h1 className="text-h1 font-bold text-fg-primary">현재 세션</h1>
        <p className="text-caption text-fg-muted">운동을 추가하면 아래 기록에 누적됩니다.</p>
      </header>

      {sessionQuery.isPending && (
        <p className="text-fg-secondary">세션 정보를 불러오는 중…</p>
      )}

      {sessionQuery.error && (
        <div className="rounded-lg bg-elevated p-4">
          <p className="text-status-danger font-semibold">세션을 불러올 수 없습니다.</p>
          <p className="mt-1 text-caption text-fg-muted">
            {sessionQuery.error instanceof Error
              ? sessionQuery.error.message
              : "unknown error"}
          </p>
        </div>
      )}

      {session && (
        <>
          <section className="rounded-lg bg-surface p-4">
            <dl className="space-y-2 text-body">
              <div className="flex justify-between gap-3">
                <dt className="text-fg-muted">날짜</dt>
                <dd className="text-fg-primary">{formatDate(session.date)}</dd>
              </div>
              {session.location && (
                <div className="flex justify-between gap-3">
                  <dt className="text-fg-muted">장소</dt>
                  <dd className="text-fg-primary">{session.location}</dd>
                </div>
              )}
              {session.target && (
                <div className="flex justify-between gap-3">
                  <dt className="text-fg-muted">타깃</dt>
                  <dd className="text-fg-primary text-right">{session.target}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-fg-muted">시작 통증</dt>
                <dd className="text-fg-primary">
                  어깨 {session.shoulder_pain_start} · 손가락{" "}
                  {session.finger_pain_start}
                </dd>
              </div>
            </dl>
          </section>

          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="flex h-tap-default w-full items-center justify-center gap-2 rounded-lg bg-brand text-on-brand text-bodyLg font-semibold transition-colors hover:bg-brand-hover active:bg-brand-active"
          >
            <Plus size={20} aria-hidden />
            운동 추가
          </button>

          <Timeline timeline={timeline} />

          <AddModuleSheet open={addOpen} onClose={() => setAddOpen(false)} />

          {!showEndForm && (
            <button
              type="button"
              onClick={() => setShowEndForm(true)}
              className="h-tap-default w-full rounded-lg bg-brand text-on-brand text-bodyLg font-semibold transition-colors hover:bg-brand-hover active:bg-brand-active"
            >
              세션 종료
            </button>
          )}

          {showEndForm && (
            <form
              onSubmit={onEnd}
              className="flex flex-col gap-5 rounded-lg bg-surface p-4"
              aria-label="세션 종료 폼"
            >
              <h2 className="text-h3 font-semibold text-fg-primary">종료 기록</h2>

              <PainSelector
                partLabel="어깨"
                value={shoulderPainEnd}
                onChange={setShoulderPainEnd}
              />
              <PainSelector
                partLabel="손가락"
                value={fingerPainEnd}
                onChange={setFingerPainEnd}
              />

              <NumberStepper
                label="총 시간"
                value={totalMins}
                onChange={setTotalMins}
                min={0}
                max={600}
                step={5}
                unit="분"
              />

              <label className="block">
                <span className="text-caption text-fg-secondary">메모 (선택)</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  autoComplete="off"
                  inputMode="text"
                  className="mt-1 w-full rounded-md bg-elevated px-3 py-2 text-fg-primary outline-none"
                />
              </label>

              {endErrMessage && (
                <p
                  role="alert"
                  className="rounded-md bg-elevated px-3 py-2 text-caption text-status-danger"
                >
                  {endErrMessage}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowEndForm(false)}
                  disabled={endSession.isPending}
                  className="h-tap-default flex-1 rounded-lg bg-elevated text-fg-primary text-bodyLg font-semibold disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={endSession.isPending}
                  className="h-tap-default flex-1 rounded-lg bg-brand text-on-brand text-bodyLg font-semibold transition-colors hover:bg-brand-hover active:bg-brand-active disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {endSession.isPending ? "종료 중…" : "기록 저장"}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </main>
  );
}

function formatDate(iso: string): string {
  // PocketBase는 ISO datetime 또는 YYYY-MM-DD를 반환. 둘 다 Date로 파싱 가능.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
}

const KIND_ICON: Record<TimelineKind, LucideIcon> = {
  hangboard: Hand,
  climbing: Mountain,
  strength: Dumbbell,
  campus: Timer,
};

function Timeline({
  timeline,
}: {
  timeline: ReturnType<typeof useActiveSessionLogs>;
}) {
  if (timeline.isLoading && timeline.entries.length === 0) {
    return (
      <section aria-label="세션 기록" className="flex flex-col gap-2">
        <h2 className="text-caption text-fg-secondary">세션 기록</h2>
        <p className="text-caption text-fg-muted">불러오는 중…</p>
      </section>
    );
  }
  if (timeline.isError && timeline.entries.length === 0) {
    return (
      <section aria-label="세션 기록" className="flex flex-col gap-2">
        <h2 className="text-caption text-fg-secondary">세션 기록</h2>
        <p className="rounded-md bg-elevated px-3 py-2 text-caption text-status-danger">
          기록을 불러오지 못했습니다.
        </p>
      </section>
    );
  }
  return (
    <section aria-label="세션 기록" className="flex flex-col gap-2">
      <h2 className="text-caption text-fg-secondary">
        세션 기록 {timeline.entries.length > 0 && `· ${timeline.entries.length}건`}
      </h2>
      {timeline.entries.length === 0 ? (
        <p className="rounded-lg bg-surface px-3 py-4 text-caption text-fg-muted">
          아직 추가된 운동이 없습니다. 위 버튼으로 첫 운동을 추가하세요.
        </p>
      ) : (
        <ol reversed className="flex flex-col gap-2">
          {timeline.entries.map((e) => (
            <TimelineRow key={`${e.kind}-${e.id}`} entry={e} />
          ))}
        </ol>
      )}
    </section>
  );
}

function TimelineRow({ entry }: { entry: TimelineEntry }) {
  const Icon = KIND_ICON[entry.kind];
  return (
    <li>
      <Link
        href={routeOfKind(entry.kind)}
        className="flex items-center gap-3 rounded-lg bg-surface p-3 hover:bg-elevated"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-elevated text-fg-primary">
          <Icon size={18} aria-hidden />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-bodyLg font-semibold text-fg-primary">
              {labelOfKind(entry.kind)}
            </p>
            <time
              dateTime={entry.created}
              className="shrink-0 text-micro text-fg-muted"
            >
              {formatTime(entry.created)}
            </time>
          </div>
          <p className="truncate text-caption text-fg-secondary">
            {entry.summary}
          </p>
        </div>
      </Link>
    </li>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
