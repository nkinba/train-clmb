# Phase 2 — History

## S08 — 2026-06-17 (commit <pending>)

### 변경 파일 요약
- `web/package.json`, `web/pnpm-lock.yaml` — `@tanstack/react-query@5.101.0` 추가.
- `web/src/components/query-provider.tsx` *(신규)* — QueryClient 1회 생성, staleTime 30s / gcTime 5m, `refetchOnWindowFocus: false`.
- `web/src/app/layout.tsx` — RootLayout에 `<QueryProvider>` 래핑.
- `web/src/lib/sessions.ts` *(신규)* — `SessionRecord` 타입 + `useSession` / `useCreateSession` / `useEndSession` + 활성 세션 localStorage 헬퍼.
- `web/src/app/(protected)/sessions/new/page.tsx` *(신규)* — 새 세션 폼 (날짜·장소·타깃·시작 통증).
- `web/src/app/(protected)/sessions/active/page.tsx` *(신규)* — 활성 세션 정보 + 하위 모듈 진입 카드 placeholder + 종료 폼.
- `web/src/app/(protected)/page.tsx` — 홈 wiring (활성 세션 카드 ↔ + 세션 시작 CTA).
- `docs/STORIES.md` — S08 → ✅ Done.
- `docs/review/phase-2.md` *(신규)* — self-review 원문 + 수용/반박 판단.

### 주요 의사결정·트레이드오프

#### 1. Static export + dynamic route 회피
Next.js 16의 `output: "export"`는 `[id]` dynamic route에 `generateStaticParams`를 요구한다. 단일 사용자 + 동적 세션 ID는 build-time에 알 수 없으므로 두 가지 옵션:
- (A) `[id]` + 빈 `generateStaticParams()` → 모든 ID가 404 (정적 호스팅).
- (B) `/sessions/active` 단일 경로 + localStorage `cf:active-session-id` 키.

**(B) 채택.** 단일 사용자 앱이라 동시 활성 세션 1개라는 가정이 자연스럽고, 정적 호스팅(Cloudflare Pages)과 호환. 트레이드오프:
- 과거 세션 직접 URL 북마크 불가 → `/logs` 탭에서 진입 (Phase 2 후반/S16).
- 다중 디바이스 동시 사용 시 localStorage 분리 → 단일 사용자 1 기기 시나리오에 한정.

#### 2. PRD §3 sessions schema에 RPE/fatigue 없음 (S01 drift)
STORIES.md S08은 "세션 종료 시 RPE·전반적 피로도 입력 (S01 필드)"라고 명시하지만 실제 마이그레이션(`infra/pocketbase/pb_migrations/1750000001_initial_schema.js`)에는 session-level RPE/fatigue 필드가 없다. PRD §3은 RPE를 child collection(`hangboard_logs`, `climbing_logs`, `strength_logs`)에만 둠. → 종료 폼은 schema가 실제로 가진 `shoulder_pain_end / finger_pain_end / total_time_mins / notes`만 받음. STORIES 문구는 **문서 drift**로 식별, S09+ 작업 시 일관성 점검 필요.

#### 3. TanStack Query 도입
STORIES 명시 지시. 단일 사용자 + 단순 mutation만 있는 현 단계에선 `useState`로도 충분하지만, S09+ optimistic update 패턴과 S12 오프라인 큐의 mutation persister 기반을 미리 마련. 번들 추가 비용 ~13kB gzip — 단일 사용자 PWA에서 수용 가능.

#### 4. Optimistic update 패턴
- `useCreateSession`: `onSuccess`에서 캐시 `setQueryData` + localStorage activeId set (진짜 optimistic 아님 — create는 ID가 서버에서 옴).
- `useEndSession`: `onMutate`로 캐시 즉시 갱신, `onError`로 rollback, `onSuccess`로 activeId clear (표준 패턴).

#### 5. Stale 활성 세션 ID 자동 복구
PB에서 세션 record가 삭제되면 localStorage에 stale ID가 남아 무한 404 표시. → home + active page 모두 `useEffect`로 404 감지 시 `setActiveSessionId(null)` + (active page는) `/sessions/new/`로 replace.

### 다음 Story (S09)에 영향 줄 컨텍스트
- `/sessions/active`에서 하위 모듈 진입 카드 3개 (행보드/등반/근력)는 현재 `disabled` placeholder. S09에서 행보드 카드 활성화 + `/sessions/active/hangboard/` 경로 생성 예정.
- 모듈 페이지에서 `getActiveSessionId()`로 세션 ID 확보 + 자식 컬렉션 mutation 시 `session_id` 필드 채우기.
- `useCreateSession`이 client_id 멱등 키 패턴을 적용한 reference 구현. 자식 컬렉션 mutation도 동일 패턴 따를 것.

### 미해결 follow-up
- **PB rule 강화**: 현재 `@request.auth.id != ''`는 어떤 인증된 유저든 모든 row CRUD 가능. 단일 사용자 가정 의존. 향후 `@request.auth.id = "<single-user-id>"` 또는 `owner` relation 도입 검토 (ADR-5 보강).
- **세션 진행/종료 상태 구분 컬럼**: 현재는 `total_time_mins > 0`으로 추론 (의도된 nullable 활용). 명시적 `ended_at` timestamp가 필요해지면 별도 마이그레이션.
- **/logs 페이지**: 과거 세션 조회 진입점. S12 또는 v1.1.

### 브라우저 검증 (Comet MCP 미연결 — 사용자 직접 수행 권장)
이번 사이클은 Comet MCP가 세션에 연결되어 있지 않아 모바일 인터랙티브 검증을 자동화하지 못했다. 빌드(`pnpm build` 12/12 정적 페이지 생성)와 HTTP smoke (`GET /`, `/sessions/new/`, `/sessions/active/` 모두 200) + PB 헬스(`/api/health`)는 통과. 사용자 검증 절차:
1. `cd web && pnpm dev` → `http://localhost:3000`.
2. 모바일 뷰포트(390×844)에서 `/login`으로 로그인.
3. 홈에서 "세션 시작" → 폼 작성 → 생성 → `/sessions/active/`로 자동 이동.
4. PB admin UI(`http://localhost:8090/_/`)에서 `sessions` 컬렉션에 row 생성 확인 (target/location/시작 통증 일치).
5. active 페이지에서 "세션 종료" → 종료 폼 작성 → 저장 → 홈으로 복귀 (활성 세션 카드 사라지고 + 세션 시작 CTA 재표시).
6. PB에서 같은 row의 `total_time_mins`, `*_pain_end`, `notes` 채워짐 확인.
7. PB admin에서 해당 row 삭제 후 새로고침 → 자동으로 `/sessions/new/`로 리다이렉트 (stale ID 복구).
8. 검증 결과를 본 history에 ✅ 한 줄 추가.
