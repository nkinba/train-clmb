"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Dumbbell, Hand, Mountain, Timer, X, type LucideIcon } from "lucide-react";

type ModuleChoice = {
  href: string;
  Icon: LucideIcon;
  title: string;
  hint: string;
};

const MODULES: ModuleChoice[] = [
  {
    href: "/sessions/active/hangboard/",
    Icon: Hand,
    title: "행보드",
    hint: "매달리기 타이머",
  },
  {
    href: "/sessions/active/climbing/",
    Icon: Mountain,
    title: "등반 (Lead / Bouldering)",
    hint: "그레이드 · 시도 · 완등",
  },
  {
    href: "/sessions/active/strength/",
    Icon: Dumbbell,
    title: "보조 근력",
    hint: "웨이트 · 중량 · 세트",
  },
  {
    href: "/sessions/active/strength/",
    Icon: Timer,
    title: "캠퍼스",
    hint: "보조 근력 페이지에서 함께 입력",
  },
];

/**
 * "+ 운동 추가" 시트 — 4개 모듈 중 하나 선택 후 해당 라우트로 이동.
 * backdrop + 슬라이드업 시트 — Escape · 바깥 클릭으로 닫힘.
 */
export function AddModuleSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // Escape · 바깥 스크롤 잠금
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  // 시트가 열릴 때 첫 번째 모듈에 포커스
  useEffect(() => {
    if (!open) return;
    const first = sheetRef.current?.querySelector<HTMLAnchorElement>("a[href]");
    first?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="운동 추가"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={sheetRef}
        className="w-full max-w-md rounded-t-2xl bg-surface p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-h3 font-semibold text-fg-primary">운동 추가</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-tap w-tap items-center justify-center rounded-md text-fg-muted hover:bg-elevated"
          >
            <X size={20} aria-hidden />
          </button>
        </div>

        <ul className="flex flex-col gap-2">
          {MODULES.map((m) => (
            <li key={m.title}>
              <Link
                href={m.href}
                onClick={onClose}
                className="flex items-center gap-3 rounded-lg bg-elevated p-3 hover:bg-surface focus:outline-none focus:ring-2 focus:ring-brand"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-surface text-fg-primary">
                  <m.Icon size={22} aria-hidden />
                </span>
                <div className="flex-1">
                  <p className="text-bodyLg font-semibold text-fg-primary">
                    {m.title}
                  </p>
                  <p className="text-caption text-fg-muted">{m.hint}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
