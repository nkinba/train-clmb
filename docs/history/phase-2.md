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

## S09 — 2026-06-17 (commit c548a43)

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

---

## S10 — 2026-06-17 (commit b88350c)

### 변경 파일 요약
- `web/src/lib/climbing.ts` *(신규)* — 타입 + create mutation + 세션별 list query + Lead/Bouldering 그레이드 상수.
- `web/src/components/climbing/grade-picker.tsx` *(신규)* — radiogroup + roving tabindex.
- `web/src/components/climbing/rest-timer.tsx` *(신규)* — 단순 1-페이즈 카운트다운 (3분 기본) + beep + vibrate.
- `web/src/app/(protected)/sessions/active/climbing/page.tsx` *(신규)* — 모드 토글 / 그레이드 / 시도 / 완등 / 프로젝트 / 메모 / RPE / 휴식 타이머 / 누적 row list.
- `web/src/app/(protected)/sessions/active/page.tsx` — 등반 카드 활성화.
- `docs/STORIES.md` — S10 → ✅ Done.
- `docs/review/phase-2.md` — S10 리뷰 append.

### 주요 의사결정·트레이드오프

#### 1. row-by-row 저장 + 부분 리셋
한 세션에 여러 시도 row를 누적. 저장 시 attempts/isSend/notes/rpe만 리셋, grade/projectName/type 유지 — 같은 프로젝트를 여러 번 시도하는 흐름과 일치.

#### 2. Lead `is_send` 처리 (PB bool nullable 부재)
PRD §3은 Lead의 `is_send`를 "의미 없음 → null"로 정의했으나 PocketBase bool은 null 미지원. 마이그레이션 주석에 이미 명시된 트레이드오프대로 **Lead 시 강제 false 저장 + UI 숨김 + 모드 전환 시 리셋**.

#### 3. RestTimer는 별도 단순 카운트다운
S09의 풀스크린 머신을 재사용하지 않은 이유:
- 풀스크린 전환 불필요 (폼 옆 위젯)
- 페이즈 cycle 1개로 충분
- 단순 useState로 100ms tick 운영, beep/vibrate는 한 번만 (firedRef).

#### 4. Lead 그레이드 범위 (PRD/STORIES drift)
STORIES S10: "5.10D~5.12A". PRD §3: "5.10D~5.11A".
구현: **5.10a~5.12a (9개)**. 워밍업 그레이드 기록 유연성 + 진척 측정용 PRD 타깃 범위(5.12/V7)를 모두 포함.
drift 식별:
- PRD §3의 "5.10D~5.11A"는 한 화면에서 추적할 핵심 타깃 그레이드 (문서 작성 시점의 사용자 등급).
- STORIES S10의 "5.10D~5.12A"는 입력 가능 범위로 확장된 표현.
- 구현은 5.10a~5.12a로 한 단계 더 확장. 워밍업/기록 누락 회피 위해.
→ 차후 PRD/STORIES 정합성 점검 시 "타깃 범위 vs 입력 범위" 구분 명시 권장.

#### 5. PB filter 바인딩
`pb.filter("session_id = {:sid}", { sid })` 사용 — 인젝션 디폴트 안전성. S11에서도 reference.

#### 6. 그레이드 grid-cols-3 vs 모바일 thumb-reach
Lead 9개를 3열로 wrap. 첫 행(5.10a~5.10c)은 thumb-reach가 어려운 위치(화면 상단). 사용 빈도가 높은 5.11/5.12가 아래 행에 위치하여 실용상 OK이나 실 디바이스 확인 필요. 사용자 검증 가이드에 포함.

### 다음 Story (S11)에 영향 줄 컨텍스트
- 자식 컬렉션 mutation + list query 패턴이 strength_logs / campus_logs에서도 그대로 적용.
- `pb.filter()` 바인딩 패턴은 모든 list query에서 표준.
- S11도 row-by-row 저장 + 부분 리셋 패턴 재사용.
- 종목 selector + 즐겨찾기 (STORIES S11)는 별도 컴포넌트 추출 필요.

