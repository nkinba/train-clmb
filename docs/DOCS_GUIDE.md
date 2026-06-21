# 문서 관리 가이드 (Post-Prototype)

Breakteau prototype (Phase 0–4) 종료 후 v1.0 이상 정식 운영 단계의 문서 체계를 정의한다.

prototype 단계는 `docs/prototype/`에 archive되었다 — immutable. 이후 산출물은 본 가이드를 따라 새 공간에 작성한다.

---

## 1. 문서 분류 — 살아있는 vs 회고

| 카테고리 | 목적 | 갱신 방식 | 위치 |
|---|---|---|---|
| **살아있는 (Living)** | 현재 상태를 항상 반영 | 변경 시 직접 수정, 옛 내용은 git history로만 추적 | `docs/PRD.md`, `docs/RUNBOOK.md`, `docs/design-tokens.md` |
| **누적 (Append-only)** | 결정/이벤트 기록을 보존 | 새 항목 append, 옛 항목은 절대 수정 X | `docs/ADR.md`, `docs/history/`, `docs/review/` |
| **Backlog (Pool)** | 검토 중인 기능/이슈 풀 | 자유 추가, 우선순위 정렬, sprint 진입 시 catalog로 이동 | `docs/backlog.md` |
| **Sprint catalog** | sprint 단위 Story 묶음 | 신규 추가 + 상태 갱신, sprint 종료 후 freeze | `docs/sprints/sprint-N.md` |
| **회고/Archive (Immutable)** | 종료된 단계의 누적 산출물 | 절대 수정 X | `docs/prototype/`, 향후 `docs/archive/sprint-N/` |
| **개인 학습 (Personal)** | 운영자 노트 | 자유, gitignored | `docs/learning/` (전역 `~/.config/git/ignore`로 push 차단) |

### 버전 라벨과 sprint의 관계

| 차원 | 라벨 | 단위 |
|---|---|---|
| **Product release** | `v1.1` (현재 운영), `v1.2`, `v2.0`… | semver — 운영에 배포된 산출물 |
| **개발 cadence** | `sprint-01`, `sprint-02`… | 글로벌 카운터, sprint 길이는 자유 |
| **Story ID** | `S26`, `S27`… (prototype S01~S25 이어서) | 글로벌 카운터, sprint 무관하게 cross-reference 가능 |

> **핵심**: 한 sprint는 여러 release에 걸쳐 있을 수 있고, 한 release는 여러 sprint의 산출물일 수도. 버전과 sprint를 분리해 표현.

---

## 2. 각 문서의 운영 규칙

### 2.1 PRD (`docs/PRD.md`)

**역할**: 현재 product가 무엇이고 누구를 위한 것인가의 단일 진실 출처.

**규칙**:
- **살아있는 문서** — 큰 변경 시 옛 정의 지우고 새 정의로 덮어쓰기. git log로 변경 추적.
- 의사결정의 *이유*는 PRD에 두지 말고 **ADR**로 분리. PRD는 결정 결과만.
- 버전 라벨 (예: "v1.0 기준") 문서 상단에 한 줄 표시.

**예외**: "v1.0 출시 후 폐기 가능성이 있는 가설"은 명시적 표지를 달아 두기 (`> 가설: ...`).

### 2.2 ADR (`docs/ADR.md`)

**역할**: 비자명 결정의 컨텍스트 + 결정 + 트레이드오프 보존.

**규칙**:
- **Append-only**. ADR-N의 결정을 뒤집을 때는 **ADR-N의 본문은 그대로 두고** "Status: Superseded by ADR-M" 한 줄 + 새 ADR-M 작성.
- prototype에서 ADR-6를 in-place 갱신한 패턴 (R2 → GCS → R2 → GCS)은 추적성을 해치므로 v1.0부터는 supersede 패턴으로 변경.
- 한 ADR = 한 결정. 여러 결정 묶지 않기.
- 형식: 컨텍스트 / 결정 / 근거 / 트레이드오프 / 재평가 트리거.

### 2.3 Backlog (`docs/backlog.md`)

**역할**: 검토 중인 기능/이슈/개선의 풀.

**규칙**:
- 자유 추가 — 떠오르는 기능, 사용자 피드백, 운영 중 발견한 개선 사항
- 우선순위는 `🔴 High` / `🟡 Mid` / `🟢 Low` 또는 sprint 진입 시 결정
- 형식: 한 줄 제목 + 2~3줄 컨텍스트 + (선택) 의존성/위험
- **Sprint planning 시점에 선정된 항목을 Story로 분해**해 sprint catalog로 이동
- backlog에서 빠진 항목은 그대로 두지 말고 commit log로 추적 (선정 commit에 출처 명시)

### 2.4 Sprint catalog (`docs/sprints/sprint-N.md`)

**역할**: 한 sprint에 진행할 Story 묶음 + 진행 상태.

**규칙**:
- Sprint 시작 시점에 신규 파일 — `docs/sprints/sprint-01.md`, `sprint-02.md`…
- 한 Story = 한 commit cycle. Story가 너무 커지면 분할 (Sub-story 또는 별도 Story로).
- 상태: `⬜ Todo` / `🔄 In Progress` / `✅ Done` / `⏸ Blocked` / `❌ Cancelled`.
- Story ID는 **글로벌 카운터** (`S26`, `S27`…) — sprint와 무관하게 cross-reference 가능. prototype은 S01~S25 사용.
- Sprint 종료 시 파일에 `🔒 Sprint frozen` 헤더 + 잔여 Story는 다음 sprint로 이관 (어디로 갔는지 commit log에 기록).
- Sprint 종료 후 전체 파일을 `docs/archive/sprint-N/catalog.md`로 이동 (선택, 또는 그대로 두고 freeze).

