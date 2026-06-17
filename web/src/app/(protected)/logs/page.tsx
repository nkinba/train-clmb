"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Trash2 } from "lucide-react";
import {
  getActiveSessionId,
  useDeleteSession,
  useSessionList,
  type SessionListFilter,
  type SessionRecord,
} from "@/lib/sessions";

const PER_PAGE = 20;

export default function LogsPage() {
  // 필터: 입력 상태와 query 상태 분리 — "검색" 버튼으로 query 갱신 (디바운스 회피, UX 단순).
  const [draft, setDraft] = useState<{
    dateFrom: string;
    dateTo: string;
    location: string;
    target: string;
  }>({ dateFrom: "", dateTo: "", location: "", target: "" });

  const [filter, setFilter] = useState<SessionListFilter>({
    page: 1,
    perPage: PER_PAGE,
  });

  // 페이지별 결과를 누적 — "더 보기"가 직관에 맞도록.
  const [accumulated, setAccumulated] = useState<SessionRecord[]>([]);

  const list = useSessionList(filter);
  const del = useDeleteSession();

  const [activeId, setActiveId] = useState<string | null>(null);
  useEffect(() => {
    setActiveId(getActiveSessionId());
  }, []);

  const applyFilter = () => {
    // setAccumulated을 여기서 비우면 빈 draft로 검색 시 queryKey가 동일해
    // list.data가 캐시 hit으로 재발화 안 되고 accumulated만 빈 상태로 멈춤.
    // → useEffect가 list.data를 보고 page=1일 때 자동 덮어쓰기에 위임.
    setFilter({
      page: 1,
      perPage: PER_PAGE,
      dateFrom: draft.dateFrom || undefined,
      dateTo: draft.dateTo || undefined,
      location: draft.location || undefined,
      target: draft.target || undefined,
    });
  };

  const resetFilter = () => {
    setDraft({ dateFrom: "", dateTo: "", location: "", target: "" });
    setFilter({ page: 1, perPage: PER_PAGE });
  };

  const loadMore = () => {
    setFilter((f) => ({ ...f, page: f.page + 1 }));
  };

  // 새 페이지 도착 시 accumulated에 합치기 (id 기준 중복 제거).
  // page=1일 때는 항상 fresh로 덮어쓰기 — 빈 검색이든 캐시 hit이든 list.data가 표시.
  useEffect(() => {
    if (!list.data) return;
    if (filter.page === 1) {
      setAccumulated(list.data.items);
      return;
    }
    setAccumulated((prev) => {
      const seen = new Set(prev.map((r) => r.id));
      return [...prev, ...list.data.items.filter((r) => !seen.has(r.id))];
    });
  }, [list.data, filter.page]);

  const onDelete = (id: string) => {
    if (!window.confirm("이 세션과 모든 하위 기록을 삭제할까요?")) return;
    del.mutate(id, {
      onSuccess: () => {
        // accumulated에서도 즉시 제거 (invalidate refetch 전).
        setAccumulated((prev) => prev.filter((r) => r.id !== id));
      },
    });
  };

  const items = accumulated;
  const hasMore =
    list.data && filter.page * filter.perPage < (list.data.totalItems ?? 0);

  const isFilterActive = useMemo(
    () =>
      Boolean(
        filter.dateFrom || filter.dateTo || filter.location || filter.target,
      ),
    [filter],
  );

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6 pb-[calc(var(--spacing-tab-bar)+2rem)]">
      <header>
        <h1 className="text-h1 font-bold text-fg-primary">기록</h1>
        <p className="text-caption text-fg-muted">
          종료된 세션 + 활성 세션 (날짜·장소·타깃 필터)
        </p>
      </header>

      {/* 필터 */}
      <section
        aria-label="필터"
        className="flex flex-col gap-3 rounded-lg bg-surface p-4"
      >
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-caption text-fg-secondary">시작일</span>
            <input
              type="date"
              value={draft.dateFrom}
              onChange={(e) =>
                setDraft((d) => ({ ...d, dateFrom: e.target.value }))
              }
              className="mt-1 h-tap w-full rounded-md bg-elevated px-3 text-body text-fg-primary outline-none"
            />
          </label>
          <label className="block">
            <span className="text-caption text-fg-secondary">종료일</span>
            <input
              type="date"
              value={draft.dateTo}
              onChange={(e) =>
                setDraft((d) => ({ ...d, dateTo: e.target.value }))
              }
              className="mt-1 h-tap w-full rounded-md bg-elevated px-3 text-body text-fg-primary outline-none"
            />
          </label>
        </div>
        <label className="block">
          <span className="text-caption text-fg-secondary">장소 (부분 일치)</span>
          <input
            type="text"
            value={draft.location}
            onChange={(e) =>
              setDraft((d) => ({ ...d, location: e.target.value }))
            }
            placeholder="예) 더 클라임"
            autoComplete="off"
            inputMode="text"
            className="mt-1 h-tap w-full rounded-md bg-elevated px-3 text-body text-fg-primary outline-none placeholder:text-fg-muted"
          />
        </label>
        <label className="block">
          <span className="text-caption text-fg-secondary">타깃 (부분 일치)</span>
          <input
            type="text"
            value={draft.target}
            onChange={(e) =>
              setDraft((d) => ({ ...d, target: e.target.value }))
            }
            placeholder="예) V6"
            autoComplete="off"
            inputMode="text"
            className="mt-1 h-tap w-full rounded-md bg-elevated px-3 text-body text-fg-primary outline-none placeholder:text-fg-muted"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={resetFilter}
            className="h-tap flex-1 rounded-md bg-elevated text-caption font-semibold text-fg-primary"
          >
            초기화
          </button>
          <button
            type="button"
            onClick={applyFilter}
            className="h-tap flex-1 rounded-md bg-brand text-caption font-semibold text-on-brand"
          >
            검색
          </button>
        </div>
      </section>

      {/* 결과 */}
      <section aria-label="세션 list" className="flex flex-col gap-2">
        {list.isPending && (
          <p className="text-caption text-fg-muted">불러오는 중…</p>
        )}
        {list.error && (
          <p
            role="alert"
            className="rounded-md bg-elevated px-3 py-2 text-caption text-status-danger"
          >
            {list.error instanceof Error ? list.error.message : "불러오기 실패"}
          </p>
        )}
        {!list.isPending && items.length === 0 && (
          <p className="rounded-md bg-surface px-4 py-6 text-center text-caption text-fg-muted">
            {isFilterActive
              ? "조건에 맞는 세션이 없습니다."
              : "아직 세션이 없습니다. 홈에서 새 세션을 시작하세요."}
          </p>
        )}
        {items.length > 0 && (
          <ul className="flex flex-col gap-2">
            {items.map((s) => {
              const isActive = s.id === activeId;
              return (
                <li
                  key={s.id}
                  className="flex items-stretch gap-2 rounded-lg bg-surface"
                >
                  <Link
                    href={`/logs/detail/?id=${s.id}`}
                    className="flex flex-1 items-center gap-3 px-3 py-3 hover:bg-elevated rounded-l-lg"
                  >
                    <div className="flex flex-1 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-bodyLg font-semibold text-fg-primary tabular-nums">
                          {formatDate(s.date)}
                        </span>
                        {isActive && (
                          <span className="rounded-full bg-status-info px-2 py-0.5 text-micro font-semibold text-fg-inverse">
                            진행 중
                          </span>
                        )}
                      </div>
                      <p className="text-caption text-fg-muted">
                        {s.location?.trim() || "장소 미입력"}
                        {s.target?.trim() ? ` · ${s.target}` : ""}
                      </p>
                      <p className="text-caption text-fg-muted tabular-nums">
                        {s.total_time_mins > 0
                          ? `${s.total_time_mins}분`
                          : "종료 전"}
                        {" · "}
                        통증 어깨 {s.shoulder_pain_start}→
                        {s.shoulder_pain_end} / 손가락 {s.finger_pain_start}→
                        {s.finger_pain_end}
                      </p>
                    </div>
                    <ChevronRight
                      size={20}
                      aria-hidden
                      className="text-fg-muted"
                    />
                  </Link>
                  <button
                    type="button"
                    onClick={() => onDelete(s.id)}
                    disabled={del.isPending}
                    aria-label={`${formatDate(s.date)} 세션 삭제`}
                    className="flex w-tap items-center justify-center rounded-r-lg text-fg-muted hover:bg-elevated hover:text-status-danger disabled:opacity-50"
                  >
                    <Trash2 size={18} aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {hasMore && (
          <button
            type="button"
            onClick={loadMore}
            disabled={list.isFetching}
            className="h-tap-default mt-2 rounded-md bg-elevated text-caption font-semibold text-fg-primary disabled:opacity-50"
          >
            {list.isFetching ? "불러오는 중…" : "더 보기"}
          </button>
        )}
      </section>
    </main>
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