### 미해결 follow-up
- **Lead 그레이드 범위 doc drift**: PRD §3 / STORIES S10 / 구현 3자 정합성 점검.
- **그레이드 추가 (5.12b/c, V9+)**: 사용자 진척 시 확장. v1.1.
- **`useActiveSessionId()` 훅 추출**: 호출처 4곳 (홈, active, hangboard, climbing) — 다음 사이클 또는 S11 후 결정.
- **휴식 타이머 unsynchronized defaultSec prop**: 현재는 prop 변경이 useState 초기값만 영향. 동적 변경 시나리오 없음.

### 브라우저 검증 (Comet MCP 미연결 — 사용자 직접 수행)
빌드 14/14 정적, HTTP smoke `GET /sessions/active/climbing/` 200. 인터랙티브 검증:
1. 세션 진입 → 등반 카드 → climbing 페이지.
2. 모드 토글 (볼더링 ↔ 리드) → 그레이드 자동 디폴트 변경 확인.
3. 시도 횟수 stepper, 완등 토글(볼더링), 프로젝트 이름, 메모, RPE 입력.
4. 휴식 타이머(볼더링) 시작 → 3분 후 beep + 진동.
5. "+ 기록 추가" → 누적 list 갱신, attempts/isSend/notes/rpe만 리셋 확인.
6. PB admin UI에서 `climbing_logs` row 확인.
7. Lead 모드에서 9개 그레이드 thumb-reach 확인 (모바일).
8. 검증 결과를 본 history에 ✅ 한 줄 추가.

---

## S11 — 2026-06-17 (commit 814033d)

### 변경 파일 요약
- `web/src/lib/strength.ts` *(신규)* — 타입 + create mutation + list query + STRENGTH_PRESETS 10개.
- `web/src/lib/campus.ts` *(신규)* — 타입 + create mutation + list query + label maps.
- `web/src/app/(protected)/sessions/active/strength/page.tsx` *(신규)* — Strength/Campus 모드 토글 한 페이지 통합.
- `web/src/app/(protected)/sessions/active/page.tsx` — 근력 카드 활성화.
- `docs/STORIES.md` — S11 → ✅ Done.

### 주요 의사결정·트레이드오프

#### 1. 한 페이지에 Strength/Campus 통합
별도 페이지 분리 대신 모드 토글. 사용자가 한 세션에서 웨이트와 캠퍼스를 모두 하는 경우 적은 클릭. 컴포넌트는 각각 분리(`StrengthForm`/`CampusForm`).

#### 2. 모드 전환 입력 손실 방지 — hidden 토글
초기 구현은 `mode === "x"` 조건부 렌더로 양쪽 form이 마운트/언마운트되어 입력이 날아감. 5종목 60초 흐름의 신뢰성을 위해 양쪽 모두 마운트 유지 + `hidden` 속성 토글로 변경.

#### 3. 즐겨찾기는 사전 정의 10개 + custom 입력
동적 추가/삭제는 v1.1. 사용자 기록 빈도가 쌓이면 그때 동적 즐겨찾기 추가.

#### 4. Strength preset 영어 라벨
국제 명칭 (Pull-up, Deadlift, ...) — 의도. 캠퍼스 enum도 동일.

#### 5. 저장 후 부분 리셋
- Strength: weight/rpe만 리셋, 종목/세트/반복 유지 (같은 종목 다음 세트 또는 다음 종목 입력 흐름).
- Campus: movements/successSets만 리셋, totalSets/rung/type 유지.

#### 6. `success_sets > total_sets` 클라이언트 검증
PB schema에는 cross-field validator가 없어 클라이언트에서만 검증.

