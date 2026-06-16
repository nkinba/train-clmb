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

---

## S09 — 2026-06-17

### Subagent (general-purpose) 원문

종합 평가: **accept-with-fixes** — 핵심 로직(상태머신·wall-clock tick·페이즈 신호 발사)은 견고하지만, 알림 권한 흐름·`abort` 시 의도하지 않은 완료 신호·`actual_hang_seconds` 의미 불일치 등 사용자 영향 있는 이슈 다수.

#### 🔴 Critical
- `web/src/app/(protected)/sessions/active/hangboard/page.tsx` 페이즈 신호 effect — `abort` 디스패치 후에도 `done` 분기로 진입해 "세션 완료" 비프·진동·알림 발사. `aborted` 마커 도입 권장.
- `onStart` Notification 권한 자동 요청 — `await audio.unlock()` 뒤 호출이라 iOS Safari 사용자 제스처 문맥 소실 가능. setup 화면의 명시적 권한 요청 버튼만 남길 것.
- `total_sets`/`actual_hang_seconds` 의미 — `total_sets: completedCount(state)`는 abort 시 작아지고, `actual_hang_seconds`는 무조건 target과 같음. 리뷰어는 `setup.config.totalSets` 권장.

#### 🟡 Suggested
- 결과 prompt overlay가 rest 카운트다운 가림 — prompt 안에 rest 남은 시간 표시 등 옵션.
- `useAudioBeep`의 silent fail 신호 부재 — `ready: boolean` 노출.
- RAF 60Hz tick은 배터리 낭비 — 100ms interval 충분.
- `abort` 액션이 `Date.now()`를 reducer 내부에서 호출 — 순수성 손상.
- `useWakeLock`의 enabled 토글 시 in-flight acquire/release 미세 race (한 사이클 안에서는 안전).
- `audio`/`phaseNotif` 반환 객체 매 렌더 새로 — useMemo 안정화 권장.
- `prevPhaseRef` 초기값을 명시적 `"idle"`로.
- `rpe?: number`가 `undefined`일 때 PB 직렬화 동작 — 명시적 분기 권장.

#### 🟢 Nit
- `phaseBg` 3분기가 모두 `bg-canvas` — 죽은 코드.
- `actual_hang_seconds` v1.1 트래킹을 history에 기록.
- `Pause` 아이콘이 `onAbort` 핸들러에 — 시맨틱 mismatch, `Square` 권장.
- 결과 토글 사이클이 단방향.
- 매 렌더 `Date.now()` 호출은 무해.
- dev에서 SW 미등록.

#### 합격 항목 요약
- 상태머신 순수성 + wall-clock 비교 → 백그라운드 throttle/시간 변경에 강건.
- `Math.ceil(remainingMs/1000)` + `now >= phaseEndAt` 조건으로 마지막 hang 초 손실 없음.
- `prevPhaseRef` 가드로 페이즈 신호 정확히 1회.
- iOS-PWA SW notification 경로 + inline 폴백.
- `document.hidden`일 때만 OS notification 발사.
- Wake Lock visibilitychange 자동 재요청.
- 세션 ID 가드.
- 모바일 UX 토큰 (`h-tap-hero`, `tabular-nums`, safe-area).
- route-level code-split.
- 알림 본문에 PII 없음.

### 본인 수용/반박 판단

| 항목 | 결정 | 사유 |
| --- | --- | --- |
| 🔴 abort 후 done 신호 분기 | **수용** | `TimerState.aborted` 마커 추가, effect에서 `cur === "done" && !state.aborted`일 때만 완료 신호. |
| 🔴 Notification 권한 onStart 자동 요청 제거 | **수용** | setup 화면의 명시적 버튼만 사용. iOS Safari 사용자 제스처 문맥 소실 회피. |
| 🔴 `total_sets: setup.config.totalSets` 권장 | **반박** | PRD §5 성공 지표 "주간 행보드 총 매달리기 초"는 실제로 시도한 세트만 카운트해야 정확. abort 시 안 한 세트가 볼륨에 잡히면 데이터 왜곡. `completedCount(state)` 유지 + 의도 주석 강화. |
| 🟡 결과 prompt overlay에 rest 남은 시간 표시 | **수용** | 옵션 3 (prompt 안에 작은 카운트다운). 휴식이 자동으로 흘러간다는 사실을 사용자에게 명시. |
| 🟡 `useAudioBeep.ready` 노출 | **수용** | hook 자체에 노출. 노출만 하고 UI 분기는 follow-up. |
| 🟡 RAF → 100ms interval | **수용** | 디스플레이는 초 단위라 10Hz로 충분. 배터리 절약. |
| 🟡 `abort` 액션 `now` 파라미터 | **수용** | 순수성 복원. |
| 🟡 wake lock micro-race | **반박/follow-up** | 한 사이클 안에서 cleanup가 cancelled 플래그를 set하므로 실 영향 없음. 향후 동시 사용 패턴이 발견되면 보강. |
| 🟡 `audio`/`phaseNotif` useMemo 안정화 | **수용** | hook 반환을 useMemo로 감싸 호출 측 useEffect 재발사 제거. |
| 🟡 `prevPhaseRef` 초기값 `"idle"` 명시 | **수용** | 의도 명확화. |
| 🟡 `rpe?: number` 명시적 분기 | **수용** | payload 생성 시 `rpe != null`일 때만 키 추가. |
| 🟢 `phaseBg` 죽은 코드 단순화 | **수용** | |
| 🟢 v1.1 트래킹 (actual_hang_seconds 세트별) | **수용** | history follow-up에 기록. |
| 🟢 `Pause` → `Square` 아이콘 | **수용** | 시맨틱 일치. |
| 🟢 결과 토글 단방향 | **반박** | 빠른 순환 OK, 모바일 UX 트레이드오프. |
| 🟢 dev SW 등록 | **반박** | 범위 밖. production 동작 검증은 사용자 디바이스에서. |

