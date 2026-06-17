"use client";

import { useState } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { NumberStepper } from "@/components/number-stepper";
import { PainSelector } from "@/components/pain-selector";
import { RpeSelector } from "@/components/rpe-selector";
import { TimerDisplay } from "@/components/timer-display";

type Rpe = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
type PainLevel = 0 | 1 | 2 | 3;

export default function DevComponentsPage() {
  const [holdMm, setHoldMm] = useState(18);
  const [addedKg, setAddedKg] = useState(5);
  const [shoulderPain, setShoulderPain] = useState<PainLevel>(0);
  const [fingerPain, setFingerPain] = useState<PainLevel>(1);
  const [rpe, setRpe] = useState<Rpe | null>(7);
  const [phase, setPhase] = useState<"hang" | "rest" | "countdown">("hang");

  return (
    <>
      <main className="mx-auto flex w-full max-w-md flex-col gap-12 px-4 py-6 pb-[calc(var(--spacing-tab-bar)+2rem)]">
        <header>
          <h1 className="text-h1 font-bold text-fg-primary">컴포넌트 카탈로그</h1>
          <p className="mt-1 text-caption text-fg-muted">
            S05 디자인 시스템 시연. 실제 화면은 S08–S11에서 조립.
          </p>
        </header>

        <Section title="색 토큰 — Surface / Foreground">
          <div className="grid grid-cols-2 gap-2">
            <Swatch label="canvas" className="bg-canvas border border-border" />
            <Swatch label="surface" className="bg-surface" />
            <Swatch label="elevated" className="bg-elevated" />
            <Swatch label="subtle" className="bg-subtle" />
          </div>
          <div className="mt-3 space-y-1">
            <p className="text-bodyLg text-fg-primary">fg-primary — 본문</p>
            <p className="text-body text-fg-secondary">fg-secondary — 보조</p>
            <p className="text-caption text-fg-muted">fg-muted — 메타</p>
            <p className="text-caption text-fg-disabled">fg-disabled — 비활성</p>
          </div>
        </Section>

        <Section title="색 토큰 — Brand / Timer / Status">
          <div className="grid grid-cols-3 gap-2">
            <Swatch label="brand" className="bg-brand" />
            <Swatch label="brand-hover" className="bg-brand-hover" />
            <Swatch label="brand-active" className="bg-brand-active" />
            <Swatch label="timer-hang" className="bg-timer-hang" />
            <Swatch label="timer-rest" className="bg-timer-rest" />
            <Swatch label="timer-countdown" className="bg-timer-countdown" />
            <Swatch label="success" className="bg-success" />
            <Swatch label="danger" className="bg-danger" />
            <Swatch label="warning" className="bg-warning" />
          </div>
        </Section>

        <Section title="색 토큰 — Pain / RPE 스케일">
          <p className="mb-2 text-caption text-fg-muted">통증 0–3</p>
          <div className="grid grid-cols-4 gap-2">
            <Swatch label="pain-0" className="bg-pain-0" />
            <Swatch label="pain-1" className="bg-pain-1" />
            <Swatch label="pain-2" className="bg-pain-2" />
            <Swatch label="pain-3" className="bg-pain-3" />
          </div>
          <p className="mt-3 mb-2 text-caption text-fg-muted">RPE 4-band</p>
          <div className="grid grid-cols-4 gap-2">
            <Swatch label="rpe-easy" className="bg-rpe-easy" />
            <Swatch label="rpe-moderate" className="bg-rpe-moderate" />
            <Swatch label="rpe-hard" className="bg-rpe-hard" />
            <Swatch label="rpe-max" className="bg-rpe-max" />
          </div>
        </Section>

        <Section title="타입 스케일">
          <p className="text-display text-fg-primary leading-none">3rem display</p>
          <p className="text-h1 text-fg-primary">1.875rem h1</p>
          <p className="text-h2 text-fg-primary">1.5rem h2</p>
          <p className="text-h3 text-fg-primary">1.25rem h3</p>
          <p className="text-bodyLg text-fg-primary">1.125rem bodyLg</p>
          <p className="text-body text-fg-primary">1rem body</p>
          <p className="text-caption text-fg-secondary">0.875rem caption</p>
          <p className="text-micro text-fg-muted">0.75rem micro</p>
        </Section>

        <Section title="NumberStepper">
          <NumberStepper
            value={holdMm}
            onChange={setHoldMm}
            min={6}
            max={50}
            label="홀드 깊이"
            unit="mm"
          />
          <NumberStepper
            value={addedKg}
            onChange={setAddedKg}
            min={-20}
            max={40}
            step={1}
            label="추가 무게"
            unit="kg"
            className="mt-4"
          />
        </Section>

        <Section title="PainSelector">
          <PainSelector
            value={shoulderPain}
            onChange={setShoulderPain}
            partLabel="어깨"
          />
          <div className="mt-4">
            <PainSelector
              value={fingerPain}
              onChange={setFingerPain}
              partLabel="손가락"
            />
          </div>
        </Section>

        <Section title="RpeSelector">
          <RpeSelector value={rpe} onChange={setRpe} />
        </Section>

        <Section title="TimerDisplay (phase 토글)">
          <div className="rounded-lg bg-surface p-6">
            <TimerDisplay remainingSeconds={8} phase={phase} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {(["hang", "rest", "countdown"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPhase(p)}
                className={
                  "h-tap rounded-md text-caption " +
                  (phase === p
                    ? "bg-brand text-on-brand"
                    : "bg-elevated text-fg-primary")
                }
              >
                {p}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Binary state choice 버튼 (세트 결과 패턴)">
          <div className="flex flex-col gap-3">
            <button
              type="button"
              className="h-tap-hero rounded-lg bg-success text-on-success text-h2 font-semibold"
            >
              ✓ 성공
            </button>
            <button
              type="button"
              className="h-tap-hero rounded-lg bg-danger text-on-danger text-h2 font-semibold"
            >
              ✗ 실패
            </button>
          </div>
        </Section>

        <Section title="Primary CTA (브랜드)">
          <button
            type="button"
            className="h-tap-default w-full rounded-lg bg-brand text-on-brand text-bodyLg font-semibold hover:bg-brand-hover active:bg-brand-active transition-colors"
          >
            + 세션 시작
          </button>
        </Section>

        <Section title="Focus ring (Tab으로 이동해 확인)">
          <button
            type="button"
            className="h-tap rounded-md bg-elevated px-4 text-fg-primary"
          >
            첫 번째 버튼
          </button>
          <button
            type="button"
            className="ml-2 h-tap rounded-md bg-elevated px-4 text-fg-primary"
          >
            두 번째 버튼
          </button>
        </Section>
      </main>
      <BottomNav />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-h3 font-semibold text-fg-primary">{title}</h2>
      <div>{children}</div>
    </section>
  );
}

function Swatch({ label, className }: { label: string; className: string }) {
  return (
    <div className={`flex h-16 items-end justify-start rounded-md p-2 ${className}`}>
      <span className="text-micro font-medium text-fg-inverse mix-blend-difference">
        {label}
      </span>
    </div>
  );
}
