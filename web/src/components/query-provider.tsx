"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * TanStack Query Provider.
 * QueryClient를 useState로 1회 생성 — 같은 인스턴스가 hydration mismatch 없이 재사용된다.
 *
 * 단일 사용자 + 자주 안 바뀌는 데이터라 stale-while-revalidate를 길게:
 * - staleTime: 30s — 같은 탭에서 짧은 시간 내 재방문은 캐시 사용
 * - gcTime: 5m — 백그라운드 탭에서 5분 후 정리
 * 오프라인 큐(S12)는 별도 mutation persister로 처리할 예정.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
