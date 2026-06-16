# Climb-Forge — Implementation Stories

각 Story는 **구현 → 리뷰 → 수정 → 커밋** 워크플로우 1회 분량. 워크플로우 절차는 `CLAUDE.md` 참조.

상태 표기: `⬜ Todo` / `🔄 In Progress` / `✅ Done` / `⏸ Blocked`

---

## Phase 0 — 문서·디자인 (선행)

### S01 — PRD 보완 ✅ (commit ec1e7ba, Ultraplan)
**Goal:** PRD에 누락된 부상 방지·휴식·알림·파일 필드를 보강한다.
**완료 상태:** Ultraplan 세션에서 직접 반영됨 — 통증 0–3 스케일, RPE, `client_id` 멱등 키, NFR, 성공 지표, 사용 시나리오, 분석 화면 섹션까지 추가. 본 워크플로우 도입 전 작업이라 review 파일은 없음 (history만 백필).

### S02 — ADR 4–8 추가 ✅ (commit ec1e7ba, Ultraplan)
**Goal:** plan에서 결정된 보강 결정을 ADR로 기록.
**완료 상태:** ADR-4(PWA/오프라인 동기화), ADR-5(CORS/JWT 인증), ADR-6(R2 백업), ADR-7(인터벌 타이머 안정성 Wake Lock/Audio/Vibration), ADR-8(GCP region us-west1) 추가 완료. 본 워크플로우 도입 전 작업이라 review 파일은 없음.

### S03 — 디자인 토큰 + Stitch 프롬프트 ⬜
**Goal:** UI.md의 결정·와이어프레임을 기반으로 디자인 토큰을 문서화하고, Stitch에 넣을 화면별 prompt를 작성한다. (Visual mock 생성은 사용자가 Stitch에서 직접 수행.)
**Dependencies:** S01, S02 (둘 다 ✅)
**Tasks:**
- `docs/design-tokens.md` 생성: 색(다크/라이트 팔레트, 상태 색상), 간격(spacing scale), 타이포 스케일, radius, shadow, motion duration, breakpoint
- 다크 모드 대비비 WCAG AA 기준 명시 (UI.md §5 체크리스트 충족)
- 타이머 풀스크린의 거대 숫자 타이포(`text-9xl+`) 별도 명시
- `docs/design/STITCH_PROMPTS.md` 생성: UI.md §3의 5개 화면 (홈, 행보드 타이머, 세트 결과, 볼더링 입력, 분석) 각각의 Stitch prompt
  - 공통 제약: 다크 모드, 하단 탭 네비, 56dp 터치 타겟, 한 손 조작, 세로 모드
- `docs/design/` 디렉토리 placeholder README 생성 (Stitch 산출물 보관 경로 안내)
**Acceptance Criteria:**
- [ ] 디자인 토큰 문서가 색·간격·타이포·radius·shadow·motion·breakpoint 모두 포함
- [ ] 다크 모드 핵심 텍스트 조합의 contrast ratio 7개 이상 명시 (≥ 4.5:1 AA)
- [ ] Stitch prompt가 UI.md §3 5개 화면 각각에 대해 존재
- [ ] 토큰이 Tailwind config로 옮기기 쉬운 구조 (key-value 또는 표)
**Out of scope (사용자 별도 진행):**
- Stitch에서 visual mock 실제 생성 → `docs/design/` 아래 저장

---

## Phase 1 — 인프라·스캐폴딩

### S04 — 프론트엔드 부트스트랩 ⬜
**Goal:** Next.js (App Router, static export) + Tailwind + shadcn/ui + 기본 PWA 셋업.
**Dependencies:** S03
**Tasks:**
- `pnpm create next-app` (TS, App Router, Tailwind)
- `next.config.js`에 `output: 'export'`
- shadcn/ui init
- `public/manifest.json` + 아이콘
- 기본 service worker (오프라인 fallback만)
- 빌드 → `out/` 정적 산출물 확인
**Acceptance Criteria:**
- [ ] `pnpm build` 성공
- [ ] Comet에서 `out/` 로컬 서빙 시 PWA installable
- [ ] manifest, SW 등록 Comet MCP로 검증

