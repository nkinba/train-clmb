# Phase 4 — Review

## S18-B — 2026-06-19

### Subagent (general-purpose) 요약

Acceptance Criteria 2건 모두 ✅ (단, #2의 "403" 문구는 PB 관례상 200+empty와 차이 — STORIES note 추가).

#### Valid issues
1. **빈 토큰 race** (`media.ts:111`) — `if (token)` 통과해도 빈 문자열 setRequestHeader. authStore.clear() 직후 race 가능.
2. **XHR timeout 미처리** — 모바일 셀룰러 50MB 영상 업로드 시 무한 대기. `xhr.timeout` + ontimeout 권장.
3. **`mediaFileUrl` 미사용 export** — 본 cycle엔 호출처 없음 + viewRule auth 때문에 토큰 없는 URL은 403. S18-C에서 적절한 토큰 포함 형태로 재설계 권장.
4. **note max 500 vs 다른 컬렉션 2000** — 의도 명확화 필요.
5. **클라이언트 사전 file size 검증 누락** — 60MB 영상 99% 가서 실패하는 UX. onChange에서 50MB 가드 권장.
6. **에러 후 다시 선택 시 progress reset** — nit.

#### Nits
- `sheetRef` 미사용 → 제거.
- `<track kind="captions">` 빈 track — a11y linter 만족용, 의도 유지.
- 마이그레이션 down `try/catch` vs initial schema의 `if (c)` 가드 스타일 차이.
- `getFullList` paging 가드 없음 — 도메인상 OK.

### 본인 판단

| 항목 | 결정 | 이유 |
|---|---|---|
| 🔴 1 빈 토큰 가드 | **수용** | 1줄 가드로 race 회피 + AuthGuard 흐름으로 빠짐. |
| 🔴 2 XHR timeout | **수용** | 5분 timeout + `timeout` 이벤트 핸들러. |
| 🔴 3 mediaFileUrl 제거 | **수용** | YAGNI — 본 cycle 미사용. S18-C에서 토큰 포함 형태로 재설계. |
| 🟡 4 note max 500 | **반박** | 의도된 분리 — 미디어 캡션은 짧게 (장문은 세션 notes). |
| 🔴 5 사전 file size 50MB | **수용** | onChange에서 가드 + 에러 표시. |
| 🟢 6 progress reset nit | **반박** | onSubmit 진입에서 setProgress(0)이라 무해. |
| 🟢 nit sheetRef 제거 | **수용** | dead code. |
| 🟢 nit down try/catch 스타일 | **반박** | partial-apply rollback 안전 의도. 스타일 차이 OK. |
| 🟢 listRule 200/403 문구 | **수용** | STORIES Acceptance 문구 갱신 (PB 관례 명시). |

---

## S18-C — 2026-06-19

### Subagent (general-purpose) 원문 요약

Acceptance Criteria 2건 모두 ✅. Valid issue 5건 (3건 본 cycle 수용, 2건 follow-up).

#### Valid issues
1. **V1** `useFileToken` `enabled: pb.authStore.isValid` 비반응성 — getter라 React 변화 감지 불가.
2. **V2** 토큰 만료 시 lightbox `<video>` mid-stream 끊김 — 4분 refetch는 캐시 갱신만, 진행 중 range request의 token은 만료.
3. **V3** `MediaGrid` 영상 셀이 원본 풀 다운로드 위험 — `preload="metadata"`도 모바일에서 첫 키프레임 받음.
4. **V4** lightbox 삭제 2-step (1탭 "삭제" → 2탭 "정말 삭제") 의도치 않은 더블탭 위험. `/logs/detail`의 `window.confirm`과 일관성 깨짐.
5. **V5** `useFileToken` invalidation 부재 — logout/relogin race.

#### Nits
- `mediaKeys.bySession` helper 사용 안 함 (`useSessionMedia`가 직접 키 구성).
- `aria-label="영상 재생"` 부정확 (실제는 lightbox 열기).
- BottomNav 5탭 cell에서 라벨 줄바꿈 가능 — `whitespace-nowrap`.
- `autoPlay+playsInline+controls` 조합 — 사용자 제스처 직후라 iOS Safari OK.

### 본인 판단

| 항목 | 결정 | 이유 |
|---|---|---|
| 🔴 V1 enabled 제거 | **수용** | AuthGuard가 라우트 레벨 보호. 한 줄 제거. |
| 🟡 V2 token mid-stream | **반박/follow-up** | 1인 30초 영상에선 immediate 영향 작음. v1.1에서 PB token TTL 또는 mid-stream 처리. |
| 🟡 V3 썸네일 없음 | **반박/follow-up** | v1.0 누적 작음. 50개+ 시 thumb 도입. |
| 🔴 V4 삭제 confirm 통일 | **수용** | `window.confirm`으로 단순화 — /logs/detail와 동일 UX. |
| 🟢 V5 token invalidate | **반박** | 1인 앱 logout-relogin race trivial. |
| 🟢 nit mediaKeys helper | **수용** | 일관성. |
| 🟢 nit aria-label | **수용** | 정확. |
| 🟢 nit whitespace-nowrap | **수용** | 안전. |
