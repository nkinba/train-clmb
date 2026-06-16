"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

type Rpe = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

const RPE_VALUES: Rpe[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** design-tokens §1.9 — 4-band coloring */
function bandColor(rpe: Rpe): string {
  if (rpe <= 3) return "bg-rpe-easy";
  if (rpe <= 6) return "bg-rpe-moderate";
  if (rpe <= 8) return "bg-rpe-hard";
  return "bg-rpe-max";
}

function bandLabel(rpe: Rpe): string {
  if (rpe <= 3) return "쉬움";
  if (rpe <= 6) return "보통";
  if (rpe <= 8) return "어려움";
  return "최대";
}

/**
 * RPE 1–10 입력. 5×2 그리드, 4-band 색상으로 시각적 그루핑.
 * 한 손 조작 + 빠른 탭 입력 위주 (UI.md §3.3 RPE 카드).
 * 키보드: Arrow Left/Right/Up/Down (1D 모델), Home/End. roving tabindex.
 */
export function RpeSelector({
  value,
  onChange,
  className,
}: {
  value: Rpe | null;
  onChange: (next: Rpe) => void;
  className?: string;
}) {
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const moveTo = (idx: number) => {
    const next = RPE_VALUES[idx];
    if (next == null) return;
    onChange(next);
    buttonsRef.current[idx]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const currentIdx = value == null ? -1 : RPE_VALUES.indexOf(value);
    const start = currentIdx === -1 ? 0 : currentIdx;
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        moveTo(Math.max(0, start - 1));
        break;
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        moveTo(Math.min(RPE_VALUES.length - 1, start + 1));
        break;
      case "Home":
        e.preventDefault();
        moveTo(0);
        break;
      case "End":
        e.preventDefault();
        moveTo(RPE_VALUES.length - 1);
        break;
    }
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between">
        <span className="text-caption text-fg-secondary">RPE (자각 강도)</span>
        {value != null && (
          <span className="text-caption text-fg-muted">{bandLabel(value)}</span>
        )}
      </div>
      <div
        role="radiogroup"
        aria-label="RPE 1–10"
        className="grid grid-cols-5 gap-2"
        onKeyDown={onKeyDown}
      >
        {RPE_VALUES.map((rpe, idx) => {
          const selected = rpe === value;
          // 미선택 상태에서 첫 항목만 tabbable (초기 진입점).
          const tabbable = value == null ? idx === 0 : selected;
          return (
            <button
              key={rpe}
              ref={(el) => {
                buttonsRef.current[idx] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`RPE ${rpe} ${bandLabel(rpe)}`}
              tabIndex={tabbable ? 0 : -1}
              onClick={() => onChange(rpe)}
              className={cn(
                "flex h-tap items-center justify-center rounded-md text-bodyLg font-semibold tabular-nums transition-all text-fg-inverse",
                bandColor(rpe),
                selected
                  ? "ring-2 ring-fg-primary ring-offset-2 ring-offset-canvas"
                  : "opacity-70 hover:opacity-100",
              )}
            >
              {rpe}
            </button>
          );
        })}
      </div>
    </div>
  );
}
