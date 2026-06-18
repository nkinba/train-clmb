import { useMemo } from "react";
import {
  useHangboardLogsForSession,
  type HangboardLogRecord,
} from "@/lib/hangboard";
import {
  useClimbingLogsForSession,
  type ClimbingLogRecord,
} from "@/lib/climbing";
import {
  useStrengthLogsForSession,
  type StrengthLogRecord,
} from "@/lib/strength";
import {
  useCampusLogsForSession,
  type CampusLogRecord,
} from "@/lib/campus";

export type TimelineKind = "hangboard" | "climbing" | "strength" | "campus";

export type TimelineEntry = {
  id: string;
  kind: TimelineKind;
  created: string;
  summary: string;
};

/** 항목 클릭 시 이동할 모듈 라우트 (campus는 strength 페이지에서 입력). */
export function routeOfKind(kind: TimelineKind): string {
  switch (kind) {
    case "hangboard":
      return "/sessions/active/hangboard/";
    case "climbing":
      return "/sessions/active/climbing/";
    case "strength":
    case "campus":
      return "/sessions/active/strength/";
  }
}

export function labelOfKind(kind: TimelineKind): string {
  switch (kind) {
    case "hangboard":
      return "행보드";
    case "climbing":
      return "등반";
    case "strength":
      return "근력";
    case "campus":
      return "캠퍼스";
  }
}

/**
 * 활성 세션의 4개 child 컬렉션을 병렬 fetch + created desc로 정렬한 단일 timeline.
 * 각 row는 모듈 라벨·핵심 수치 한 줄로 정규화.
 */
export function useActiveSessionLogs(sessionId: string | null) {
  const hang = useHangboardLogsForSession(sessionId);
  const climb = useClimbingLogsForSession(sessionId);
  const str = useStrengthLogsForSession(sessionId);
  const camp = useCampusLogsForSession(sessionId);

  const isLoading =
    hang.isLoading || climb.isLoading || str.isLoading || camp.isLoading;
  const isError =
    hang.isError || climb.isError || str.isError || camp.isError;

  const entries = useMemo<TimelineEntry[]>(() => {
    const list: TimelineEntry[] = [];
    for (const r of hang.data ?? []) list.push(toHangboardEntry(r));
    for (const r of climb.data ?? []) list.push(toClimbingEntry(r));
    for (const r of str.data ?? []) list.push(toStrengthEntry(r));
    for (const r of camp.data ?? []) list.push(toCampusEntry(r));
    // ISO 문자열 sort — created desc.
    list.sort((a, b) => b.created.localeCompare(a.created));
    return list;
  }, [hang.data, climb.data, str.data, camp.data]);

  return { entries, isLoading, isError };
}

// ── 정규화 ──

function toHangboardEntry(r: HangboardLogRecord): TimelineEntry {
  const grip = r.grip_type === "half_crimp" ? "하프크림프" : "오픈";
  const weight = r.weight_offset_kg
    ? ` · ${r.weight_offset_kg > 0 ? "+" : ""}${r.weight_offset_kg}kg`
    : "";
  return {
    id: r.id,
    kind: "hangboard",
    created: r.created,
    summary: `${r.hold_size_mm}mm ${grip} · ${r.success_sets}/${r.total_sets}세트${weight}`,
  };
}

function toClimbingEntry(r: ClimbingLogRecord): TimelineEntry {
  const mode = r.type === "Lead" ? "리드" : "볼더";
  // Bouldering일 때만 is_send 표시 (Lead의 is_send는 의미 없음 — PRD §3).
  const send = r.type === "Bouldering" && r.is_send ? " · 완등" : "";
  return {
    id: r.id,
    kind: "climbing",
    created: r.created,
    summary: `${mode} ${r.grade} · ${r.attempts}회${send}`,
  };
}

function toStrengthEntry(r: StrengthLogRecord): TimelineEntry {
  const weight =
    r.added_weight_kg !== 0
      ? `${r.added_weight_kg > 0 ? "+" : ""}${r.added_weight_kg}kg · `
      : "";
  return {
    id: r.id,
    kind: "strength",
    created: r.created,
    summary: `${r.exercise_name} · ${weight}${r.reps}×${r.sets}`,
  };
}

function toCampusEntry(r: CampusLogRecord): TimelineEntry {
  const rung =
    r.rung_size === "large" ? "L" : r.rung_size === "medium" ? "M" : "S";
  return {
    id: r.id,
    kind: "campus",
    created: r.created,
    summary: `${r.exercise_type} (${rung}) · ${r.success_sets}/${r.total_sets}세트`,
  };
}
