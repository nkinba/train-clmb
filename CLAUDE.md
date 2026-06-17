# Climb-Forge — Claude Code 지침

모바일 우선 클라이밍 트레이닝 트래커. 자세한 제품/아키텍처 컨텍스트는 `docs/PRD.md`, `docs/ADR.md` 참고. 구현 단위는 `docs/STORIES.md`.

## Story 워크플로우 (구현 → 리뷰 → 수정 → 커밋)

각 Story는 다음 4단계를 1 사이클로 처리한다. 사용자가 "S0X 진행"이라고 말하면 즉시 시작한다.

### 1. 구현
- `docs/STORIES.md`에서 해당 Story의 Goal·Dependencies·Tasks·Acceptance Criteria를 먼저 읽는다.
- 의존 Story가 ✅ 상태인지 확인. 미충족이면 사용자에게 보고 후 중단.
- `STORIES.md`의 상태를 `🔄 In Progress`로 갱신하고 작업 시작.
- Task 단위로 코드를 작성한다. 범위 밖 리팩토링·추상화·미래 확장은 추가하지 않는다 (시스템 프롬프트의 YAGNI 원칙 준수).
- UI 변경이 있으면 dev 서버를 띄우고 **chrome-devtools MCP**로 직접 확인 (아래 "브라우저 검증" 절 참조).

### 2. 리뷰 (Self-Review)
- 별도 subagent(`general-purpose` 또는 `code-reviewer`)를 `Agent` 도구로 띄워 독립 리뷰를 요청한다.
- 리뷰 prompt에 포함할 것:
  - Story ID와 Acceptance Criteria 전문
  - 변경된 파일 목록 (`git diff --name-only`)
  - 검토 관점: Acceptance Criteria 충족 / 모바일 UX 제약 / 보안 (PocketBase rule, secret 노출) / bundle size 영향
- 리뷰 결과를 받아 본인 판단으로 수용·반박 결정. 모든 지적을 무비판 수용하지 않는다.

### 3. 수정
- 리뷰에서 나온 valid 이슈를 수정한다.
- 수정 후 Acceptance Criteria 체크박스를 직접 한 번 더 검증한다.
- UI 회귀가 의심되면 Comet MCP로 재확인.

### 4. 커밋
- 관련 파일만 명시적으로 stage (`git add <file>` — `git add .` 금지).
- 커밋 메시지 컨벤션:
  ```
  S0X: <짧은 요약>

  - 변경 핵심 1
  - 변경 핵심 2

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  ```
- `docs/STORIES.md`에서 해당 Story 상태를 `✅ Done`으로 갱신하는 커밋은 **같은 커밋에 포함**한다.
- 푸시는 사용자가 명시적으로 요청할 때만.

### 5. 산출물 저장 (Phase 단위 누적)
- **리뷰 파일** — `docs/review/phase-N.md`
  - step 2 (Self-Review) 직후 subagent 결과를 해당 Phase 파일에 append.
  - 항목별 헤더: `## S0X — YYYY-MM-DD` 아래 subagent 원문 + 본인의 수용/반박 판단 기록.
- **히스토리 파일** — `docs/history/phase-N.md`
  - step 4 (커밋) 직후 사이클 종료 보고로 append. 같은 사이클의 마지막 커밋에 포함시켜도 됨.
  - 항목별 헤더: `## S0X — YYYY-MM-DD (commit <short-sha>)`
  - 본문: 변경 파일 요약 / 주요 의사결정·트레이드오프 / 다음 Story에 영향 줄 컨텍스트 / 미해결 follow-up
- 두 디렉토리는 첫 사용 시 자동 생성. 신규 파일은 `# Phase N — Review` / `# Phase N — History` 헤더로 시작.
- Phase 경계는 `docs/STORIES.md`의 구분(`## Phase 0/1/2/3/4`)을 따른다.

### 워크플로우 규칙
- 한 번에 한 Story만 진행한다. 병렬 진행 금지 (1인 사용자 + 작은 컨텍스트).
- Story가 너무 커지면(파일 10개+ 변경 예상) 사용자에게 분할 제안 후 중단한다.
- Acceptance Criteria 중 하나라도 실패하면 `⏸ Blocked` 처리하고 사용자에게 보고.
- 타입체크·테스트 통과만으로 "완료" 보고 금지. 실제 브라우저 검증을 거친 후에만 완료 처리.

## 브라우저 검증

UI/프론트엔드 변경은 두 도구로 검증한다.

### 주: chrome-devtools MCP (인터랙티브 / Story 단위 검증)

- 사용자 scope으로 등록됨 (`~/.claude.json`). 모든 Claude Code 세션에서 자동 가용.
- 모바일 뷰포트(iPhone 14, 390×844)로 설정해 실제 사용 환경을 재현.
- 한 사이클에서 확인할 흐름:
  1. 로컬 dev 서버 (`cd web && pnpm dev`) + PocketBase 컨테이너가 떠 있는지 확인.
  2. `mcp__chrome_devtools__navigate` 로 라우트 진입 → 페이지 상태/스크린샷/콘솔/네트워크 점검.
  3. 인증 필요한 라우트는 `/login`에서 자격증명 입력 → 보호 라우트 진입.
  4. 검증 결과(스크린샷·로그·관찰 사항)를 응답에 요약.

### 보조: `pnpm smoke` (puppeteer / CI·회귀용)

- `web/scripts/smoke.mjs`. 비인증 4개 + (자격증명 있으면) 인증 흐름 + 활성 세션 1개 생성/cleanup.
- 자격증명은 `web/.env.local`의 `CF_TEST_EMAIL` / `CF_TEST_PASSWORD` — **PB users 컬렉션의 일반 user**이지 `_superusers`/admin 자격증명이 아님에 주의.
- 결과: `web/screenshots/*.png` + stdout JSONL.
- 사용 시점:
  - chrome-devtools MCP가 일시적으로 작동 불가일 때 대체 검증.
  - 회귀 확인 (Story 완료 직전 한 번).
  - "추측으로 통과 처리" 금지 규칙의 대체 증거.

### 검증 대상 (모바일 웹앱 특성상 필수)

- PWA: `manifest.json` 로드, Service Worker 등록, 오프라인 동작.
- Wake Lock: 타이머 화면에서 화면 꺼짐 방지 동작.
- 터치 타겟 크기 (최소 48×48dp; CTA는 `h-tap-default` 56dp+ / hero는 `h-tap-hero` 80dp).
- 다크 모드 가독성·대비.
- Vibration / Web Audio / Notification 트리거 — headless에선 제한적이라 실 디바이스 검증 필요.

### 원칙

- "타입체크·테스트 통과 = 기능 통과"가 아니다. 실제 브라우저에서 동작을 눈으로 확인하기 전까지 작업 완료라고 보고하지 않는다.
- chrome-devtools MCP 도구가 세션에 노출 안 됨(등록 직후 미재시작 등) + smoke도 불가한 경우, **추측으로 통과 처리하지 말고 그 사실을 사용자에게 명시**한다.

## 디자인 초안

UI 화면 초안은 **Google Stitch**로 먼저 생성한 뒤 코드로 옮긴다.

- 생성 prompt에 반드시 포함할 제약: 다크 모드 기본, 하단 탭 네비, 큰 터치 타겟(56dp+), 한 손 조작, 세로 모드 우선.
- Stitch 결과에서 디자인 토큰(색·간격·타이포)을 추출해 Tailwind config로 옮긴 뒤 shadcn/ui 컴포넌트로 구현한다.
