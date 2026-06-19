"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useDeleteSession,
  useSession,
  getActiveSessionId,
} from "@/lib/sessions";
import {
  useDeleteHangboardLog,
  useHangboardLogsForSession,
} from "@/lib/hangboard";
import {
  useClimbingLogsForSession,
  useDeleteClimbingLog,
} from "@/lib/climbing";
import {
  useDeleteStrengthLog,
  useStrengthLogsForSession,
} from "@/lib/strength";
import {
  CAMPUS_EXERCISE_LABEL,
  RUNG_LABEL,
  useCampusLogsForSession,
  useDeleteCampusLog,
} from "@/lib/campus";
import { useSessionMedia } from "@/lib/media";
import { MediaGrid } from "@/components/media-grid";

// static export 호환: useSearchParams는 Suspense boundary 필요 (Next 13.4+).
export default function LogsDetailPage() {
  return (
    <Suspense fallback={<DetailSpinner />}>
      <LogsDetailInner />
    </Suspense>
  );
}

function DetailSpinner() {
  return (
    <main
      role="status"
      aria-live="polite"
      className="mx-auto flex w-full max-w-md flex-1 items-center justify-center px-4 py-6 pb-[calc(var(--spacing-tab-bar)+2rem)]"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-subtle border-t-fg-primary" />
    </main>
  );
}

function LogsDetailInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const id = sp.get("id");

  const sessionQ = useSession(id);
  const hangQ = useHangboardLogsForSession(id);
  const climbQ = useClimbingLogsForSession(id);
  const strengthQ = useStrengthLogsForSession(id);
  const campusQ = useCampusLogsForSession(id);
  const mediaQ = useSessionMedia(id);

  const delSession = useDeleteSession();
  const delHang = useDeleteHangboardLog();
  const delClimb = useDeleteClimbingLog();
  const delStrength = useDeleteStrengthLog();
  const delCampus = useDeleteCampusLog();

  const [activeId, setActiveId] = useState<string | null>(null);
  useEffect(() => {
    setActiveId(getActiveSessionId());
  }, []);

  if (!id) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6">
        <p
          role="alert"
          className="rounded-md bg-elevated px-3 py-2 text-caption text-status-danger"
        >
          세션 ID가 없습니다. 기록 list에서 다시 진입하세요.
        </p>
        <Link
          href="/logs/"
          className="h-tap-default rounded-md bg-brand text-center text-bodyLg font-semibold leading-[3.5rem] text-on-brand"
        >
          기록으로
        </Link>
      </main>
    );
  }

  const session = sessionQ.data;
  const isActive = id === activeId;

  const onDeleteSession = () => {
    if (!window.confirm("세션과 모든 하위 기록을 삭제할까요?")) return;
    delSession.mutate(id, {
      onSuccess: () => router.replace("/logs/"),
    });
  };

  const onDeleteRow = (
    kind: "hang" | "climb" | "strength" | "campus",
    rowId: string,
    label: string,
  ) => {
    if (!window.confirm(`${label} 기록을 삭제할까요?`)) return;
    const m = {
      hang: delHang,
      climb: delClimb,
      strength: delStrength,
      campus: delCampus,
    }[kind];
    m.mutate(rowId);
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6 pb-[calc(var(--spacing-tab-bar)+2rem)]">
      <header className="flex items-center gap-2">
        <Link
          href="/logs/"
          aria-label="기록 list로"
          className="flex h-tap w-tap items-center justify-center rounded-md text-fg-primary hover:bg-elevated"
        >
          <ChevronLeft size={24} aria-hidden />
        </Link>
        <div className="flex-1">
          <h1 className="text-h1 font-bold text-fg-primary">세션 상세</h1>
          {isActive && (
            <p className="text-caption text-status-info">진행 중</p>
          )}
        </div>
      </header>

      {sessionQ.isPending && (
        <p className="text-caption text-fg-muted">불러오는 중…</p>
      )}
      {sessionQ.error && (
        <p
          role="alert"
          className="rounded-md bg-elevated px-3 py-2 text-caption text-status-danger"
        >
          세션을 불러올 수 없습니다 (삭제되었거나 ID가 잘못됨).
        </p>
      )}

      {session && (
        <>
          <section className="rounded-lg bg-surface p-4">
            <dl className="space-y-2 text-body">
              <Row k="날짜" v={formatDate(session.date)} />
              {session.location && <Row k="장소" v={session.location} />}
              {session.target && <Row k="타깃" v={session.target} />}
              <Row
                k="총 시간"
                v={
                  session.total_time_mins > 0
                    ? `${session.total_time_mins}분`
                    : "종료 전"
                }
              />
              <Row
                k="통증 어깨"
                v={`${session.shoulder_pain_start} → ${session.shoulder_pain_end}`}
              />
              <Row
                k="통증 손가락"
                v={`${session.finger_pain_start} → ${session.finger_pain_end}`}
              />
              {session.notes?.trim() && (
                <Row k="메모" v={session.notes} multiline />
              )}
            </dl>
          </section>

          <LogGroup
            title="행보드"
            empty={hangQ.data?.length === 0}
            pending={hangQ.isPending}
          >
            {hangQ.data?.map((row) => (
              <LogRow
                key={row.id}
                label={`${row.grip_type === "half_crimp" ? "하프 크림프" : "오픈 핸드"} · ${row.hold_size_mm}mm`}
                meta={`${row.success_sets}/${row.total_sets} 세트 · ${row.target_hang_seconds}s${
                  row.weight_offset_kg !== 0
                    ? ` · ${row.weight_offset_kg > 0 ? "+" : ""}${row.weight_offset_kg}kg`
                    : ""
                }${row.rpe > 0 ? ` · RPE ${row.rpe}` : ""}`}
                onDelete={() =>
                  onDeleteRow("hang", row.id, "행보드")
                }
                deletePending={delHang.isPending}
              />
            ))}
          </LogGroup>

          <LogGroup
            title="등반"
            empty={climbQ.data?.length === 0}
            pending={climbQ.isPending}
          >
            {climbQ.data?.map((row) => (
              <LogRow
                key={row.id}
                label={row.grade}
                meta={`${row.type === "Bouldering" ? "볼더링" : "리드"} · 시도 ${row.attempts}${
                  row.type === "Bouldering" && row.is_send ? " · ✓" : ""
                }${row.rpe > 0 ? ` · RPE ${row.rpe}` : ""}`}
                onDelete={() => onDeleteRow("climb", row.id, "등반")}
                deletePending={delClimb.isPending}
              />
            ))}
          </LogGroup>

          <LogGroup
            title="웨이트"
            empty={strengthQ.data?.length === 0}
            pending={strengthQ.isPending}
          >
            {strengthQ.data?.map((row) => (
              <LogRow
                key={row.id}
                label={row.exercise_name}
                meta={`${row.sets}×${row.reps}${
                  row.added_weight_kg !== 0
                    ? ` · ${row.added_weight_kg > 0 ? "+" : ""}${row.added_weight_kg}kg`
                    : ""
                }${row.rpe > 0 ? ` · RPE ${row.rpe}` : ""}`}
                onDelete={() => onDeleteRow("strength", row.id, "웨이트")}
                deletePending={delStrength.isPending}
              />
            ))}
          </LogGroup>

          <LogGroup
            title="캠퍼스"
            empty={campusQ.data?.length === 0}
            pending={campusQ.isPending}
          >
            {campusQ.data?.map((row) => (
              <LogRow
                key={row.id}
                label={CAMPUS_EXERCISE_LABEL[row.exercise_type]}
                meta={`${RUNG_LABEL[row.rung_size]} · ${row.success_sets}/${row.total_sets}${
                  row.movements ? ` · ${row.movements}` : ""
                }`}
                onDelete={() => onDeleteRow("campus", row.id, "캠퍼스")}
                deletePending={delCampus.isPending}
              />
            ))}
          </LogGroup>

          <section aria-label="미디어" className="flex flex-col gap-2">
            <h2 className="text-caption text-fg-secondary">
              미디어{" "}
              {mediaQ.data && mediaQ.data.length > 0 && `· ${mediaQ.data.length}건`}
            </h2>
            {mediaQ.isPending ? (
              <p className="text-caption text-fg-muted">불러오는 중…</p>
            ) : mediaQ.data && mediaQ.data.length > 0 ? (
              <MediaGrid items={mediaQ.data} />
            ) : (
              <p className="rounded-lg bg-surface px-3 py-3 text-caption text-fg-muted">
                첨부된 미디어가 없습니다.
              </p>
            )}
          </section>

          <button
            type="button"
            onClick={onDeleteSession}
            disabled={delSession.isPending}
            className="h-tap-default w-full rounded-lg bg-elevated text-bodyLg font-semibold text-status-danger hover:bg-status-danger/10 disabled:opacity-50"
          >
            {delSession.isPending ? "삭제 중…" : "세션 + 모든 하위 기록 삭제"}
          </button>
        </>
      )}
    </main>
  );
}