**기존 `docs/STORIES.md`는 prototype catalog로 freeze 완료**. 다음 sprint 시작 시 backlog에서 Story 분해 + `docs/sprints/sprint-01.md` 신규 생성.

### 2.5 history / review

**역할**:
- `docs/history/sprint-N/<storyId>.md` — Story 완료 후 변경 파일 / 의사결정 / 검증 / follow-up 기록.
- `docs/review/sprint-N/<storyId>.md` — subagent self-review 원문 + 본인의 수용/반박 판단.

**규칙**:
- Story 단위로 한 파일. (prototype은 phase별이었으나 post-prototype은 더 세분화해서 검색성 ↑)
- 작성 시점: Story commit 직후. CLAUDE.md 워크플로우 §5에 명시.
- Sprint가 끝나면 그대로 `sprint-N/` 디렉토리에 freeze. archive로 옮기지 않음 — git log 검색성 유지.

### 2.6 RUNBOOK (`docs/RUNBOOK.md`)

**역할**: 운영 절차의 살아있는 매뉴얼.

**규칙**:
- **살아있는** — 운영 환경이 바뀌면 즉시 갱신.
- 새 운영 함정 발견 시 본문에 **"Why" 한 단락 + 명령어** 추가. prototype에서 정착한 패턴 (§1.5 OS Login, §2.1 swap 이유, §7.5 CSP 등).
- 옛 절차는 supersede되면 삭제. git log가 archival 역할.

### 2.7 learning (`docs/learning/`)

**역할**: 운영자 개인 노트 — 디버그 트레이스, Q&A, 비자명 트러블슈팅.

**규칙**:
- 전역 `~/.config/git/ignore` + 로컬 `.gitignore`로 **원격 push 차단**.
- 형식: `<topic>.md`로 토픽별 파일, 또는 `<version>-<phase>-qa.md` 누적 파일.
- 트리거: ① 디버그 해결 ② 사용자 "왜?" 질문 ③ RUNBOOK 본문에 미반영된 운영 관행.

---

## 3. 디렉토리 레이아웃 (Post-prototype)

```
docs/
├── PRD.md                  ← 살아있는, 현재 product 정의
├── ADR.md                  ← append-only, supersede 패턴
├── RUNBOOK.md              ← 살아있는, 운영 절차
├── DOCS_GUIDE.md           ← 본 가이드
├── PROJECT_GUIDE.html      ← 분석/onboarding 가이드 (다이어그램)
├── design-tokens.md        ← 살아있는
├── design/                 ← Stitch prompts + visual mocks
├── backlog.md              ← 검토 중인 기능/이슈 풀
├── sprints/
│   ├── sprint-01.md       ← 첫 sprint 카탈로그
│   └── sprint-02.md       ← 그 다음 sprint
├── history/
│   ├── sprint-01/
│   │   ├── S26.md         ← Story별 완료 기록
│   │   └── S27.md
│   └── sprint-02/
├── review/
│   ├── sprint-01/
│   │   ├── S26.md         ← Story별 self-review
│   │   └── S27.md
│   └── sprint-02/
├── prototype/              ← Phase 0-4 (2026-06-22 종료, immutable)
│   ├── README.md
│   ├── history/
│   └── review/
├── archive/                ← (선택) freeze된 sprint들 — 안 옮겨도 됨
└── learning/               ← gitignored, 개인 노트
    └── <topic>.md
```

---

## 4. 다음 sprint 시작 시점에 한 번 처리할 작업

prototype → sprint-01 전환:

- [ ] `docs/backlog.md` 신규 — prototype follow-up + 신규 기능 아이디어 정리
- [ ] backlog에서 sprint-01에 가져올 항목 선정 → Story 분해
- [ ] `docs/sprints/sprint-01.md` 신규 — 선정된 Story 카탈로그 (S26부터, prototype S01-S25 이어서)
- [ ] `docs/history/sprint-01/`, `docs/review/sprint-01/` 빈 디렉토리 생성 (첫 Story commit 시 자동 채워짐)
- [ ] `CLAUDE.md` 워크플로우 §5 갱신: history/review 작성 시 `sprint-N/<storyId>.md` 형식 명시
- [ ] (필요 시) `docs/PRD.md` 갱신 — 새로 잡힌 가설/criteria 반영
- [ ] (필요 시) ADR 신규 — sprint 시작 시 결정한 정책 (예: 스프린트 길이, Story 분할 정책)

---

## 5. Sprint 운영 흐름 (권장)

```
[backlog 정리]
  ↓ 우선순위 + 의존성 산정
[Sprint planning — Story 분해]
  ↓ docs/sprints/sprint-N.md 신규
[Sprint 진행]
  ↓ Story 단위 commit cycle (구현 → 리뷰 → 수정 → 커밋 → history/review)
[Sprint 회고 + freeze]
  ↓ 남은 Story는 backlog 또는 다음 sprint로
[다음 sprint planning]
```

**1인 운영 가정**: sprint 길이는 자유 (2주 ~ 1달 사이가 일반적이나 본인 페이스대로). sprint planning + 회고 부담을 최소화 — backlog grooming도 sprint 안에서 진행.

---

## 6. CLAUDE.md와의 관계

`CLAUDE.md`는 Claude Code의 워크플로우 지침 (Story 진행 → 리뷰 → 수정 → 커밋 → 산출물 저장). 본 가이드는 **그 산출물이 어디에 어떤 형식으로 저장되는가**를 정의. 둘은 보완.

CLAUDE.md §5 (산출물 저장)를 post-prototype 시점에 갱신:
- prototype: `docs/review/phase-N.md`, `docs/history/phase-N.md` (phase별 누적)
- post-prototype: `docs/review/sprint-N/<storyId>.md`, `docs/history/sprint-N/<storyId>.md` (Story별 파일)
