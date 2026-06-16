"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { PainSelector } from "@/components/pain-selector";
import { useCreateSession, type PainLevel } from "@/lib/sessions";

function todayISODate() {
  // input[type=date]는 YYYY-MM-DD만 받음 (로컬 타임존).
  // PocketBase date 필드는 ISO datetime을 받지만 "YYYY-MM-DD"도 자동으로 자정으로 해석.
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function NewSessionPage() {
  const router = useRouter();
  const createSession = useCreateSession();

  const [date, setDate] = useState(todayISODate);
  const [location, setLocation] = useState("");
  const [target, setTarget] = useState("");
  const [shoulderPain, setShoulderPain] = useState<PainLevel>(0);
  const [fingerPain, setFingerPain] = useState<PainLevel>(0);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createSession.mutate(
      {
        date,
        location: location.trim(),
        target: target.trim(),
        shoulder_pain_start: shoulderPain,
        finger_pain_start: fingerPain,
      },
      {
        onSuccess: () => {
          router.replace("/sessions/active/");
        },
      },
    );
  };

  const errMessage =
    createSession.error instanceof Error
      ? createSession.error.message
      : createSession.error
        ? "세션 생성 실패"
        : null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6 pb-[calc(var(--spacing-tab-bar)+2rem)]">
      <header className="flex items-center gap-2">
        <Link
          href="/"
          aria-label="뒤로"
          className="flex h-tap w-tap items-center justify-center rounded-md text-fg-primary hover:bg-elevated"
        >
          <ChevronLeft size={24} aria-hidden />
        </Link>
        <div>
          <h1 className="text-h1 font-bold text-fg-primary">새 세션</h1>
          <p className="text-caption text-fg-muted">시작 통증 기록 후 모듈 입력</p>
        </div>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-5" aria-label="새 세션 폼">
        <label className="block">
          <span className="text-caption text-fg-secondary">날짜</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="mt-1 h-tap-default w-full rounded-md bg-surface px-3 text-fg-primary outline-none"
          />
        </label>

        <label className="block">
          <span className="text-caption text-fg-secondary">장소</span>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="예) 더 클라임 강남"
            maxLength={120}
            autoComplete="off"
            inputMode="text"
            className="mt-1 h-tap-default w-full rounded-md bg-surface px-3 text-fg-primary outline-none placeholder:text-fg-muted"
          />
        </label>

        <label className="block">
          <span className="text-caption text-fg-secondary">메인 타깃</span>
          <input
            type="text"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="예) V6 프로젝트 + 하프 크림프"
            maxLength={200}
            autoComplete="off"
            inputMode="text"
            className="mt-1 h-tap-default w-full rounded-md bg-surface px-3 text-fg-primary outline-none placeholder:text-fg-muted"
          />
        </label>

        <PainSelector
          partLabel="어깨"
          value={shoulderPain}
          onChange={setShoulderPain}
        />
        <PainSelector
          partLabel="손가락"
          value={fingerPain}
          onChange={setFingerPain}
        />

        {errMessage && (
          <p
            role="alert"
            className="rounded-md bg-elevated px-3 py-2 text-caption text-status-danger"
          >
            {errMessage}
          </p>
        )}

        <button
          type="submit"
          disabled={createSession.isPending}
          className="h-tap-default w-full rounded-lg bg-brand text-on-brand text-bodyLg font-semibold transition-colors hover:bg-brand-hover active:bg-brand-active disabled:cursor-not-allowed disabled:opacity-50"
        >
          {createSession.isPending ? "생성 중…" : "+ 세션 시작"}
        </button>
      </form>
    </main>
  );
}
