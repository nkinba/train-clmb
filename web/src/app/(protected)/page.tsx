"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { getActiveSessionId, setActiveSessionId, useSession } from "@/lib/sessions";

export default function Home() {
  // localStorage는 client only — checked 플래그로 SSR/static export 시 깜빡임 방지.
  const [activeId, setActiveId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setActiveId(getActiveSessionId());
    setChecked(true);
  }, []);

  const sessionQuery = useSession(activeId);

  // PB에서 404면 stale localStorage — 정리해서 + 세션 시작 CTA가 다시 보이게.
  useEffect(() => {
    const err = sessionQuery.error as { status?: number } | null;
    if (err?.status === 404) {
      setActiveSessionId(null);
      setActiveId(null);
    }
  }, [sessionQuery.error]);

  return (
    <>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6 pb-[calc(var(--spacing-tab-bar)+2rem)]">
        <header>
          <h1 className="text-h1 font-bold text-fg-primary">오늘</h1>
          <p className="text-caption text-fg-muted">
            Climb-Forge · 단일 사용자 트레이닝 트래커
          </p>
        </header>

        {!checked && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-center py-12"
          >
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-subtle border-t-fg-primary" />
          </div>
        )}

        {checked && !activeId && (
          <Link
            href="/sessions/new/"
            className="flex items-center justify-center gap-2 h-tap-hero rounded-lg bg-brand text-on-brand text-h2 font-semibold transition-colors hover:bg-brand-hover active:bg-brand-active"
          >
            <Plus size={28} aria-hidden />
            <span>세션 시작</span>
          </Link>
        )}

        {checked && activeId && (
          <section className="flex flex-col gap-3">
            <p className="text-caption text-fg-secondary">진행 중인 세션</p>
            <Link
              href="/sessions/active/"
              className="rounded-lg bg-surface p-4 hover:bg-elevated"
            >
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-bodyLg font-semibold text-fg-primary">
                    {sessionQuery.data?.target?.trim()
                      ? sessionQuery.data.target
                      : "세션 진행 중"}
                  </p>
                  <p className="text-caption text-fg-muted">
                    {sessionQuery.data?.location?.trim() || "장소 미입력"}
                  </p>
                </div>
                <ChevronRight size={20} aria-hidden className="text-fg-muted" />
              </div>
            </Link>
          </section>
        )}
      </main>
      <BottomNav activeId="today" />
    </>
  );
}
