import PocketBase from "pocketbase";

/**
 * PocketBase 클라이언트 싱글톤.
 * URL은 NEXT_PUBLIC_PB_URL 환경변수 (없으면 로컬 기본값).
 *
 * Auth 토큰은 SDK 기본 LocalAuthStore가 localStorage에 보관 (ADR-5).
 * SSR 컨텍스트에서 자동으로 메모리 fallback이라 정적 export와도 호환.
 */
export const pb = new PocketBase(
  process.env.NEXT_PUBLIC_PB_URL ?? "http://localhost:8090",
);

/** 컬렉션 이름 상수 — 마이그레이션과 일치 (typo 방지). */
export const Collections = {
  Sessions: "sessions",
  HangboardLogs: "hangboard_logs",
  ClimbingLogs: "climbing_logs",
  StrengthLogs: "strength_logs",
  CampusLogs: "campus_logs",
} as const;

/**
 * client_id 생성 (ADR-4 오프라인 큐 멱등 키).
 * 모든 mutation 호출 시 발급해서 record에 함께 보내야 함.
 * crypto.randomUUID는 모던 브라우저·Node 19+ 표준.
 */
export function newClientId(): string {
  return crypto.randomUUID();
}
