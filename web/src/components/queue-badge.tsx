"use client";

import { CloudOff, RefreshCcw, UploadCloud } from "lucide-react";
import { useQueueStatus } from "@/hooks/use-queue-status";
import { cn } from "@/lib/utils";

/**
 * 오프라인 큐 상태 배지 (S12).
 *
 * - 길이 0 + online이면 hidden (UI 노이즈 회피).
 * - 길이 > 0 또는 offline이면 상단 fixed banner.
 * - 클릭 → 즉시 flush 시도.
 *
 * RootLayout이 아닌 (protected) layout에 두면 로그인 화면에 안 보임.
 * 다만 단일 사용자 + 큐는 로그인 전엔 안 쌓이므로 RootLayout에 둬도 무방.
 */
export function QueueBadge() {
  const { length, deadLetters, online, flushing, flushNow } = useQueueStatus();

  if (length === 0 && deadLetters === 0 && online) return null;

  const Icon = flushing ? RefreshCcw : online ? UploadCloud : CloudOff;
  // on-* 토큰은 brand/success/danger만 정의되어 있어 info/warning은 inverse로 대비.
  const tone =
    deadLetters > 0
      ? "bg-status-danger text-on-danger"
      : !online
        ? "bg-status-warning text-fg-inverse"
        : flushing
          ? "bg-elevated text-fg-primary"
          : "bg-status-info text-fg-inverse";

  let label: string;
  if (deadLetters > 0) {
    label = `동기화 실패 ${deadLetters} · 탭하여 재시도`;
  } else if (!online && length > 0) {
    label = `오프라인 · 저장 대기 ${length}`;
  } else if (!online) {
    label = "오프라인";
  } else if (flushing) {
    label = `동기화 중 (${length})`;
  } else {
    label = `대기 ${length}`;
  }

  return (
    <button
      type="button"
      onClick={flushNow}
      aria-label={`${label}. 탭하여 동기화 재시도`}
      className={cn(
        "fixed inset-x-0 top-0 z-40 flex h-9 items-center justify-center gap-2 px-4 text-caption font-semibold",
        "pt-[env(safe-area-inset-top)]",
        tone,
      )}
    >
      <Icon size={14} className={cn(flushing && "animate-spin")} aria-hidden />
      <span>{label}</span>
    </button>
  );
}