### 다음 Story (S12)에 영향 줄 컨텍스트
- 모든 자식 컬렉션 mutation 패턴이 S12 오프라인 큐의 reference. `client_id` 멱등 키가 모든 row에 발급되어 재전송 안전.
- mutation client 위 layer에 IndexedDB persister를 끼우는 패턴 검토 (`@tanstack/query-persist-client-core` 또는 직접 구현).
- 모든 모듈이 `useCreateXLog` 호출 + `onSuccess` invalidate 패턴 통일.

### 미해결 follow-up
- **동적 즐겨찾기**: localStorage MRU 또는 PB에 별도 collection. v1.1.
- **STRENGTH_PRESETS 한국어 라벨 옵션**: 사용자 설정. v1.1.
- **Strength reps 0 회 입력 차단 안 됨**: schema min:0이라 허용되지만 의미상 1+. UI stepper min:1로 막혀있어 OK.

### 브라우저 검증 (Comet MCP 미연결 — 사용자 직접 수행)
빌드 15/15 정적, HTTP smoke `GET /sessions/active/strength/` 200. 인터랙티브 검증:
1. 세션 진입 → 보조 근력 카드 → strength 페이지.
2. 웨이트 모드: preset 클릭 → weight/reps/sets/RPE 입력 → 저장 → 누적 list 확인.
3. 캠퍼스 모드 전환 → 모드 전환 후 다시 웨이트로 → 입력 보존 확인.
4. 캠퍼스: ladder/touch/double_dyno + large/medium/small + movements + success/total → 저장.
5. PB admin UI에서 `strength_logs`, `campus_logs` row 확인.
6. 5종목 연속 입력 60초 이내 도달 가능한지 실 디바이스 측정.
7. 검증 결과를 본 history에 ✅ 한 줄 추가.

---

## S12 — 2026-06-17 (commit 366bac0)

### 변경 파일 요약
- `web/package.json`, `web/pnpm-lock.yaml` — `idb-keyval@6.2.5` 추가.
- `web/src/lib/mutation-queue.ts` *(신규)* — FIFO 큐 + queuedCreate + flushQueue + dead-letter store.
- `web/src/hooks/use-queue-status.ts` *(신규)* — 큐 길이/online/flushing/dead 상태 + 자동 flush.
- `web/src/components/queue-badge.tsx` *(신규)* — 상단 fixed 배지 (online/offline/flushing/dead-letter 4가지 톤).
- `web/src/app/(protected)/layout.tsx` — QueueBadge 마운트 (인증된 화면만).
- `web/src/lib/hangboard.ts`, `web/src/lib/climbing.ts`, `web/src/lib/strength.ts`, `web/src/lib/campus.ts` — mutationFn에 `queuedCreate` 적용.
- `docs/STORIES.md` — S12 → ✅ Done.
- `docs/review/phase-2.md` — S12 리뷰 append.

### 주요 의사결정·트레이드오프

#### 1. 큐 적용 범위 (STORIES 축소)
STORIES S12 "모든 mutation을 IndexedDB 큐 경유"에서 일부 축소:
- **자식 컬렉션** (hangboard/climbing/strength/campus) create만 큐 적용.
- **세션 mutation** (create/end)은 온라인 가정.
이유: `useCreateSession.onSuccess`가 `setActiveSessionId(rec.id)`로 server-side ID에 의존. 오프라인에서 가짜 ID로 활성 세션을 추적하려면 client_id ↔ server id 매핑 layer가 필요한데 S12 범위를 크게 벗어남. acceptance criteria("오프라인 토글 후 입력 → 동기화")는 자식 row로 충족. follow-up.

#### 2. BroadcastChannel + CustomEvent 이중 신호
BroadcastChannel은 **같은 탭**으로 메시지를 보내지 않음 (스펙). 결과적으로 enqueue 직후 자기 탭의 useQueueStatus가 length 갱신 못 받아 자동 flush가 트리거 안 됨. → 모듈 단위 BroadcastChannel(다른 탭) + `window.dispatchEvent("cf-queue-change")` CustomEvent(같은 탭) 동시 발사. `subscribeQueueChange`가 둘 다 구독.

