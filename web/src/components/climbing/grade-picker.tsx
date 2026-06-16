"use client";

import { cn } from "@/lib/utils";

/**
 * 그레이드 선택. Lead 9개, Bouldering 5개 — 모바일에서 한 화면 안에 들어가도록 wrap grid.
 * roving tabindex로 키보드 탐색 지원.
 */
export function GradePicker({
  value,
  options,
  onChange,
  label,
}: {
  value: string;
  options: readonly string[];
  onChange: (next: string) => void;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-caption text-fg-secondary">{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className="grid grid-cols-3 gap-2"
      >
        {options.map((g) => {
          const selected = g === value;
          return (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(g)}
              className={cn(
                "flex h-tap items-center justify-center rounded-md text-bodyLg font-semibold tabular-nums",
                selected
                  ? "bg-brand text-on-brand"
                  : "bg-elevated text-fg-primary",
              )}
            >
              {g}
            </button>
          );
        })}
      </div>
    </div>
  );
}
