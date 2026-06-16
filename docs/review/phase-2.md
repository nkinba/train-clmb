# Phase 2 — Review

## S08 — 2026-06-17

### Subagent (general-purpose) 원문

종합 평가: **accept-with-fixes**. Acceptance criteria 4건 모두 코드로 표현됐고 optimistic update / QueryClient 구성도 정상. 다만 1) active page의 stale 활성 세션 ID 자동 복구 누락, 2) Home의 `?? "장소 미입력"` 폴백이 빈 문자열로 인해 절대 트리거되지 않음, 3) `total_time_mins`/`*_pain_end` 필드는 PocketBase 마이그레이션상 `required: false`이지만 클라이언트는 항상 0을 전송해 nullable 의도와 어긋남, 4) PB rule이 `@request.auth.id != ''`이라 단일 사용자 가정에 의존 — 등을 정리하면 머지 가능.

#### 🔴 Critical
- **`web/src/app/(protected)/sessions/active/page.tsx:23-31`** — 활성 세션 ID stale 처리 누락. `useSession(activeId)`가 PB 404를 받으면 사용자가 무한 갇힘. PB 에러가 404일 때 `setActiveSessionId(null)` + `router.replace("/sessions/new/")` 분기를 `useEffect`로 추가하라.
- **`web/src/lib/sessions.ts:97-99, 119`** — PB schema에서 `total_time_mins`, `shoulder_pain_end`, `finger_pain_end` 모두 `required: false`. 생성 시 0으로 박아넣으면 "종료된 세션 vs 진행 중 세션"을 값으로 구분 불가. create payload에서 세 필드를 **빼고** PB의 nullable 동작 활용 권장.

#### 🟡 Suggested
- **`web/src/app/(protected)/page.tsx:66`** — `session.location?.trim() ?? "장소 미입력"`. PB text 필드는 미입력 시 `""`을 반환 → `??`는 `null/undefined`만 잡으므로 폴백 발동 안 됨. `||`로 교체.
- **`web/src/app/(protected)/sessions/active/page.tsx:39`** — `totalMins` 초기값 60. 사용자가 그대로 두면 항상 60분 저장. 의도된 트레이드오프일 수 있어 Suggested.
- **`web/src/lib/sessions.ts:111-143`** — `useCreateSession`의 더블 클릭 race 가능성. UI `disabled` + client_id unique index로 어느 정도 보호되나 명시적 가드 권장.
- **`web/src/app/(protected)/sessions/new/page.tsx:85-92`** & **active page textarea** — `autoComplete`/`inputMode` 미지정.
- **`web/src/lib/sessions.ts:69-81`** — `useSession(null)` 시 queryKey가 더미 문자열 `"none"`. 다른 곳에서 동일 키 사용 시 충돌 위험. `[...all, "detail", id]` 패턴 통일.
- **`infra/pocketbase/pb_migrations/...`** — PB rule이 "어떤 인증된 유저든 모든 row CRUD". 향후 `@request.auth.id = "<single-user-id>"` 또는 `owner` relation으로 강화 (S08 범위 밖).

#### 🟢 Nit
- **`web/src/components/query-provider.tsx:13`** — `gcTime: 5 * 60_000` → `5 * 60 * 1000` 가독성.
- **`web/src/app/(protected)/sessions/active/page.tsx`** — `aria-disabled` 명시적 boolean.
- **`web/src/lib/sessions.ts:43-45`** — `ACTIVE_KEY` 주석에 관련 ADR 인용 추가 권장.
- **page.tsx & active/page.tsx의 localStorage 패턴** — `useActiveSessionId()` 훅 추출 (반복 2건이라 지금은 YAGNI).

#### 합격 항목 요약
- Acceptance criteria 4개 모두 코드로 표현됨.
- `useCreateSession`이 `client_id: newClientId()`로 ADR-4 멱등 키 패턴 정확히 적용.
- `useEndSession`의 optimistic update가 `cancelQueries → snapshot → setQueryData → onError rollback` 표준 패턴.
- `QueryProvider`가 `useState(() => new QueryClient(...))`로 1회 생성, SSR/static export 친화적.
- `useSession`의 `enabled: id != null` 가드.
- `getActiveSessionId` / `setActiveSessionId`의 `typeof window === "undefined"` 가드.
- 활성 세션 페이지에서 `checked` 플래그로 SSR/CSR mismatch 깜빡임 방지 + spinner에 `role="status" aria-live="polite"`.
- 모든 주요 버튼이 48dp+ 토큰 사용.
- 에러 표시에 `role="alert"`.
- `dangerouslySetInnerHTML` 사용 0건.
- `disabled={endSession.isPending}`가 취소·제출 양쪽에 적용.
- TanStack Query 도입이 optimistic update / 캐시 공유 / S09+ 오프라인 큐 기반 마련 차원에서 정당.

### 본인 수용/반박 판단

| 항목 | 결정 | 사유 |
| --- | --- | --- |
| 🔴 PB 404 자동 복구 (active page) | **수용** | 실제로 발생 가능한 stale 상태. `useEffect`로 404 감지 시 `setActiveSessionId(null) + router.replace`. 홈에도 같은 처리 추가 (별도 fetch 경로). |
| 🔴 create payload에서 종료 필드 제거 | **수용** | schema의 `required: false` 의도 존중. 진행 중 vs 종료된 세션 구분을 값으로 가능하게 함. |
| 🟡 home `?? "장소 미입력"` → `||` | **수용** | 명백한 버그 (PB text 필드 빈 문자열 반환 동작과 불일치). |
| 🟡 `totalMins` 초기값 60 | **반박** | 의도된 기본값. 30초 흐름 acceptance criteria에 부합. 사용자가 빠르게 조정 가능. |
| 🟡 `useCreateSession` race 가드 | **반박** | client_id unique index + UI `disabled={createSession.isPending}` (이미 적용)로 두 번째 호출은 PB 409 또는 disabled로 차단. 추가 가드는 over-engineering. |
| 🟡 input `autoComplete`/`inputMode` | **수용** | 모바일 UX 가이드라인 충족. |
| 🟡 `useSession` queryKey 정리 | **수용** | `[...sessionKeys.all, "detail", id]` 통일로 충돌 위험 제거. |
| 🟡 PB rule 강화 (single user filter) | **반박 (follow-up)** | S08 범위 밖. ADR-5는 단일 사용자 가정을 명문화함. 향후 Phase 3 또는 v1.1에서 강화 검토. |
| 🟢 `gcTime` 산식 가독성 | **수용** | |
| 🟢 `aria-disabled={true}` 명시 | **수용** | |
| 🟢 `ACTIVE_KEY` 주석에 ADR 인용 | **반박** | dynamic-route 회피 결정은 ADR에 없음 (구현 결정). 주석 자체로 충분. |
| 🟢 `useActiveSessionId` 훅 추출 | **반박** | 호출처 2건. YAGNI. Phase 2 추가 페이지에서 동일 패턴 반복 시 추출. |
