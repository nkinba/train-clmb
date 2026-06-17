"use client";

import { useMemo } from "react";
import {
  GripMaxKgChart,
  PainCalendar,
  ProjectList,
  WeeklyClimbChart,
  WeeklyHangChart,
} from "@/components/analysis/charts";
import {
  buildGripMaxKg,
  buildPainCalendar,
  buildProjects,
  buildWeeklyClimb,
  buildWeeklyHang,
  useAnalyticsBundle,
} from "@/lib/analytics";

export default function AnalysisPage() {
  const q = useAnalyticsBundle();
  const data = q.data;

  const charts = useMemo(() => {
    if (!data) return null;
    return {
      gripMaxKg: buildGripMaxKg(data.hangboard),
      weeklyClimb: buildWeeklyClimb(data.climbing),
      weeklyHang: buildWeeklyHang(data.hangboard),
      pain: buildPainCalendar(data.sessions),
      projects: buildProjects(data.climbing),
    };
  }, [data]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6 pb-[calc(var(--spacing-tab-bar)+2rem)]">
      <header>
        <h1 className="text-h1 font-bold text-fg-primary">분석</h1>
        <p className="text-caption text-fg-muted">
          PRD §5 성공 지표 5종 — 5.12 / V7 진척 추적
        </p>
      </header>

      {q.isPending && (
        <p
          role="status"
          aria-live="polite"
          className="text-caption text-fg-muted"
        >
          데이터를 집계 중…
        </p>
      )}
      {q.error && (
        <p
          role="alert"
          className="rounded-md bg-elevated px-3 py-2 text-caption text-status-danger"
        >
          {q.error instanceof Error ? q.error.message : "불러오기 실패"}
        </p>
      )}

      {charts && (
        <>
          <Card
            title="그립별 최대 +kg"
            subtitle="월간 추이 — 하프 크림프 / 오픈 핸드"
            empty={charts.gripMaxKg.length === 0}
          >
            <GripMaxKgChart data={charts.gripMaxKg} />
          </Card>

          <Card
            title="주간 등반 볼륨"
            subtitle="시도 횟수 (난이도 가중치 별도 추적)"
            empty={charts.weeklyClimb.length === 0}
          >
            <WeeklyClimbChart data={charts.weeklyClimb} />
          </Card>

          <Card
            title="주간 행보드 매달리기"
            subtitle="총 초 (sets × 매달리기 초)"
            empty={charts.weeklyHang.length === 0}
          >
            <WeeklyHangChart data={charts.weeklyHang} />
          </Card>

          <Card
            title="통증 캘린더"
            subtitle="최근 30일 · 일별 최대 통증"
            empty={charts.pain.length === 0}
          >
            <PainCalendar data={charts.pain} />
          </Card>

          <Card
            title="프로젝트 진척"
            subtitle="등반 입력에 프로젝트 이름이 있는 루트"
            empty={charts.projects.length === 0}
            emptyMessage={null /* 컴포넌트가 자체 메시지 표시 */}
          >
            <ProjectList data={charts.projects} />
          </Card>
        </>
      )}
    </main>
  );
}

function Card({
  title,
  subtitle,
  children,
  empty,
  emptyMessage = "아직 데이터가 부족합니다.",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  empty?: boolean;
  emptyMessage?: string | null;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-lg bg-surface p-4">
      <header>
        <h2 className="text-h3 font-semibold text-fg-primary">{title}</h2>
        {subtitle && (
          <p className="text-caption text-fg-muted">{subtitle}</p>
        )}
      </header>
      {empty && emptyMessage ? (
        <p className="text-caption text-fg-muted">{emptyMessage}</p>
      ) : (
        children
      )}
    </section>
  );
}
