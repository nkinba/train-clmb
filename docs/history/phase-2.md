# Phase 2 — History

## S08 — 2026-06-17 (commit a96c815)

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

---

## S09 — 2026-06-17 (commit <pending>)

### 변경 파일 요약
- `web/src/lib/hangboard-timer.ts` *(신규)* — 순수 상태머신 (`Phase`/`TimerState`/`reduce`/selectors). wall-clock 비교 + `aborted` 마커.
- `web/src/lib/hangboard.ts` *(신규)* — `useCreateHangboardLog` mutation + 타입.
- `web/src/hooks/use-wake-lock.ts` *(신규)* — Wake Lock API + visibility 회복 재요청.
- `web/src/hooks/use-audio-beep.ts` *(신규)* — Web Audio sine beep + `unlock()` + `ready` 노출 + `vibrate(pattern)` 헬퍼.
- `web/src/hooks/use-phase-notification.ts` *(신규)* — Notification API + SW.showNotification 폴백 + `document.hidden`일 때만 발사.
- `web/src/components/hangboard/hangboard-setup.tsx` *(신규)* — 그립/홀드/무게/시간/세트 입력 폼.
- `web/src/components/hangboard/full-screen-timer.tsx` *(신규)* — 풀스크린 타이머 + 진행 바 + 세트 도트 + 결과 prompt (휴식 잔여 시간 동반 표시).
- `web/src/components/hangboard/hangboard-summary.tsx` *(신규)* — 결과 수정 + RPE + 저장.
- `web/src/app/(protected)/sessions/active/hangboard/page.tsx` *(신규)* — orchestration. 100ms tick interval. setup → timer → summary.
- `web/src/app/(protected)/sessions/active/page.tsx` — 행보드 모듈 카드 활성화.
- `docs/STORIES.md` — S09 → ✅ Done.
- `docs/review/phase-2.md` — S09 리뷰 + 수용/반박 판단 append.

### 주요 의사결정·트레이드오프

#### 1. 상태머신 분리 (`lib/hangboard-timer.ts`)
페이즈 전환 로직을 순수 reducer로 격리 → React 외부에서 단위 테스트 가능 (현재는 미작성, v1.1 follow-up). 모든 액션이 `now`를 caller에서 받는 결정적 함수.

#### 2. wall-clock tick + 100ms interval
RAF 60Hz는 디스플레이가 초 단위라 과도. setInterval 100ms로 변경 → 배터리 절약. 백그라운드 throttle는 `Date.now()` 비교로 catch-up 정확. ADR-7대로 포그라운드 유지가 전제.

#### 3. abort vs 자연 완료 신호 분리
`TimerState.aborted: boolean` 마커. 페이즈 신호 effect는 `cur === "done" && !state.aborted`일 때만 완료 비프/진동/알림. 사용자가 중단했는데 "완료" 신호가 울리는 모순 회피.

#### 4. Notification 권한은 setup 화면에서만 요청
`onStart`에서 `await audio.unlock()` 후 권한 요청 시 iOS Safari가 사용자 제스처 문맥을 잃고 prompt를 무시할 수 있어, setup 화면의 명시적 "권한 요청" 버튼만 사용. 권한 없어도 메인 흐름(포그라운드)은 동작.

#### 5. `total_sets` 의미 결정
PRD §3은 모호하지만 §5 성공 지표 "주간 행보드 총 매달리기 초"가 정확하려면 시도한 세트만 카운트해야 함 → `total_sets = completedCount(state)` (결과 입력된 세트). abort 시 안 한 세트는 볼륨에 안 잡힘. 코드에 의도 주석 명시.

#### 6. `actual_hang_seconds` 단일 값 한계 (v1.1)
스키마는 hangboard_logs row 1개에 단일 `actual_hang_seconds`. 세트별 실제 매달린 초가 다를 수 있는 시나리오(성공 5초, 실패 3초)는 단일 값으로 표현 불가 → 현 단계는 `target = actual` 가정. 세트별 actual을 측정하려면 `hangboard_logs` → `hangboard_set_logs N개`로 분할해야 해서 v1.1.

#### 7. iOS PWA notification 경로 + inline 폴백
`navigator.serviceWorker.getRegistration().showNotification()` 우선, SW 없을 때 inline `new Notification()` 폴백. iOS PWA 호환성 확보.

#### 8. hook 반환 객체 `useMemo` 안정화
호출 측 useEffect deps에 hook 반환 객체를 넣어도 매 렌더 재발사 안 되도록 useMemo로 stable identity 보장.

### 다음 Story (S10)에 영향 줄 컨텍스트
- 자식 컬렉션 mutation 패턴 (`useCreateHangboardLog`)이 S10/S11의 등반·근력 mutation 작성 시 reference. 동일 client_id 멱등 키 패턴.
- 세션 ID 가드 패턴 (`getActiveSessionId()` + `useEffect` 리디렉트)이 모든 모듈 페이지에서 반복 — `useActiveSessionId()` 훅 추출은 호출처 3곳 이상에서 결정.
- `S10` (등반)도 "세트 간 휴식 타이머 (3분) 추가" 명시 → `hangboard-timer.ts`의 `reduce`/`makeInitialState` 재사용 가능. 별도 모듈로 둘 수 있고 generic timer로 추출도 가능 — S10 진행 시 결정.

### 미해결 follow-up
- **세트별 부분 매달리기 측정 (v1.1)**: `hangboard_logs` → 세트 row 분할 검토.
- **Wake Lock micro-race**: 빠른 enabled 토글 시 in-flight acquire/release 순서. 실제 영향 작음.
- **타이머 머신 단위 테스트**: `reduce` 함수가 순수라 추가 단순. v1.1.
- **알림 UX 컨피그**: 비프/진동 켜고 끄기 토글, beep 음량, hold 시간 5초/7초/10초 프리셋 — v1.1.
- **dev SW notification 검증 경로**: 환경변수로 dev SW 등록 옵션화 검토 — v1.1.

### 브라우저 검증 (Comet MCP 미연결 — 사용자 직접 수행)
빌드(`pnpm build` 13/13 정적 페이지), HTTP smoke (`GET /sessions/active/hangboard/` 200) 통과. 사용자 인터랙티브 검증:
1. `cd web && pnpm dev`, 모바일 뷰포트(390×844).
2. 로그인 → 홈 → 세션 시작 → 행보드 카드 → setup 화면.
3. "권한 요청" 버튼으로 Notification 권한 부여 (선택).
4. "+ 타이머 시작" → 풀스크린 타이머 진입. 화면이 자동으로 꺼지지 않는지 확인 (Wake Lock).
5. 페이즈 전환마다 비프 + 진동 발생 확인 (이어폰 + 진동 ON 권장).
6. hang 종료 → rest 진입 + 결과 prompt 표시. prompt 하단에 "휴식 남음 NNs" 라벨 확인.
7. 5세트 모두 완료 후 자동 done → summary 화면.
8. 다른 탭/앱으로 이동 후 30초 내 페이즈 전환 → OS notification 도착 확인 (iOS는 백그라운드 ~30s 후 정지 — ADR-7).
9. RPE 선택 → "기록 저장" → `/sessions/active/`로 복귀. PB admin UI에서 `hangboard_logs` row 확인 (success_sets, total_sets, grip_type, hold_size_mm, weight_offset_kg, rpe).
10. abort 시나리오: 타이머 동작 중 우상단 정지 버튼 → 즉시 summary로 (완료 비프/진동/알림 발사 안 됨 확인).
11. 검증 결과를 본 history에 ✅ 한 줄 추가.
