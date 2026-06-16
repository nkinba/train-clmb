"use client";

import { useState } from "react";
import { RpeSelector } from "@/components/rpe-selector";
import { cn } from "@/lib/utils";
import {
  completedCount,
  successCount,
  type SetResult,
  type TimerState,
} from "@/lib/hangboard-timer";

type Rpe = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export function HangboardSummary({
  state,
  isSaving,
  saveError,
  onChangeResult,
  onSave,
  onReset,
}: {
  state: TimerState;
  isSaving: boolean;
  saveError: string | null;
  onChangeResult: (index: number, result: SetResult) => void;
  onSave: (rpe: Rpe | null) => void;
  onReset: () => void;
}) {
  const [rpe, setRpe] = useState<Rpe | null>(null);
  const ok = successCount(state);
  const done = completedCount(state);

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg bg-surface p-4">
        <h2 className="text-h3 font-semibold text-fg-primary">결과</h2>
        <p className="mt-1 text-bodyLg text-fg-primary tabular-nums">
          성공 {ok} / 완료 {done} · 총 {state.config.totalSets} 세트
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <span className="text-caption text-fg-secondary">세트별 결과 수정</span>
        <div className="grid grid-cols-5 gap-2">
          {state.setResults.map((r, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() =>
                onChangeResult(
                  idx,
                  r === "success" ? "fail" : r === "fail" ? null : "success",
                )
              }
              className={cn(
                "flex h-tap flex-col items-center justify-center rounded-md text-caption font-semibold",
                r === "success" && "bg-success text-on-success",
                r === "fail" && "bg-danger text-on-danger",
                r === null && "bg-elevated text-fg-primary",
              )}
              aria-label={`세트 ${idx + 1} ${
                r === "success" ? "성공" : r === "fail" ? "실패" : "미기록"
              }`}
            >
              <span className="text-bodyLg leading-none">{idx + 1}</span>
              <span className="text-micro leading-none">
                {r === "success" ? "성공" : r === "fail" ? "실패" : "—"}
              </span>
            </button>
          ))}
        </div>
        <p className="text-micro text-fg-muted">탭으로 순환: 성공 → 실패 → 미기록</p>
      </section>

      <RpeSelector value={rpe} onChange={setRpe} />

      {saveError && (
        <p
          role="alert"
          className="rounded-md bg-elevated px-3 py-2 text-caption text-status-danger"
        >
          {saveError}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onReset}
          disabled={isSaving}
          className="h-tap-default flex-1 rounded-lg bg-elevated text-fg-primary text-bodyLg font-semibold disabled:opacity-50"
        >
          다시 설정
        </button>
        <button
          type="button"
          onClick={() => onSave(rpe)}
          disabled={isSaving}
          className="h-tap-default flex-1 rounded-lg bg-brand text-on-brand text-bodyLg font-semibold transition-colors hover:bg-brand-hover active:bg-brand-active disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? "저장 중…" : "기록 저장"}
        </button>
      </div>
    </div>
  );
}