#### 3. Dead-letter 별도 store
schema/권한 에러로 retries=3 도달한 항목을 큐에서 분리하지 않으면 5초 interval마다 PB에 실패 요청이 영원히 감. → IndexedDB 키 `dead:v1`로 분리. 배지가 dead 카운트를 별도 표시 (danger 톤), 클릭 시 수동 재시도(현재는 큐 flush만 트리거, dead 자체 재시도는 v1.1).

#### 4. PB v0.22 client_id 충돌 응답 구조
ClientResponseError의 `err.data` 구조가 한 단계 깊은 형태(`{ code, message, data: { client_id: {...} } }`)도 있어 outer + inner 둘 다 탐색해야 충돌을 정확히 감지.

#### 5. 명시적 invalidate 키
flushQueue 결과에 `succeededCollections: SupportedCollection[]` 포함 → hook이 해당 collection key만 `qc.invalidateQueries({ queryKey: [col] })`. 전역 invalidate보다 명시적이고 향후 query 추가 시 부작용 회피.

#### 6. fake record와 onSuccess 호출 측 정합성
오프라인/네트워크 에러 시 `id: ""`인 fake record 리턴. 모든 호출 측(hangboard/climbing/strength/campus) onSuccess가 `rec.session_id`만 사용 + `qc.invalidateQueries`만 호출 → fake record 정상 동작.

### 다음 Story에 영향 줄 컨텍스트
- Phase 2 완료. Phase 3 (배포)에 진입할 준비. STORIES S13 (서버 인프라) → S14 (백업) → S15 (Cloudflare Pages 배포).
- S12의 큐 패턴은 v1.1 세션 mutation 큐화 시 reference (client_id ↔ server id 매핑 layer 필요).
- 오프라인 인풋 시 fake record id="" 가정이 깨지는 호출 측 발생 시 별도 처리 필요.

### 미해결 follow-up
- **세션 create/end 큐 적용**: client_id ↔ server id 매핑 layer 추가. v1.1.
- **Dead-letter 수동 관리 UI**: 항목별 폐기/재시도 화면. v1.1.
- **충돌 응답 구조 변경 대비**: PB v0.23+ 업그레이드 시 isClientIdConflict 재검증.
- **navigator.onLine false negative**: Captive Portal 등에서 실패 fallback은 catch에서 처리 중이지만 사용자에게 명확한 신호 부재. v1.1.
- **flush 중 collection별 rate limiting**: 큐가 길어진 후 동기화 시 PB에 burst — 현재는 순차 await로 자연 throttle.

### 브라우저 검증 (Comet MCP 미연결 — 사용자 직접 수행)
빌드 15/15 정적, TypeScript 통과. (dev 서버가 새 idb-keyval 의존성 못 보면 500 → 재시작 필요.) 사용자 인터랙티브 검증:
1. `cd web && pnpm dev` 재시작.
2. 로그인 → 세션 시작 → 행보드/등반/근력 모듈에서 기록 추가 (정상 저장 확인).
3. DevTools Network 탭에서 "Offline" 토글.
4. 모듈에서 기록 추가 → 상단에 "오프라인 · 저장 대기 N" 배지 노출 확인.
5. Network 다시 Online → 배지 "동기화 중" → 사라짐. PB admin UI에서 row 도착 확인.
6. 다중 row 입력 후 오프라인 → 복구 동기화 → FIFO 순서로 PB에 도착.
7. (선택) DevTools Application → IndexedDB → `cf-mutation-queue` store에 `queue:v1` 직접 확인.
8. 검증 결과를 본 history에 ✅ 한 줄 추가.

---

## Phase 2 follow-up — 2026-06-17 (commit 54991d6)

사용자 피드백 반영. Story 사이클 외 패치.

### 1. BottomNav 자동 activeId + layout 마운트
**문제:** 세션 모듈 페이지(`/sessions/new`, `/sessions/active`, `/sessions/active/{hangboard,climbing,strength}`)에 BottomNav가 없어 다른 탭(기록/분석/설정)으로 이동 불가.

