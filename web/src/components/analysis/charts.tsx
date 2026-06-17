"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import type {
  GripMaxKgPoint,
  PainDay,
  ProjectProgress,
  WeeklyClimbPoint,
  WeeklyHangPoint,
} from "@/lib/analytics";

// design-tokens 색상 (Recharts는 className 지원이 약해서 명시 색 전달).
const COLOR = {
  brand: "#f97316",
  info: "#3b82f6",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#f43f5e",
  grid: "#27272a",
  axis: "#71717a",
  text: "#a1a1aa",
};

const tooltipStyle = {
  backgroundColor: "#18181b",
  border: "1px solid #27272a",
  borderRadius: 8,
  color: "#e4e4e7",
  fontSize: 12,
};

// ── 1. 그립별 +kg 월간 추이 ───────────────────────────────────────────────

export function GripMaxKgChart({ data }: { data: GripMaxKgPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={COLOR.grid} strokeDasharray="3 3" />
        <XAxis dataKey="month" stroke={COLOR.axis} fontSize={11} />
        <YAxis stroke={COLOR.axis} fontSize={11} />
        <Tooltip contentStyle={tooltipStyle} />
        <Line
          type="monotone"
          dataKey="half_crimp"
          name="하프 크림프"
          stroke={COLOR.brand}
          strokeWidth={2}
          dot={{ r: 3, fill: COLOR.brand }}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="open_hand"
          name="오픈 핸드"
          stroke={COLOR.info}
          strokeWidth={2}
          dot={{ r: 3, fill: COLOR.info }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── 2. 주간 등반 볼륨 ─────────────────────────────────────────────────────

export function WeeklyClimbChart({ data }: { data: WeeklyClimbPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={COLOR.grid} strokeDasharray="3 3" />
        <XAxis dataKey="week" stroke={COLOR.axis} fontSize={11} />
        <YAxis stroke={COLOR.axis} fontSize={11} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="attempts" name="시도" fill={COLOR.brand} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── 3. 주간 행보드 매달리기 초 ────────────────────────────────────────────

export function WeeklyHangChart({ data }: { data: WeeklyHangPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid stroke={COLOR.grid} strokeDasharray="3 3" />
        <XAxis dataKey="week" stroke={COLOR.axis} fontSize={11} />
        <YAxis stroke={COLOR.axis} fontSize={11} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="total_sec" name="총 초" fill={COLOR.success} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── 4. 월간 통증 캘린더 (단순 그리드) ────────────────────────────────────

const PAIN_COLOR = ["bg-pain-0", "bg-pain-1", "bg-pain-2", "bg-pain-3"];
const PAIN_LABEL = ["없음", "약함", "보통", "강함"];

export function PainCalendar({ data }: { data: PainDay[] }) {
  // 최근 30일 그리드 표시. 데이터 없는 날은 미발생(empty).
  const today = new Date();
  const days: { date: string; pain: number | null }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const found = data.find((x) => x.date === key);
    days.push({ date: key, pain: found?.pain ?? null });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-10 gap-1.5">
        {days.map((d) => (
          <div
            key={d.date}
            title={`${d.date} · ${d.pain == null ? "운동 없음" : PAIN_LABEL[d.pain]}`}
            className={cn(
              "aspect-square rounded-sm",
              d.pain == null ? "bg-elevated" : PAIN_COLOR[d.pain],
            )}
          />
        ))}
      </div>
      <div className="flex items-center justify-end gap-2 text-micro text-fg-muted">
        <span>적음</span>
        {[0, 1, 2, 3].map((p) => (
          <span
            key={p}
            className={cn("h-3 w-3 rounded-sm", PAIN_COLOR[p])}
            aria-label={PAIN_LABEL[p]}
          />
        ))}
        <span>강함</span>
      </div>
    </div>
  );
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

// ── 5. 프로젝트 진척 ──────────────────────────────────────────────────────

export function ProjectList({ data }: { data: ProjectProgress[] }) {
  if (data.length === 0) {
    return (
      <p className="text-caption text-fg-muted">
        프로젝트로 추적 중인 루트가 없습니다. 등반 입력 시 &quot;프로젝트 이름&quot;을 채워두면 누적됩니다.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {data.map((p) => (
        <li
          key={p.project_name}
          className="flex items-center justify-between rounded-md bg-elevated px-3 py-2"
        >
          <div className="flex flex-1 flex-col">
            <span className="text-bodyLg font-semibold text-fg-primary">
              {p.project_name}
            </span>
            <span className="text-caption text-fg-muted tabular-nums">
              {p.grade} · 시도 {p.attempts}
              {p.sends > 0 && ` · 완등 ${p.sends}`}
            </span>
          </div>
          <span className="text-micro text-fg-muted">
            {p.last_attempt.slice(0, 10)}
          </span>
        </li>
      ))}
    </ul>
  );
}
