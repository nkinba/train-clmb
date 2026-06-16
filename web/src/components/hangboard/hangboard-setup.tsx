"use client";

import { NumberStepper } from "@/components/number-stepper";
import { cn } from "@/lib/utils";
import type { GripType } from "@/lib/hangboard";
import type { TimerConfig } from "@/lib/hangboard-timer";

export type HangboardSetupValue = {
  gripType: GripType;
  holdSizeMm: number;
  weightKg: number;
  config: TimerConfig;
};

export function HangboardSetup({
  value,
  onChange,
  onStart,
  startLabel,
}: {
  value: HangboardSetupValue;
  onChange: (next: HangboardSetupValue) => void;
  onStart: () => void;
  startLabel: string;
}) {
  const setConfig = (patch: Partial<TimerConfig>) =>
    onChange({ ...value, config: { ...value.config, ...patch } });

  return (
    <div className="flex flex-col gap-6">
      <section
        role="radiogroup"
        aria-label="그립 형태"
        className="flex flex-col gap-2"
      >
        <span className="text-caption text-fg-secondary">그립 형태</span>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { id: "half_crimp", label: "하프 크림프" },
              { id: "open_hand", label: "오픈 핸드" },
            ] as { id: GripType; label: string }[]
          ).map(({ id, label }) => {
            const selected = value.gripType === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange({ ...value, gripType: id })}
                className={cn(
                  "h-tap-default rounded-md border-2 text-bodyLg font-semibold",
                  selected
                    ? "border-brand bg-brand text-on-brand"
                    : "border-transparent bg-elevated text-fg-primary",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </section>

      <NumberStepper
        label="홀드 깊이"
        value={value.holdSizeMm}
        onChange={(n) => onChange({ ...value, holdSizeMm: n })}
        min={6}
        max={50}
        unit="mm"
      />

      <NumberStepper
        label="추가 무게"
        value={value.weightKg}
        onChange={(n) => onChange({ ...value, weightKg: n })}
        min={-50}
        max={60}
        unit="kg"
      />

      <NumberStepper
        label="목표 매달리기"
        value={value.config.hangSeconds}
        onChange={(n) => setConfig({ hangSeconds: n })}
        min={3}
        max={60}
        unit="초"
      />

      <NumberStepper
        label="휴식 시간"
        value={value.config.restSeconds}
        onChange={(n) => setConfig({ restSeconds: n })}
        min={30}
        max={600}
        step={30}
        unit="초"
      />

      <NumberStepper
        label="세트 수"
        value={value.config.totalSets}
        onChange={(n) => setConfig({ totalSets: n })}
        min={1}
        max={15}
        unit="세트"
      />

      <button
        type="button"
        onClick={onStart}
        className="h-tap-hero w-full rounded-lg bg-brand text-on-brand text-h2 font-semibold transition-colors hover:bg-brand-hover active:bg-brand-active"
      >
        {startLabel}
      </button>
    </div>
  );
}
