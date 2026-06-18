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

---

## S11 — 2026-06-17

### Subagent (general-purpose) 원문

종합 평가: **accept-with-fixes (Critical 없음)** — S10 패턴 재사용 깔끔, PB 스키마와 enum 정합성·검증·빈 값 키 제거 모두 적절.

#### 🟡 Suggested
- 모드 토글 시 sub-form 마운트/언마운트로 입력 손실 — hidden 토글 권장.
- `row.rpe > 0` 가드는 schema min:1 + payload 키 제거로 데드 코드.
- `added_weight_kg` schema min:-100 vs UI stepper min:-50 비대칭.
- `movements` trim 일관성.

#### 🟢 Nit
- preset grid + 전체 폼이 iPhone 14 한 화면 초과 (스크롤 필요).
- preset 영어 라벨.
- 초기 Pull-up 선택 시각적 강조 확인.

#### 합격 항목
- enum values 코드↔migration 일치.
- `pb.filter()` 바인딩.
- 빈 rpe/movements 키 제거.
- success_sets > total_sets 클라이언트 검증.
- client_id 멱등 키.
- 종목/세트/반복 유지 + weight/rpe만 리셋 → 5종목 60초 흐름 의도.
- custom 입력 trim.
- 모드 토글 radiogroup ARIA 정확.

### 본인 수용/반박 판단

| 항목 | 결정 | 사유 |
| --- | --- | --- |
| 🟡 모드 전환 입력 손실 → hidden 토글 | **수용** | 60초 흐름 신뢰성. |
| 🟡 `row.rpe > 0` 데드 코드 | **수용** | `!= null`로 단순화. |
| 🟡 `added_weight_kg` min 비대칭 | **반박** | UI는 실용 범위(-50), schema 허용은 보수적(-100). 의도된 분리. |
| 🟡 `movements` trim 일관성 | **반박** | 작은 nit, 실 동작 OK. |
| 🟢 preset 한 화면 초과 | **사용자 위임** | 모바일 스크롤 흐름 OK. |
| 🟢 preset 영어 라벨 | **유지** | 국제 명칭. |

---

## S12 — 2026-06-17

### Subagent (general-purpose) 원문

종합 평가: **accept-with-fixes** — client_id 멱등 재전송과 BroadcastChannel 탭 sync까지 깔끔히 설계되어 있으나 enqueue 직후 자동 flush 신호 끊김(BroadcastChannel는 same-tab post 무시)과 dead-letter rotation 무한 재시도가 critical.

#### 🔴 Critical
- `use-queue-status.ts:42` — BroadcastChannel이 같은 탭으로 메시지 전달 안 됨 → enqueue 직후 length state 갱신/flush 트리거 누락.
- `mutation-queue.ts:208-216` — dead-letter rotation + break 조합이 무한 retry 루프. retries>=3 가드 부재로 5초마다 schema 에러 항목이 재시도.

#### 🟡 Suggested
- `isClientIdConflict` PB v0.22 응답 구조 (data.data.client_id) 한 단계 깊이 탐색 누락.
- BroadcastChannel module-level 재사용 권장.
- `qc.invalidateQueries()` 인자 없음 — 명시적 키 권장.
- `enqueue` 직후 명시적 same-tab 신호 (CustomEvent).
- `navigator.onLine` false negative 주석.
- flush 중 offline 전환 가드 — 현 상태 OK.

#### 🟢 Nit
- `makeFakeRecord` JSDoc 추가.
- 색 토큰 inline ternary OK.
- `flushNow` void OK.
- queue item id가 client_id generator 재사용 — 의도 명확화 권장.

#### 추가 점검
- `web/package.json`에 `idb-keyval` 의존성 누락 확인 → root에만 설치된 상태였음.

### 본인 수용/반박 판단

