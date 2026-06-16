import { AuthGuard } from "@/components/auth-guard";
import { QueueBadge } from "@/components/queue-badge";

/**
 * (protected) route group의 layout. URL 경로에는 영향 없음.
 * 그룹 내부 모든 라우트(/, /logs, /analysis, /settings)가 AuthGuard로 보호됨.
 *
 * 비보호 라우트는 그룹 밖:
 * - /login (인증 진입)
 * - /dev/* (개발용 카탈로그·연결 확인)
 *
 * S12: 인증된 화면에서만 오프라인 큐 배지 노출.
 */
export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <QueueBadge />
      {children}
    </AuthGuard>
  );
}