### S05 — 디자인 시스템 ⬜
**Goal:** S03 토큰을 Tailwind config로 옮기고, 다크 모드 + 하단 탭 네비 컴포넌트 작성.
**Dependencies:** S03, S04
**Tasks:**
- `tailwind.config.ts`에 디자인 토큰 반영
- 다크 모드 기본 (class strategy, 시스템 prefers-color-scheme)
- `<BottomNav>` 컴포넌트 (4개 모듈 + 대시보드 자리)
- `<NumberStepper>`, `<TimerDisplay>` 등 공통 컴포넌트
- 스토리북은 도입하지 않음 (오버헤드 큼) — `/dev/components` 라우트로 대신
**Acceptance Criteria:**
- [ ] 모바일 뷰포트(390×844)에서 BottomNav 엄지 zone 내 위치
- [ ] 텍스트 대비 WCAG AAA (Comet MCP로 확인)

### S06 — PocketBase 셋업 + 스키마 ⬜
**Goal:** 로컬 PocketBase + 컬렉션 정의 + JS SDK 연동.
**Dependencies:** S01
**Tasks:**
- `infra/pocketbase/` 아래 docker-compose.yml + Caddyfile
- 컬렉션: `sessions`, `hangboard_logs`, `climbing_logs`, `strength_logs`, `campus_logs` (S01 보강 필드 포함)
- 컬렉션 schema는 `pb_migrations/`에 코드로 관리
- 프론트엔드: `src/lib/pb.ts` (SDK 초기화), 환경변수 `NEXT_PUBLIC_PB_URL`
**Acceptance Criteria:**
- [ ] `docker compose up` 후 admin UI 진입 가능
- [ ] 마이그레이션 재실행 가능 (idempotent)
- [ ] 프론트에서 sample fetch 동작

### S07 — 인증 ⬜
**Goal:** 1인 admin 로그인 + 보호 라우트.
**Dependencies:** S06
**Tasks:**
- PocketBase admin 계정 1개
- 컬렉션 rule: 인증 user만 CRUD
- 프론트엔드 `/login` 페이지
- `<AuthGuard>` 래퍼 (미인증 시 `/login` 리다이렉트)
- 로그인 상태 IndexedDB 영속화
**Acceptance Criteria:**
- [ ] 로그인 → 메인 라우트 접근 가능
- [ ] 로그아웃 시 즉시 보호 라우트 차단
- [ ] 새로고침 후 세션 유지

---

## Phase 2 — 기능

### S08 — 세션 관리 모듈 ⬜
**Goal:** 세션 생성/조회/종료.
**Dependencies:** S05, S07
**Tasks:**
- `/sessions/new`: 날짜·장소·메인 타깃 입력 → 세션 생성
- `/sessions/[id]`: 현재 세션 + 하위 모듈 진입 카드
- 세션 종료 시 RPE·전반적 피로도 입력 (S01 필드)
- TanStack Query로 mutation + optimistic update
**Acceptance Criteria:**
- [ ] 모바일에서 세션 생성→종료 흐름 30초 이내
- [ ] Comet MCP: 세션 생성 후 PocketBase에 row 생성 확인

### S09 — 행보드 타이머 모듈 ⬜⚠️ (가장 복잡)
**Goal:** 10초 매달리기 / 3분 휴식 / 5세트 자동 타이머 + 폼 데이터 기록.
**Dependencies:** S05, S07, S08
**Tasks:**
- 풀스크린 타이머 화면 (거대 숫자, 3m 가독)
- Wake Lock API
- Vibration API (페이즈 전환 시)
- Web Audio API (사용자가 첫 탭으로 unlock)
- Notification API + SW (백그라운드 페이즈 전환)
- 그립 형태(토글), 홀드 깊이(stepper), 보조 무게(stepper) 입력
- 세트별 성공/실패 기록
- 세션 종료 후 `hangboard_logs` 저장
**Acceptance Criteria:**
- [ ] Comet MCP: 핸드폰 뷰포트에서 타이머 동작 + Wake Lock 활성 확인
- [ ] 백그라운드 진입 후 페이즈 전환 알림 도착
- [ ] 5세트 완료 후 DB row 1개 저장

