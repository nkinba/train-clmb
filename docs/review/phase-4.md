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