| 항목 | 결정 | 사유 |
| --- | --- | --- |
| 🔴 Same-tab flush 신호 끊김 | **수용** | window CustomEvent `cf-queue-change` 발사 + subscribeQueueChange가 같이 구독. BroadcastChannel은 module-level 재사용으로 통합. |
| 🔴 dead-letter 무한 retry | **수용** | dead-letter를 별도 IndexedDB 키(`dead:v1`)로 분리. flush 시 retries>=MAX_RETRIES 항목은 큐 진입 시 dead로 이동. 배지가 dead 카운트 별도 표시 + 클릭 시 재시도 가능. |
| 🟡 PB conflict 응답 구조 | **수용** | 한 단계 + 두 단계 client_id 키 모두 확인. |
| 🟡 BroadcastChannel module-level 재사용 | **수용** | `getChannel()` 헬퍼로 통합. |
| 🟡 명시적 invalidate 키 | **수용** | flushQueue 결과에 succeededCollections 추가 → hook이 해당 collection만 invalidate. |
| 🟡 enqueue 직후 신호 | **수용** | Critical 1과 같이 처리. |
| 🟡 navigator.onLine 주석 | **수용** | queuedCreate JSDoc에 명시. |
| 🟡 flush 중 offline 가드 | **반박** | isNetworkLike catch에서 break하므로 동작 OK. |
| 🟢 makeFakeRecord JSDoc | **수용** | |
| 🟢 queue item id 분리 | **수용 (코멘트)** | 의도 주석 추가. |
| 추가: package.json idb-keyval | **수용** | `cd web && pnpm add idb-keyval` 재실행으로 정식 등록. |

---

## S19 — 2026-06-17

### Subagent (general-purpose) 원문

종합 평가: **accept-with-fixes** — Acceptance Criteria 충족 + cascade-delete 검증 OK. 날짜 필터 KST 경계 + "더 보기" 누적 표시 / fallback 스타일 등 작은 다듬기. Critical 없음.

#### 🟡 Suggested
- **S1.** `sessions.ts:135-143` 날짜 필터 KST 경계: `dateFrom`이 UTC 00:00로 해석되어 KST 09:00 이전 새벽 세션 누락. ISO offset `+09:00`로 변환.
- **S2.** 동시 삭제 disabled — 현 구조 OK.
- **S3.** `detail/page.tsx` Suspense fallback `mx-auto/max-w-md/pb-tab-bar` 누락.
- **S4.** 빈 상태 메시지 "조건 없음 vs 전체 비어있음" 구분.
- **S5.** `/logs/detail/?id=` 후행 슬래시 + query 패턴 — 의식적이면 OK.

#### 🟢 Nit
- N6. `isFetching` opacity 처리 안 함.
- N7. **"더 보기"가 페이지 단위 교체 — 사용자 예상은 누적**.
- N8. `formatDate` 중복 정의 (YAGNI).
- N9. "진행 중"/"진행 중인 세션" 텍스트 불일치.

#### 합격 항목
- PB cascade-delete 마이그레이션 검증 (4 child collection 모두 `cascadeDelete: true`).
- `pb.filter()` 파라미터 바인딩 인젝션 회피.
- invalidateQueries 키 prefix 정확.
- Suspense + useSearchParams Next 16 static export 호환.
- id null guard.
- 세션 삭제 후 router.replace + 활성 세션 정리.
- 모바일 터치 타겟 + 진행 중 배지 + 종료 전 라벨.
- confirm 두 단계 (세션/row).
- del.isPending disabled.
- 빈 상태/에러/loading 세 분기.
- BottomNav padding.

### 본인 수용/반박 판단

| 항목 | 결정 | 사유 |
| --- | --- | --- |
| 🟡 S1 KST 경계 | **수용** | `+09:00` ISO offset으로 PB filter 정확. |
| 🟡 S2 동시 삭제 | **반박** | 현 구조 OK. |
| 🟡 S3 Suspense fallback 스타일 | **수용** | main 클래스 통일. |
| 🟡 S4 빈 상태 분기 | **수용** | isFilterActive 분기. |
| 🟡 S5 후행 슬래시 | **유지** | smoke 통과 + Caddy file_server 호환. |
| 🟢 N6 isFetching opacity | **반박** | nit. |
| 🟢 **N7 "더 보기" 누적** | **수용** | `accumulated` state로 누적 표시 + id 중복 제거 + 삭제 후 즉시 제거. |
| 🟢 N8 formatDate 중복 | **반박** | YAGNI. |
| 🟢 N9 "진행 중" 텍스트 통일 | **수용** | "진행 중"으로. |

---

## S20 — 2026-06-17