---

## S10 — 2026-06-17

### Subagent (general-purpose) 원문

종합 평가: **accept-with-fixes (Critical 없음)** — Acceptance criteria(한 손 입력 / DB row 저장) 충족, PRD §3과 일관. PB filter raw 인터폴레이션은 인젝션 위험 0에 가깝지만 SDK가 제공하는 `pb.filter()` 바인딩을 디폴트로.

#### 🟡 Suggested
- `web/src/lib/climbing.ts:48` raw template literal → `pb.filter("session_id = {:sid}", { sid })`. S11/이후 reference.
- `web/src/lib/climbing.ts:86-96` Lead 그레이드 범위 — STORIES "5.10D~5.12A" / PRD §3 "5.10D~5.11A" vs 구현 5.10a~5.12a(9개). 의도 확장 여부 확인.
- `web/src/components/climbing/rest-timer.tsx:32-37` Beep 후 `0:00` 100ms 잔존. onStart에서 `setRemaining(defaultSec)` 명시.
- `web/src/app/(protected)/sessions/active/climbing/page.tsx:115-140` 모드 토글 roving tabindex 누락.

#### 🟢 Nit
- RestTimer `onReset`이 `audio.unlock()` 누락 — helper로 통합.
- 초기 `grade = "V4"` magic literal → `gradesFor()[0]`.
- queryKey null 분기 단순화.
- `row.rpe` truthy → `!= null` 명시.
- Lead 9개 grid-cols-3 thumb-reach — 실 디바이스 확인 권장.

#### 합격 항목
- `is_send` Lead 강제 false + UI 숨김 + 모드 전환 시 리셋.
- `project_name` 빈값 키 제거 → PB schema default 활용.
- `client_id` 멱등 키 (ADR-4 대비).
- 캐시 무효화 → 저장 후 list refetch.
- 48dp+ 터치 타겟, GradePicker roving tabindex + radio ARIA.
- RPE optional, notes/project_name 옵션.
- useAudioBeep 메모화 → useEffect deps 안정.
- 한 번만 발화 firedRef.
- 404/세션 가드 + SSR-safe.
- aria-live="off" 타이머.
- 부분 리셋 (attempts/isSend/notes/rpe만) — 같은 프로젝트 반복 시도 워크플로우.

### 본인 수용/반박 판단

| 항목 | 결정 | 사유 |
| --- | --- | --- |
| 🟡 `pb.filter()` 바인딩 | **수용** | 인젝션 디폴트 안전성, S11/이후 코드 reference. |
| 🟡 Lead 그레이드 범위 | **반박 (doc drift)** | 5.10a부터 시작은 워밍업 기록 유연성 위해 의도. PRD/STORIES의 "5.10D~"는 타깃 진척 측정 범위 의미로 해석. drift는 history에 명시. |
| 🟡 RestTimer 0:00 잔존 | **수용** | onStart에서 `setRemaining(defaultSec)` 추가. |
| 🟡 모드 토글 roving tabindex | **수용** | |
| 🟢 RestTimer onReset unlock | **수용** | `startFresh` helper로 통합. |
| 🟢 초기 grade magic literal | **수용** | `gradesFor("Bouldering")[0]`. |
| 🟢 queryKey null 분기 | **수용** | `enabled`만으로 충분. |
| 🟢 `row.rpe != null` | **수용** | |
| 🟢 Lead thumb-reach | **사용자 위임** | 실 디바이스 검증 가이드에 포함. |
