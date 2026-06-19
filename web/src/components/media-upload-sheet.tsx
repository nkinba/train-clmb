"use client";

import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, X } from "lucide-react";
import { useUploadMedia, type MediaKind } from "@/lib/media";

// PB 마이그레이션의 file 필드 maxSize와 일치 (50MB).
const MAX_FILE_BYTES = 50 * 1024 * 1024;

/**
 * 미디어 첨부 시트 — 모바일 카메라 또는 갤러리에서 사진/영상 선택 → 진행률 표시 → 업로드.
 * 토글된 상태에서 파일 picker가 열림. 선택된 파일은 sheet 내부에서 preview + 메모 입력 후 업로드.
 */
export function MediaUploadSheet({
  open,
  onClose,
  sessionId,
}: {
  open: boolean;
  onClose: () => void;
  sessionId: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const upload = useUploadMedia();

  // 시트 열릴 때 reset + ESC 핸들러 + body scroll lock
  useEffect(() => {
    if (!open) return;
    setFile(null);
    setNote("");
    setProgress(0);
    setError(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !upload.isPending) onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, upload.isPending]);

  // 파일 선택 시 preview URL 생성 + cleanup
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!open) return null;

  const kind: MediaKind | null = file
    ? file.type.startsWith("video/")
      ? "video"
      : "photo"
    : null;

  const onSubmit = async () => {
    if (!file || !kind) return;
    setError(null);
    setProgress(0);
    try {
      await upload.mutateAsync({
        session_id: sessionId,
        kind,
        file,
        note: note.trim() || undefined,
        onProgress: (r) => setProgress(r),
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "업로드 실패");
    }
  };

  const sizeMb = file ? (file.size / (1024 * 1024)).toFixed(1) : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="미디어 첨부"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget && !upload.isPending) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-surface p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-h3 font-semibold text-fg-primary">미디어 첨부</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={upload.isPending}
            aria-label="닫기"
            className="flex h-tap w-tap items-center justify-center rounded-md text-fg-muted hover:bg-elevated disabled:opacity-50"
          >
            <X size={20} aria-hidden />
          </button>
        </div>

        {!file ? (
          <div className="flex flex-col gap-3">
            <p className="text-caption text-fg-muted">
              사진 또는 영상을 선택하면 미리보기 후 업로드합니다. 최대 50MB.
            </p>
            {error && (
              <p
                role="alert"
                className="rounded-md bg-elevated px-3 py-2 text-caption text-status-danger"
              >
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-tap-default w-full items-center justify-center gap-2 rounded-lg bg-brand text-on-brand text-bodyLg font-semibold transition-colors hover:bg-brand-hover active:bg-brand-active"
            >
              <ImageIcon size={20} aria-hidden />
              사진/영상 선택
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                if (!f) return;
                if (f.size > MAX_FILE_BYTES) {
                  setError(
                    `파일 크기 ${(f.size / 1024 / 1024).toFixed(1)}MB — 50MB 이하만 가능합니다.`,
                  );
                  // input value 초기화 — 같은 파일 재선택 가능하게.
                  e.target.value = "";
                  return;
                }
                setError(null);
                setFile(f);
              }}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Preview file={file} previewUrl={previewUrl} kind={kind} />

            <div className="flex items-center justify-between text-caption text-fg-muted">
              <span>
                {kind === "video" ? "영상" : "사진"} · {sizeMb} MB
              </span>
              {!upload.isPending && (
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="rounded-md px-2 py-1 text-brand hover:bg-elevated"
                >
                  다시 선택
                </button>
              )}
            </div>

            <label className="block">
              <span className="text-caption text-fg-secondary">메모 (선택)</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={500}
                disabled={upload.isPending}
                placeholder="예) V6 프로젝트 — 크럭스 전 발 위치"
                className="mt-1 w-full rounded-md bg-elevated px-3 py-2 text-fg-primary outline-none disabled:opacity-50"
              />
            </label>

            {upload.isPending && (
              <ProgressBar ratio={progress} />
            )}

            {error && (
              <p
                role="alert"
                className="rounded-md bg-elevated px-3 py-2 text-caption text-status-danger"
              >
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={onSubmit}
              disabled={upload.isPending}
              className="h-tap-default w-full rounded-lg bg-brand text-on-brand text-bodyLg font-semibold transition-colors hover:bg-brand-hover active:bg-brand-active disabled:cursor-not-allowed disabled:opacity-50"
            >
              {upload.isPending
                ? `업로드 중… ${Math.round(progress * 100)}%`
                : "업로드"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Preview({
  file,
  previewUrl,
  kind,
}: {
  file: File;
  previewUrl: string | null;
  kind: MediaKind | null;
}) {
  if (!previewUrl || !kind) return null;
  return (
    <div className="overflow-hidden rounded-lg bg-elevated">
      {kind === "video" ? (
        <video
          src={previewUrl}
          controls
          preload="metadata"
          className="aspect-video w-full bg-black"
        >
          <track kind="captions" />
        </video>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={file.name}
          className="max-h-72 w-full object-contain bg-black"
        />
      )}
    </div>
  );
}

function ProgressBar({ ratio }: { ratio: number }) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className="h-2 w-full overflow-hidden rounded-full bg-elevated"
    >
      <div
        className="h-full bg-brand transition-[width] duration-150 ease-linear"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

