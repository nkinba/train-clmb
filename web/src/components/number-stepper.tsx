"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  label?: string;
  /** 한 손 정밀 입력용. 길게 누름 가속은 v1.1 (S16) 이후. */
  className?: string;
};

export function NumberStepper({
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  unit,
  label,
  className,
}: Props) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const decrement = () => onChange(clamp(value - step));
  const increment = () => onChange(clamp(value + step));

  const atMin = value <= min;
  const atMax = value >= max;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label && (
        <span className="text-caption text-fg-secondary">{label}</span>
      )}
      <div
        role="group"
        aria-label={label}
        className="flex items-center gap-2 rounded-md bg-surface p-1"
      >
        <button
          type="button"
          onClick={decrement}
          disabled={atMin}
          aria-label={`${label ?? "값"} 감소`}
          className={cn(
            "flex h-tap w-tap items-center justify-center rounded-sm bg-elevated text-fg-primary transition-colors",
            "hover:bg-subtle active:bg-subtle",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-elevated",
          )}
        >
          <Minus size={20} aria-hidden />
        </button>
        <div className="flex flex-1 items-baseline justify-center gap-1 px-2">
          <span className="text-display tabular-nums text-fg-primary">{value}</span>
          {unit && <span className="text-caption text-fg-muted">{unit}</span>}
        </div>
        <button
          type="button"
          onClick={increment}
          disabled={atMax}
          aria-label={`${label ?? "값"} 증가`}
          className={cn(
            "flex h-tap w-tap items-center justify-center rounded-sm bg-elevated text-fg-primary transition-colors",
            "hover:bg-subtle active:bg-subtle",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-elevated",
          )}
        >
          <Plus size={20} aria-hidden />
        </button>
      </div>
    </div>
  );
}