**변경:**
- `web/src/components/bottom-nav.tsx` — `"use client"` + `usePathname()` 기반 자동 `activeId` 매칭. `/logs` → logs, `/analysis` → analysis, `/settings` → settings, 그 외(`/`, `/sessions/*`) → today.
- `web/src/app/(protected)/layout.tsx` — `<BottomNav />`를 layout에 한 번만 마운트. 모든 보호 라우트에 자동 표시.
- 각 페이지(`(protected)/page.tsx`, `logs/page.tsx`, `analysis/page.tsx`, `settings/page.tsx`)에서 명시적 `<BottomNav activeId="x" />` 호출 제거.
- `dev/components/page.tsx`, `dev/pb-check/page.tsx`에서 `<BottomNav />` 인자 제거 (이전 시그니처 호환).

**트레이드오프:**
- 풀스크린 행보드 타이머는 `fixed inset-0 z-50`라 BottomNav(z-40)를 자동 가림 — 의도 동작.
- 타이머 동작 중 탭 이동 시 머신 state + Wake Lock 손실. confirm 없이 즉시 navigation — 사용자 요청에 따른 의도. v1.1에서 unsaved 경고 추가 검토.

### 2. climbing/strength/campus 기록 row 삭제
**문제:** 누적 list에 추가된 row를 잘못 입력해도 삭제할 방법이 없음.

**변경:**
- `web/src/lib/climbing.ts`, `strength.ts`, `campus.ts` — 각각 `useDeleteXLog` mutation 추가.
  - PB `pb.collection(X).delete(id)` 직접 호출 (delete는 멱등하지 않아 큐 적용 안 함 — v1.1).
  - `onSuccess`에서 `qc.invalidateQueries({ queryKey: xKeys.all })`로 list 갱신.
- `(protected)/sessions/active/{climbing,strength}/page.tsx` — 누적 list row에 인라인 `Trash2` 아이콘 버튼 추가.
  - `window.confirm("이 기록을 삭제할까요?")`로 확인 후 mutate.
  - `aria-label`에 row 식별자 포함, `disabled={del.isPending}`.
  - 휴지통 호버 시 `text-status-danger`로 경고 톤.

**트레이드오프:**
- `window.confirm`은 native dialog로 모바일에서 잘 작동하지만 styled 아님. shadcn AlertDialog 도입은 over-engineering이라 보수적 선택.
- delete는 큐 적용 안 함 → 오프라인에서 삭제 시도 시 mutation 에러. UX 측면은 `onError`로 잡지만 사용자에게 toast 없음 — v1.1.
- 행보드는 누적 list가 없어 (한 세션 = 한 hangboard_logs row) 삭제 UI 없음. logs 페이지(v1.0+) 또는 PB admin UI에서 처리.

### Comet MCP 상태
사용자 요청대로 `~/.claude/settings.json` + `settings.local.json` 점검. Comet 브라우저 MCP 서버는 두 설정 어디에도 등록되어 있지 않음 (Atlassian/Gmail/Calendar/Drive만 등록). Claude Code (CLI) 환경에서 Comet을 호출하려면 별도 MCP server 등록 필요. follow-up.

### 검증
빌드 15/15 통과. 사용자 인터랙티브 확인:
1. dev 서버 재시작 후 보호 라우트 전반에서 BottomNav 표시 확인.
2. 세션 진입 후 BottomNav로 다른 탭 이동 → 다시 세션으로 복귀 (활성 ID 유지).
3. 풀스크린 타이머 중에는 BottomNav 가려짐 확인.
4. climbing/strength/campus에서 row 입력 → 휴지통 → confirm → list 즉시 갱신 + PB row 삭제 확인.

---

## S19 — 2026-06-17 (commit <pending>)

