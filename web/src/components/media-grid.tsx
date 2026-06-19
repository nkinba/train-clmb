"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { MediaLightbox } from "@/components/media-lightbox";
import { mediaFileUrl, useFileToken, type MediaRecord } from "@/lib/media";

/**
 * 미디어 썸네일 그리드 + 클릭 시 lightbox 열림.
 * 사진은 그대로(object-cover), 영상은 첫 프레임 + Play 오버레이.
 *
 * 본 cycle은 thumbs를 별도 생성하지 않음 — PB가 원본을 반환. 모바일 그리드에서
 * 32~80px 정도라 다운로드 부담은 small. 영상 thumb는 S18-D follow-up.
 */
export function MediaGrid({ items }: { items: MediaRecord[] }) {
  const [active, setActive] = useState<MediaRecord | null>(null);
  const { data: token } = useFileToken();

  if (items.length === 0) return null;

  return (
    <>
      <ul className="grid grid-cols-3 gap-1.5">
        {items.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => setActive(m)}
              className="relative block aspect-square w-full overflow-hidden rounded-md bg-elevated focus:outline-none focus:ring-2 focus:ring-brand"
              aria-label={m.kind === "video" ? "영상 보기" : "사진 보기"}
            >
              {token ? (
                m.kind === "video" ? (
                  <video
                    src={mediaFileUrl(m, token)}
                    muted
                    playsInline
                    preload="metadata"
                    className="h-full w-full object-cover"
                  >
                    <track kind="captions" />
                  </video>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mediaFileUrl(m, token)}
                    alt={m.note || "사진"}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                )
              ) : (
                <span className="block h-full w-full animate-pulse bg-elevated" />
              )}
              {m.kind === "video" && (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30">
                  <Play
                    size={28}
                    aria-hidden
                    className="text-fg-primary drop-shadow"
                  />
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      <MediaLightbox media={active} onClose={() => setActive(null)} />
    </>
  );
}
