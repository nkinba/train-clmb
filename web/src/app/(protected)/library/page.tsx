"use client";

import { useMemo } from "react";
import { MediaGrid } from "@/components/media-grid";
import { useAllMedia, type MediaRecord } from "@/lib/media";

/**
 * 라이브러리 — 사용자가 첨부한 모든 미디어 일람.
 * 일자별 그룹 (YYYY-MM-DD). 검색은 S18-D follow-up.
 */
export default function LibraryPage() {
  const { data, isPending, isError } = useAllMedia();

  const groups = useMemo(() => groupByDate(data ?? []), [data]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6 pb-[calc(var(--spacing-tab-bar)+2rem)]">
      <header>
        <h1 className="text-h1 font-bold text-fg-primary">미디어</h1>
        <p className="text-caption text-fg-muted">
          세션에 첨부한 사진·영상 모음. 탭하여 재생.
        </p>
      </header>

      {isPending ? (
        <p className="text-caption text-fg-muted">불러오는 중…</p>
      ) : isError ? (
        <p className="rounded-md bg-elevated px-3 py-2 text-caption text-status-danger">
          미디어를 불러오지 못했습니다.
        </p>
      ) : groups.length === 0 ? (
        <p className="rounded-lg bg-surface px-3 py-4 text-caption text-fg-muted">
          첨부된 미디어가 없습니다. 세션 진행 중에 첨부할 수 있습니다.
        </p>
      ) : (
        groups.map(([day, items]) => (
          <section
            key={day}
            aria-label={`${day} 미디어`}
            className="flex flex-col gap-2"
          >
            <h2 className="text-caption text-fg-secondary">
              {formatDay(day)} · {items.length}건
            </h2>
            <MediaGrid items={items} />
          </section>
        ))
      )}
    </main>
  );
}

function groupByDate(items: MediaRecord[]): [string, MediaRecord[]][] {
  const map = new Map<string, MediaRecord[]>();
  for (const m of items) {
    const day = m.created.slice(0, 10);
    const list = map.get(day) ?? [];
    list.push(m);
    map.set(day, list);
  }
  // 키 desc 정렬 — created 자체가 desc지만 명시.
  return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
}

function formatDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}
