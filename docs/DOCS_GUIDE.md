# 문서 관리 가이드 (Post-Prototype)

Breakteau prototype (Phase 0–4) 종료 후 v1.0 이상 정식 운영 단계의 문서 체계를 정의한다.

prototype 단계는 `docs/prototype/`에 archive되었다 — immutable. 이후 산출물은 본 가이드를 따라 새 공간에 작성한다.

---

## 1. 문서 분류 — 살아있는 vs 회고

| 카테고리 | 목적 | 갱신 방식 | 위치 |
|---|---|---|---|
| **살아있는 (Living)** | 현재 상태를 항상 반영 | 변경 시 직접 수정, 옛 내용은 git history로만 추적 | `docs/PRD.md`, `docs/RUNBOOK.md`, `docs/design-tokens.md` |
| **누적 (Append-only)** | 결정/이벤트 기록을 보존 | 새 항목 append, 옛 항목은 절대 수정 X | `docs/ADR.md`, `docs/history/`, `docs/review/` |
| **카탈로그 (Catalog)** | 작업 단위 목록 | 신규 추가 + 상태 갱신, 정기적으로 archive | `docs/stories/<version>.md` |
| **회고/Archive (Immutable)** | 종료된 phase의 누적 산출물 | 절대 수정 X | `docs/prototype/`, 미래 `docs/archive/<phase>/` |
| **개인 학습 (Personal)** | 운영자 노트 | 자유, gitignored | `docs/learning/` (전역 `~/.config/git/ignore`로 push 차단) |

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

### 2.3 STORIES (작업 카탈로그)

**역할**: 다음 사이클에 처리할 단위 작업 카탈로그.

**규칙**:
- 버전별로 새 파일 — `docs/stories/v1.0.md`, `docs/stories/v1.1.md` 등.
- 한 Story = 한 commit cycle. Story가 너무 커지면 분할.
- 상태: `⬜ Todo` / `🔄 In Progress` / `✅ Done` / `⏸ Blocked` / `❌ Cancelled`.
- 완료된 Story는 그대로 두되, 버전이 끝나면 전체 파일을 `docs/archive/<version>/stories.md`로 이동.

**기존 `docs/STORIES.md`는 prototype catalog로 deprecate.** 본 파일은 v1.0 시작 시 `docs/prototype/stories.md`로 이동하고 `docs/stories/v1.0.md`를 신규 시작.

### 2.4 history / review

**역할**:
- `docs/history/<version>/<storyId>.md` — Story 완료 후 변경 파일 / 의사결정 / 검증 / follow-up 기록.
- `docs/review/<version>/<storyId>.md` — subagent self-review 원문 + 본인의 수용/반박 판단.

**규칙**:
- Story 단위로 한 파일. (prototype은 phase별이었으나 v1.0부터는 더 세분화해서 검색성 ↑)
- 작성 시점: Story commit 직후. CLAUDE.md 워크플로우 §5에 명시.
- 버전이 끝나면 `docs/archive/<version>/history|review/`로 이동.

### 2.5 RUNBOOK (`docs/RUNBOOK.md`)

**역할**: 운영 절차의 살아있는 매뉴얼.

**규칙**:
- **살아있는** — 운영 환경이 바뀌면 즉시 갱신.
- 새 운영 함정 발견 시 본문에 **"Why" 한 단락 + 명령어** 추가. prototype에서 정착한 패턴 (§1.5 OS Login, §2.1 swap 이유, §7.5 CSP 등).
- 옛 절차는 supersede되면 삭제. git log가 archival 역할.

### 2.6 learning (`docs/learning/`)

**역할**: 운영자 개인 노트 — 디버그 트레이스, Q&A, 비자명 트러블슈팅.

**규칙**:
- 전역 `~/.config/git/ignore` + 로컬 `.gitignore`로 **원격 push 차단**.
- 형식: `<topic>.md`로 토픽별 파일, 또는 `<version>-<phase>-qa.md` 누적 파일.
- 트리거: ① 디버그 해결 ② 사용자 "왜?" 질문 ③ RUNBOOK 본문에 미반영된 운영 관행.

---

## 3. 디렉토리 레이아웃 (v1.0 이후)

```
docs/
├── PRD.md                  ← 살아있는, v1.0 기준 product 정의
├── ADR.md                  ← append-only, supersede 패턴
├── RUNBOOK.md              ← 살아있는, 운영 절차
├── DOCS_GUIDE.md           ← 본 가이드
├── PROJECT_GUIDE.html      ← 분석/onboarding 가이드 (다이어그램)
├── design-tokens.md        ← 살아있는
├── design/                 ← Stitch prompts + visual mocks
├── stories/
│   ├── v1.0.md            ← 현 버전 작업 카탈로그
│   └── v1.1.md            ← 다음 버전 backlog
├── history/
│   └── v1.0/
│       ├── <storyId>.md   ← Story별 완료 기록
│       └── ...
├── review/
│   └── v1.0/
│       └── <storyId>.md   ← Story별 self-review
├── archive/                ← 완료된 버전들의 stories/history/review
│   └── v1.0/
├── prototype/              ← Phase 0-4 (2026-06-22 종료, immutable)
│   ├── README.md
│   ├── history/
│   └── review/
└── learning/               ← gitignored, 개인 노트
    └── <topic>.md
```

---

## 4. v1.0 transition checklist

prototype → v1.0 전환 시점에 한 번 처리할 작업:

- [ ] `docs/PRD.md` 갱신: prototype 검증된 가정만 남기고 v1.0 launch criteria 명확히
- [ ] `docs/ADR.md` ADR-9 작성: "prototype → v1.0 전환 시점 결정 (예: STORIES catalog versioning, history/review per-Story granularity)"
- [ ] `docs/STORIES.md` → `docs/prototype/stories.md`로 이동, `docs/stories/v1.0.md` 신규 시작
- [ ] `docs/history/v1.0/`, `docs/review/v1.0/` 빈 디렉토리 생성 (gitkeep 없이 신규 Story 첫 commit 시 자동 생성)
- [ ] `CLAUDE.md` 워크플로우 §5 갱신: history/review 작성 시 `<version>/<storyId>.md` 형식 명시
- [ ] `docs/DOCS_GUIDE.md` 본 문서 commit
- [ ] 운영자/Claude 모두 본 가이드를 참조 — onboarding 1회 점검

---

## 5. CLAUDE.md와의 관계

`CLAUDE.md`는 Claude Code의 워크플로우 지침 (Story 진행 → 리뷰 → 수정 → 커밋 → 산출물 저장). 본 가이드는 **그 산출물이 어디에 어떤 형식으로 저장되는가**를 정의. 둘은 보완.

CLAUDE.md §5 (산출물 저장)을 v1.0 시점에 업데이트:
- prototype: `docs/review/phase-N.md`, `docs/history/phase-N.md`
- v1.0+: `docs/review/<version>/<storyId>.md`, `docs/history/<version>/<storyId>.md`
