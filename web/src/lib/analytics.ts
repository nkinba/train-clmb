import { useQuery } from "@tanstack/react-query";
import { Collections, pb } from "@/lib/pb";
import type { HangboardLogRecord } from "@/lib/hangboard";
import type { ClimbingLogRecord } from "@/lib/climbing";
import type { SessionRecord } from "@/lib/sessions";

/**
 * 분석 화면용 통합 fetch (S16, PRD §7).
 * 단일 사용자라 데이터 양이 작음 가정 → 모든 row를 한 번에 가져와 클라이언트에서 집계.
 * 운영 1년 기준 ~200 세션 × child 1-5 row = 수천 row까지 안전.
 */

const PER_PAGE = 1000;

async function fetchAll<T>(collection: string): Promise<T[]> {
  return await pb.collection(collection).getFullList<T>({
    sort: "+created",
    batch: PER_PAGE,
  });
}

export type AnalyticsBundle = {
  sessions: SessionRecord[];
  hangboard: HangboardLogRecord[];
  climbing: ClimbingLogRecord[];
};

export function useAnalyticsBundle() {
  return useQuery({
    queryKey: ["analytics", "bundle"] as const,
    queryFn: async (): Promise<AnalyticsBundle> => {
      const [sessions, hangboard, climbing] = await Promise.all([
        fetchAll<SessionRecord>(Collections.Sessions),
        fetchAll<HangboardLogRecord>(Collections.HangboardLogs),
        fetchAll<ClimbingLogRecord>(Collections.ClimbingLogs),
      ]);
      return { sessions, hangboard, climbing };
    },
  });
}

// ── 1. 그립별 최대 +kg 월간 추이 ──────────────────────────────────────────

export type GripMaxKgPoint = {
  /** yyyy-mm */
  month: string;
  half_crimp: number | null;
  open_hand: number | null;
};

export function buildGripMaxKg(rows: HangboardLogRecord[]): GripMaxKgPoint[] {
  // month → grip → max(+kg)
  const by: Record<string, { half_crimp: number; open_hand: number }> = {};
  for (const r of rows) {
    const m = monthKey(r.created);
    by[m] ??= { half_crimp: -Infinity, open_hand: -Infinity };
    const cur = by[m][r.grip_type];
    if (r.weight_offset_kg > cur) by[m][r.grip_type] = r.weight_offset_kg;
  }
  return Object.entries(by)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month,
      half_crimp: v.half_crimp === -Infinity ? null : v.half_crimp,
      open_hand: v.open_hand === -Infinity ? null : v.open_hand,
    }));
}

// ── 2. 주간 등반 볼륨 (PRD §5 — attempts + 난이도 가중치) ─────────────────

export type WeeklyClimbPoint = {
  /** yyyy-Www (ISO week) */
  week: string;
  attempts: number;
  weighted: number; // attempts × grade weight
};

function gradeWeight(grade: string): number {
  // V4 → 4, V8 → 8, 5.10a → 10, 5.11d → 11.x 등 단순 추출.
  const v = /^V(\d+)$/i.exec(grade);
  if (v) return Number(v[1]);
  const r = /^5\.(\d+)([a-d])?$/i.exec(grade);
  if (r) {
    const major = Number(r[1]);
    const sub = r[2] ? "abcd".indexOf(r[2].toLowerCase()) * 0.25 : 0;
    return major + sub;
  }
  return 0;
}

export function buildWeeklyClimb(rows: ClimbingLogRecord[]): WeeklyClimbPoint[] {
  const by: Record<string, { attempts: number; weighted: number }> = {};
  for (const r of rows) {
    const w = isoWeekKey(r.created);
    by[w] ??= { attempts: 0, weighted: 0 };
    by[w].attempts += r.attempts;
    by[w].weighted += r.attempts * gradeWeight(r.grade);
  }
  return Object.entries(by)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, v]) => ({ week, ...v }));
}

// ── 3. 주간 행보드 총 매달리기 초 ─────────────────────────────────────────

export type WeeklyHangPoint = {
  week: string;
  total_sec: number;
  sessions: number;
};

export function buildWeeklyHang(rows: HangboardLogRecord[]): WeeklyHangPoint[] {
  const by: Record<string, { total_sec: number; session_ids: Set<string> }> = {};
  for (const r of rows) {
    const w = isoWeekKey(r.created);
    by[w] ??= { total_sec: 0, session_ids: new Set() };
    by[w].total_sec += r.total_sets * r.actual_hang_seconds;
    by[w].session_ids.add(r.session_id);
  }
  return Object.entries(by)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, v]) => ({
      week,
      total_sec: v.total_sec,
      sessions: v.session_ids.size,
    }));
}

// ── 4. 월간 통증 캘린더 ───────────────────────────────────────────────────

export type PainDay = {
  /** yyyy-mm-dd */
  date: string;
  /** 0–3, max of session.shoulder_pain_* / finger_pain_* */
  pain: number;
};

export function buildPainCalendar(rows: SessionRecord[]): PainDay[] {
  const by: Record<string, number> = {};
  for (const r of rows) {
    const day = dayKey(r.date);
    const max = Math.max(
      r.shoulder_pain_start ?? 0,
      r.shoulder_pain_end ?? 0,
      r.finger_pain_start ?? 0,
      r.finger_pain_end ?? 0,
    );
    if (by[day] == null || max > by[day]) by[day] = max;
  }
  return Object.entries(by)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, pain]) => ({ date, pain }));
}

// ── 5. 프로젝트 타임라인 (5.12/V7 마일스톤) ───────────────────────────────

export type ProjectProgress = {
  project_name: string;
  attempts: number;
  sends: number;
  first_attempt: string;
  last_attempt: string;
  grade: string;
};

export function buildProjects(rows: ClimbingLogRecord[]): ProjectProgress[] {
  const by: Record<string, ProjectProgress> = {};
  for (const r of rows) {
    const name = r.project_name?.trim();
    if (!name) continue;
    by[name] ??= {
      project_name: name,
      attempts: 0,
      sends: 0,
      first_attempt: r.created,
      last_attempt: r.created,
      grade: r.grade,
    };
    by[name].attempts += r.attempts;
    if (r.type === "Bouldering" && r.is_send) by[name].sends += 1;
    if (r.created < by[name].first_attempt) by[name].first_attempt = r.created;
    if (r.created > by[name].last_attempt) by[name].last_attempt = r.created;
    by[name].grade = r.grade;
  }
  return Object.values(by).sort(
    (a, b) => b.last_attempt.localeCompare(a.last_attempt),
  );
}

// ── 시간 키 헬퍼 ──────────────────────────────────────────────────────────

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function isoWeekKey(iso: string): string {
  const d = new Date(iso);
  // ISO 8601 week 계산.
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = (target.getTime() - firstThursday.getTime()) / 86400000;
  const week = 1 + Math.round((diff - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${target.getUTCFullYear()}-W${pad(week)}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}
