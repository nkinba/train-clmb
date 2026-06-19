"use client";

import { useEffect } from "react";
import { Trash2, X } from "lucide-react";
import {
  mediaFileUrl,
  useDeleteMedia,
  useFileToken,
  type MediaRecord,
} from "@/lib/media";

/**
 * 미디어 lightbox — backdrop + 전체화면에 가까운 영상/이미지 + 닫기/삭제.
 * Esc / backdrop 클릭 닫기. body scroll lock.
 * 삭제는 window.confirm — /logs/detail의 세션·하위 row 삭제와 동일 UX.
 */
export function MediaLightbox({
  media,
  onClose,
}: {
  media: MediaRecord | null;
  onClose: () => void;
}) {
  const deleteMedia = useDeleteMedia();
  const { data: token } = useFileToken();

  useEffect(() => {
    if (!media) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !deleteMedia.isPending) onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [media, onClose, deleteMedia.isPending]);

  if (!media) return null;

  const url = mediaFileUrl(media, token);

  const onDelete = async () => {
    if (!window.confirm("미디어를 삭제할까요?")) return;
    try {
      await deleteMedia.mutateAsync(media.id);
      onClose();
    } catch {
      // 본 화면 단순화 — 사용자가 다시 시도하거나 닫고 list refetch.
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="미디어 보기"
      className="fixed inset-0 z-50 flex flex-col bg-black/95"
      onClick={(e) => {
        if (e.target === e.currentTarget && !deleteMedia.isPending) onClose();
      }}
    >
      <header className="flex items-center justify-between gap-2 p-3 text-fg-primary">
        <button
          type="button"
          onClick={onClose}
          disabled={deleteMedia.isPending}
          aria-label="닫기"
          className="flex h-tap w-tap items-center justify-center rounded-md hover:bg-elevated disabled:opacity-50"
        >
          <X size={22} aria-hidden />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleteMedia.isPending}
          className="flex h-tap items-center gap-1 rounded-md px-3 text-status-danger hover:bg-elevated disabled:opacity-50"
        >
          <Trash2 size={18} aria-hidden />
          {deleteMedia.isPending ? "삭제 중…" : "삭제"}
        </button>
      </header>

      <div className="flex flex-1 items-center justify-center px-2 pb-2">
        {!url ? (
          <p className="text-fg-muted">파일 URL을 불러오지 못했습니다.</p>
        ) : media.kind === "video" ? (
          <video
            src={url}
            controls
            autoPlay
            playsInline
            preload="metadata"
            className="max-h-full max-w-full"
          >
            <track kind="captions" />
          </video>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={media.note || "미디어"}
            className="max-h-full max-w-full object-contain"
          />
        )}
      </div>

      {media.note && (
        <footer className="bg-surface p-3 text-fg-primary pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
          <p className="text-caption text-fg-secondary">메모</p>
          <p className="mt-1 whitespace-pre-wrap text-body">{media.note}</p>
        </footer>
      )}
    </div>
  );
}