// ── small components ──

function Row({
  k,
  v,
  multiline,
}: {
  k: string;
  v: string;
  multiline?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex gap-3",
        multiline ? "flex-col" : "items-baseline justify-between",
      )}
    >
      <dt className="text-fg-muted">{k}</dt>
      <dd
        className={cn(
          "text-fg-primary",
          multiline ? "whitespace-pre-wrap" : "text-right",
        )}
      >
        {v}
      </dd>
    </div>
  );
}

function LogGroup({
  title,
  empty,
  pending,
  children,
}: {
  title: string;
  empty: boolean | undefined;
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h2 className="text-h3 font-semibold text-fg-primary">{title}</h2>
      {pending && <p className="text-caption text-fg-muted">불러오는 중…</p>}
      {!pending && empty && (
        <p className="text-caption text-fg-muted">기록 없음</p>
      )}
      {!empty && <ul className="flex flex-col gap-2">{children}</ul>}
    </section>
  );
}

function LogRow({
  label,
  meta,
  onDelete,
  deletePending,
}: {
  label: string;
  meta: string;
  onDelete: () => void;
  deletePending: boolean;
}) {
  return (
    <li className="flex items-center gap-2 rounded-md bg-surface px-3 py-2">
      <div className="flex flex-1 flex-col">
        <span className="text-bodyLg font-semibold text-fg-primary tabular-nums">
          {label}
        </span>
        <span className="text-caption text-fg-muted">{meta}</span>
      </div>
      <button
        type="button"
        onClick={onDelete}
        disabled={deletePending}
        aria-label={`${label} 삭제`}
        className="flex h-tap w-tap items-center justify-center rounded-md text-fg-muted hover:bg-elevated hover:text-status-danger disabled:opacity-50"
      >
        <Trash2 size={18} aria-hidden />
      </button>
    </li>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
}
