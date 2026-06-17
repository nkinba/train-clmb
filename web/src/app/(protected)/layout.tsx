import { AuthGuard } from "@/components/auth-guard";
import { BottomNav } from "@/components/bottom-nav";
import { QueueBadge } from "@/components/queue-badge";

/**
 * (protected) route group의 layout. URL 경로에는 영향 없음.
 * 그룹 내부 모든 라우트(/, /logs, /analysis, /settings, /sessions/*)가 AuthGuard로 보호됨.
 *
 * 비보호 라우트는 그룹 밖:
 * - /login (인증 진입)
 * - /dev/* (개발용 카탈로그·연결 확인)
 *
 * - S12: 인증된 화면에서만 오프라인 큐 배지 노출.
 * - BottomNav는 layout에서 한 번만 마운트 + usePathname으로 자동 active.
 *   세션 모듈 페이지(/sessions/*)에서도 다른 탭으로 이동 가능.
 *   풀스크린 timer는 z-50 fixed라 BottomNav(z-40) 위로 자동 가림.
 */
export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <QueueBadge />
      {children}
      <BottomNav />
    </AuthGuard>
  );
}
