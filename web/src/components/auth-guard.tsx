"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { pb } from "@/lib/pb";

type State = "loading" | "auth" | "redirecting";

/**
 * 보호 라우트 wrapper.
 * SSR/static render에서는 항상 "loading"으로 시작 (hydration mismatch 회피).
 * 클라이언트 hydration 후 useEffect에서 pb.authStore.isValid 확인 → auth/redirect.
 *
 * 동기화 채널:
 * - pb.authStore.onChange — 같은 탭의 logout/login에 즉시 반응
 * - window storage 이벤트 — 다른 탭의 localStorage 변경(`pocketbase_auth` 키)에 반응
 *   (PocketBase LocalAuthStore는 storage 이벤트를 자체 발행하지 않음)
 *
 * 토큰 만료/서버 측 거부 처리:
 * - 마운트 시 authRefresh()로 서버 검증 + 새 토큰 발급. 실패하면 lib/pb.ts의
 *   afterSend 401 핸들러가 authStore.clear() → onChange로 자동 redirect.
 * - 사용 중 발생한 401은 동일하게 afterSend가 정리.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    let cancelled = false;

    const apply = () => {
      if (cancelled) return;
      if (pb.authStore.isValid) {
        setState("auth");
      } else {
        setState("redirecting");
        router.replace("/login/");
      }
    };

    apply();

    // 마운트 시 1회 서버 측 토큰 검증 + 갱신. 만료/revoke된 토큰을 즉시 감지.
    // 비인증 상태(isValid=false)는 위 apply에서 이미 redirect 처리 → refresh skip.
    if (pb.authStore.isValid) {
      pb.collection("users")
        .authRefresh()
        .catch(() => {
          // 실패 응답이 401이면 afterSend가 authStore.clear() → onChange로 redirect.
          // 다른 에러(네트워크 등)는 그대로 통과 — 토큰 자체는 유효할 수 있음.
        });
    }

    const unsubscribe = pb.authStore.onChange(apply);

    const onStorage = (e: StorageEvent) => {
      if (e.key === "pocketbase_auth") apply();
    };
    window.addEventListener("storage", onStorage);

    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener("storage", onStorage);
    };
  }, [router]);

  if (state === "auth") return <>{children}</>;
  return (
    <FullPageSpinner
      label={state === "redirecting" ? "로그인 페이지로 이동 중…" : undefined}
    />
  );
}

function FullPageSpinner({ label }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-1 flex-col items-center justify-center gap-3"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-subtle border-t-fg-primary" />
      {label && <p className="text-caption text-fg-muted">{label}</p>}
    </div>
  );
}