### 배경
S08-S12에서 BottomNav "기록" 탭만 만들고 `/logs` 페이지 본체는 placeholder로 남겨두었음. S15 직후 사용자가 브라우저에서 보면서 발견. S08 history follow-up에 명시했던 항목을 새 Story로 정의 + 즉시 진행.

### 변경 파일 요약
- `web/src/lib/sessions.ts` — `SessionListFilter` 타입 + `useSessionList(filter)` (PB filter 파라미터 바인딩 + KST `+09:00` offset) + `useDeleteSession` (sessions + 4개 child collection list invalidate + 활성 세션 cleanup).
- `web/src/lib/hangboard.ts` — `useHangboardLogsForSession` + `useDeleteHangboardLog` 추가 (다른 모듈에는 이미 있음).
- `web/src/app/(protected)/logs/page.tsx` *(신규 본체)* — 필터(날짜 범위/장소/타깃) + 페이지네이션("더 보기", 누적 표시) + 세션 list row(메타 + 진행 중 배지 + 휴지통) + 빈 상태 분기(필터 활성 vs 전체).
- `web/src/app/(protected)/logs/detail/page.tsx` *(신규)* — Suspense + useSearchParams로 id 추출 + 세션 메타 + child rows 4종 그루핑(hangboard/climbing/strength/campus) + 개별 row 휴지통 + 세션 cascade 삭제 버튼.
- `docs/STORIES.md` — S19 신규 + ✅ Done.
- `docs/review/phase-2.md` — S19 self-review append.

### 주요 의사결정·트레이드오프

#### 1. 활성 세션도 같은 list에 표시
별도 섹션 분리 vs 같은 list에 "진행 중" 배지. 단일 사용자 + 최대 1개 활성이라 같은 list 최상단(date desc)에 배지로 구분이 직관.

#### 2. Static export 호환 — `/logs/detail?id=<id>`
`/logs/[id]` dynamic route는 build-time params 필요 → query parameter 패턴. `useSearchParams()`는 Next 16 + static export에서 Suspense boundary 필수.

#### 3. 필터 — draft/query state 분리
debounce 도입 회피. 사용자가 "검색" 버튼 명시적 누름 → query 갱신. 모바일 키보드 + 한 손 조작에 자연.

#### 4. 페이지네이션 — 누적 표시
"더 보기"가 직관적이려면 items 누적이어야 함 (페이지 단위 교체는 라벨/UX 부조화). `accumulated` state + id 중복 제거 + 삭제 시 즉시 제거.

#### 5. KST 경계 처리
PB `date` 필드는 UTC datetime. 사용자는 KST yyyy-mm-dd 입력. `${dateFrom} 00:00:00.000+09:00` / `${dateTo} 23:59:59.999+09:00`로 PB filter에 명시적 offset → KST 00–9시 세션 누락 없음.

#### 6. cascade-delete 활용
PB schema가 sessions → 4개 child collection에 `cascadeDelete: true` 적용 (S06). 세션 삭제 시 PB가 자동으로 child rows 정리 → 클라이언트는 sessions delete 1회만 호출.

### 검증
- `pnpm build` 16/16 static pages (이전 15 + `/logs/detail`).
- `pnpm smoke` 모든 단계 OK. a03-logs h1="기록" 200.
- 시각 확인 (활성 세션 + 본인 운영 세션이 있는 상태):
  - 필터 UI 4개 정상 표시.
  - "진행 중" 배지가 활성 세션 옆에.
  - 사용자 본인 세션 (더클 사당/서볼 선유 등) list에 표시.
  - 휴지통 아이콘 행 끝에 정렬.
  - BottomNav "기록" 탭 brand 색 active.

### 사용자 위임
- `/logs/detail/?id=<id>` 진입 + child rows 시각 확인 (활성 세션의 row 입력 → 진입 → 표시 확인).
- 세션 cascade 삭제 후 다른 페이지 갱신 확인.
- 필터 날짜 경계값 시나리오 (KST 00–9시 세션 포함 여부).
