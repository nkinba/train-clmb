import PocketBase, { ClientResponseError } from "pocketbase";

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

/**
 * 서버 측 인증 실패(401) 시 클라이언트 authStore를 정리.
 * - JWT exp 클레임은 SDK가 isValid에서 자동 체크하지만,
 *   서버 측 revoke / 시계 차이 / 깨진 토큰은 isValid가 잡지 못함.
 * - afterSend는 모든 PB API 호출 응답 직후 실행되므로 SDK 레벨에서 자동 정리.
 * - authStore.clear() → onChange 트리거 → AuthGuard가 /login으로 redirect.
 *
 * SSR 안전: this는 클라이언트 컴포넌트 import 시점에 평가됨. 단 fetch 자체는
 * 서버 컴포넌트에서 호출 안 함 → 사이드 이펙트 없음.
 */
pb.afterSend = (response, data) => {
  if (response.status === 401) {
    // /api/admins/auth-with-password 같은 명시적 로그인 호출도 401을 돌려주지만
    // 그건 authStore에 토큰이 없는 상태라 clear()가 무해 (idempotent).
    pb.authStore.clear();
  }
  return data;
};

export { ClientResponseError };

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
