"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

type PainLevel = 0 | 1 | 2 | 3;

const LEVELS: { value: PainLevel; label: string; bg: string }[] = [
  { value: 0, label: "없음", bg: "bg-pain-0" },
  { value: 1, label: "약함", bg: "bg-pain-1" },
  { value: 2, label: "보통", bg: "bg-pain-2" },
  { value: 3, label: "강함", bg: "bg-pain-3" },
];

/**
 * PRD 통증 0–3 스케일. 세션 시작/종료 + 부위(어깨/손가락)별로 사용.
 * 색만 의존하지 않도록 숫자 + 라벨 동시 표시 (UI.md §1 분필 손가락 대비).
 * 키보드: Arrow Left/Right/Up/Down 으로 이동, Home/End. roving tabindex.
 */
export function PainSelector({
  value,
  onChange,
  partLabel,
  className,
}: {
  value: PainLevel;
  onChange: (next: PainLevel) => void;
  partLabel: string;
  className?: string;
}) {
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const moveTo = (idx: number) => {
    const next = LEVELS[idx];
    if (!next) return;
    onChange(next.value);
    buttonsRef.current[idx]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const currentIdx = LEVELS.findIndex((l) => l.value === value);
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        moveTo(Math.max(0, currentIdx - 1));
        break;
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        moveTo(Math.min(LEVELS.length - 1, currentIdx + 1));
        break;
      case "Home":
        e.preventDefault();
        moveTo(0);
        break;
      case "End":
        e.preventDefault();
        moveTo(LEVELS.length - 1);
        break;
    }
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <span className="text-caption text-fg-secondary">{partLabel} 통증</span>
      <div
        role="radiogroup"
        aria-label={`${partLabel} 통증 0–3`}
        className="grid grid-cols-4 gap-2"
        onKeyDown={onKeyDown}
      >
        {LEVELS.map(({ value: lv, label, bg }, idx) => {
          const selected = lv === value;
          return (
            <button
              key={lv}
              ref={(el) => {
                buttonsRef.current[idx] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(lv)}
              className={cn(
                "flex h-tap flex-col items-center justify-center gap-0.5 rounded-md transition-all",
                "border-2",
                selected ? "border-fg-primary" : "border-transparent",
                bg,
                lv === 0 ? "text-fg-primary" : "text-fg-inverse",
              )}
            >
              <span className="text-bodyLg font-semibold leading-none">{lv}</span>
              <span className="text-micro leading-none">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