### S10 — 등반 볼륨 모듈 (Lead/Bouldering) ⬜
**Goal:** 리드/볼더링 시도·완등 기록.
**Dependencies:** S05, S07, S08
**Tasks:**
- 모드 토글 (Lead/Bouldering)
- 그레이드 선택 (5.10D~5.12A / V4~V8 세그먼트)
- 시도 횟수 stepper, 완등 토글, 메모
- 볼더링: 세트 간 휴식 타이머 (3분) 추가
**Acceptance Criteria:**
- [ ] 한 손 조작으로 입력 완료
- [ ] DB row 정상 저장

### S11 — 보조 근력 모듈 (Strength + Campus) ⬜
**Goal:** 웨이트·캠퍼스 보드 기록.
**Dependencies:** S05, S07, S08
**Tasks:**
- 종목 selector + 자주 쓰는 종목 즐겨찾기
- 중량/세트/반복 stepper
- 캠퍼스: 종목 + 렁 사이즈 (Large/Medium/Small)
**Acceptance Criteria:**
- [ ] 5종목 연속 입력 60초 이내
- [ ] DB row 정상 저장

### S12 — 오프라인 입력 큐 ⬜
**Goal:** 네트워크 끊겨도 입력 가능, 복구 시 sync.
**Dependencies:** S08, S09, S10, S11
**Tasks:**
- 모든 mutation을 IndexedDB 큐 경유
- 온라인 복구 시 자동 flush
- 큐 길이 UI 표시 (상단 배지)
- 충돌 처리: created_at 기준 그대로 push (1인 앱이라 충돌 거의 없음)
**Acceptance Criteria:**
- [ ] Comet MCP: 오프라인 토글 후 입력 → 온라인 복구 시 동기화 확인

---

## Phase 3 — 배포

### S13 — 서버 인프라 (Compute + Docker Compose + Caddy) ⬜
**Goal:** ADR-6 결정한 region에 PocketBase 운영 환경 구축.
**Dependencies:** S02, S06
**Tasks:**
- VM 프로비저닝, swap 2GB
- Docker + Docker Compose 설치
- `infra/` 디렉토리에 prod compose + Caddyfile (도메인, 자동 SSL)
- 도메인 연결, HTTPS 검증
**Acceptance Criteria:**
- [ ] `https://<domain>/_/` admin UI 접근
- [ ] `curl -w "%{time_total}"` 한국에서 측정 기록

### S14 — PocketBase 자동 백업 ⬜
**Goal:** SQLite + uploads를 Cloudflare R2로 일 1회 백업.
**Dependencies:** S13
**Tasks:**
- 컨테이너 cron 또는 systemd timer
- `pb_data` 압축 → rclone → R2
- 30일 보관 정책
- 복원 리허설 1회 (별도 인스턴스로 복원 후 검증)
**Acceptance Criteria:**
- [ ] 백업 객체가 R2에 존재
- [ ] 복원 절차 `docs/RUNBOOK.md`에 문서화

### S15 — Cloudflare Pages 배포 파이프라인 ⬜
**Goal:** main 푸시 시 자동 빌드·배포.
**Dependencies:** S04
**Tasks:**
- Cloudflare Pages 프로젝트 연결
- 환경변수 (`NEXT_PUBLIC_PB_URL` 등)
- 빌드 명령 `pnpm build`, 출력 `out`
**Acceptance Criteria:**
- [ ] 푸시 → 프로덕션 URL에 반영
- [ ] HTTPS + SW 정상 동작

---

## Phase 4 — v1.1 (출시 후)

### S16 — 대시보드 모듈 ⬜
**Goal:** 진행 추적 시각화.
**Tasks:** 주간 볼륨 / 평균 그레이드 추세 / 행보드 추정 1RM
**Library:** Recharts

### S17 — 음성 메모 입력 ⬜
**Goal:** Web Speech API로 메모 받아쓰기.

---

## 의존성 요약

```
S01 → S02, S03, S06
S03 → S04 → S05
S05, S07 → S08 → S09, S10, S11 → S12
S02, S06 → S13 → S14
S04 → S15
```

## 진행 순서 권장
1. S01 → S02 (문서 확정)
2. S03 (디자인) — 동시에 S06 (백엔드 스키마)
3. S04 → S05 → S07
4. S08 → S09 (가장 어려운 것 일찍)
5. S10 → S11
6. S12 (오프라인 큐)
7. S13 → S14 → S15 (배포)
8. 1주 도그푸딩 후 S16, S17