### Subagent (general-purpose) 원문 요약

리뷰 결과 — Acceptance Criteria 5개 중 4개 ✅, 1개 ⚠️.

| 항목 | 결과 |
|---|---|
| 폼 진입 시 prebuilt + 아이콘 | ✅ `PickerCore` mount `mode="preset"` + 카테고리 헤더 아이콘 |
| 검색 즉시 필터 | ✅ `filteredPresets` reactive |
| "직접 입력" 토글 → text input | ✅ Mode 상태 + autoFocus |
| MRU 누적 노출 | ✅ `pushMru` 후 mount당 1회 `getMru` |
| 48dp+ 터치 타겟 | ⚠️ 토글 버튼만 미달 |

#### Valid issues
1. `picker.tsx:94-112` "직접 입력" 토글 버튼 `py-1 text-micro` → 약 30px. **48dp 미달**.
2. `picker.tsx:248,269` `as LocationPreset[]` / `as TargetPreset[]` cast 불필요 — no-op.

#### Nits / 검토 사항
3. `LOCATION_ICON` / `TARGET_ICON`을 `lib/picker-presets.ts`로 옮겨 SSoT — suggestion.
4. `MAX_ITEMS = 6` 매직 넘버, prebuilt 22+23개 번들 영향 미미, lucide named import tree-shake OK.
5. SSR guard (`typeof window === "undefined"`) + JSON.parse 안전 fallback + QuotaExceeded catch + trim 통과 모두 ✅.

### 본인 판단

| 항목 | 결정 | 이유 |
|---|---|---|
| 🔴 1 토글 버튼 48dp | **수용** | Acceptance Criteria 직접 위반. `min-h-tap` + `px-3`. |
| 🟢 2 `as` cast 제거 | **수용** | 시그널 명확. 타입 추론으로 충분. |
| 🟡 3 아이콘 lib로 이동 | **반박** | 아이콘은 presentation layer. presets는 데이터. lib에 lucide-react 의존이 끌려오는 게 worse trade-off. |
| 🟢 4-5 nits | 정보 | 변경 없음. |

---

## S22 — 2026-06-18

### Subagent (general-purpose) 원문 요약

| 항목 | 결과 |
|---|---|
| 22+23 레코드 시드 | ✅ SQLite 직접 조회로 확인 |
| /sessions/new 진입 시 PB chip | ✅ useGyms/useTargets → presets prop |
| 비인증 401 / 인증 200 | ✅ listRule `@request.auth.id != ''` |
| 로딩 skeleton / 에러 fallback | ✅ presets.length===0 가드 + 분기 |
| 기존 acceptance (검색/직접입력/MRU/48dp) 회귀 없음 | ✅ |

#### Valid issues
1. **`gyms.ts/targets.ts` useQuery 옵션 누락** — `retry:3` 기본값이 401 시 4번 호출. `retry:1`, `refetchOnWindowFocus:false` 권장. 공용 상수 분리 제안.
2. **down 마이그레이션 throw** — `findCollectionByNameOrId`가 not found 시 throw. 가드가 throw 뒤로 가서 무효. try/catch 필요.
3. **isError + AuthGuard redirect 깜빡임** — 401 시 fallback 메시지가 잠깐 보임. (1번 픽스로 완화)

#### Nits
4. `presets.length === 0` 가드 의도 주석 권장.
5. PB `expand`/system 필드 타입 보강 (cosmetic).
6. 카테고리 라벨(lib) + 아이콘(component) 분산은 책임 분리라 OK.

### 본인 판단

| 항목 | 결정 | 이유 |
|---|---|---|
| 🔴 1 retry/refetch 옵션 | **수용** | 401 4번 호출 회피. 공용 상수는 hook 2개라 YAGNI — 직접 박음. |
| 🔴 2 down 마이그레이션 try/catch | **수용** | 부분 적용 rollback 안전. |
| 🟡 3 깜빡임 분기 | **반박** | 1번 픽스로 1회만 호출 → afterSend redirect 즉시. 별도 분기는 over-engineering. |
| 🟢 4 가드 주석 | **수용** | 다음 사람의 풀어버림 방지. |
| 🟢 5-6 nits | 정보 | 변경 없음. |
