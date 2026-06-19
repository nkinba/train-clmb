# Breakteau — Implementation Stories

각 Story는 **구현 → 리뷰 → 수정 → 커밋** 워크플로우 1회 분량. 워크플로우 절차는 `CLAUDE.md` 참조.

상태 표기: `⬜ Todo` / `🔄 In Progress` / `✅ Done` / `⏸ Blocked`

---

## Phase 0 — 문서·디자인 (선행)

### S01 — PRD 보완 ✅ (commit ec1e7ba, Ultraplan)
**Goal:** PRD에 누락된 부상 방지·휴식·알림·파일 필드를 보강한다.
**완료 상태:** Ultraplan 세션에서 직접 반영됨 — 통증 0–3 스케일, RPE, `client_id` 멱등 키, NFR, 성공 지표, 사용 시나리오, 분석 화면 섹션까지 추가. 본 워크플로우 도입 전 작업이라 review 파일은 없음 (history만 백필).

### S02 — ADR 4–8 추가 ✅ (commit ec1e7ba, Ultraplan)
**Goal:** plan에서 결정된 보강 결정을 ADR로 기록.
**완료 상태:** ADR-4(PWA/오프라인 동기화), ADR-5(CORS/JWT 인증), ADR-6(객체 스토리지 — 2026-06-19 GCS로 갱신), ADR-7(인터벌 타이머 안정성 Wake Lock/Audio/Vibration), ADR-8(GCP region us-west1) 추가 완료. 본 워크플로우 도입 전 작업이라 review 파일은 없음.

### S03 — 디자인 토큰 + Stitch 프롬프트 ✅
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

### S04 — 프론트엔드 부트스트랩 ✅
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

### S05 — 디자인 시스템 ✅
**Goal:** S03 토큰을 Tailwind config로 옮기고, 다크 모드 + 하단 탭 네비 컴포넌트 작성.
**Dependencies:** S03, S04
**Tasks:**
- `tailwind.config.ts`에 디자인 토큰 반영 (S03 design-tokens.md §10의 전체 매핑 copy-paste)
- 다크 모드 기본 (class strategy, 시스템 prefers-color-scheme)
- `<BottomNav>` 컴포넌트 — 4 탭: 오늘 / 기록 / 분석 / 설정 (모듈 선택은 오늘 탭 내부 카드)
- `<NumberStepper>`, `<TimerDisplay>`, 통증 0–3 셀렉터, RPE 4-band 셀렉터 등 공통 컴포넌트
- 스토리북은 도입하지 않음 (오버헤드 큼) — `/dev/components` 라우트로 대신
- `prefers-reduced-motion: reduce` 글로벌 CSS 처리
**Acceptance Criteria:**
- [ ] 모바일 뷰포트(390×844)에서 BottomNav 엄지 zone 내 위치
- [ ] 텍스트 대비 AA 이상 (Comet MCP로 9개 핵심 조합 실측 — design-tokens.md §1.10)
- [ ] focus ring이 키보드 탐색 시 모든 인터랙티브 요소에 표시

### S06 — PocketBase 셋업 + 스키마 ✅
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

### S07 — 인증 ✅
**Goal:** 1인 user 로그인 + 보호 라우트. (admin은 PB 자체 admin UI 사용, 프론트는 일반 user auth만.)
**Dependencies:** S06 ✅
**Tasks:**
- 프론트엔드 `/login` 페이지 (이메일/비번 폼, `pb.collection("users").authWithPassword`)
- `<AuthGuard>` 래퍼 (미인증 시 `/login` 리다이렉트, FOUC 방지용 로딩 상태)
- `<LogoutButton>` 컴포넌트 (`pb.authStore.clear` + `/login`로 replace)
- 보호 라우트는 `(protected)` route group으로 묶고 그룹 layout에 AuthGuard 적용
- 로그인 상태는 SDK 기본 LocalAuthStore(localStorage) — ADR-5와 일치 (STORIES.md 옛 표현 "IndexedDB"는 ADR-5의 localStorage로 정정)
**Acceptance Criteria:**
- [ ] 로그인 → 메인 라우트 접근 가능
- [ ] 로그아웃 시 즉시 보호 라우트 차단
- [ ] 새로고침 후 세션 유지

---

## Phase 2 — 기능

### S08 — 세션 관리 모듈 ✅
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

### S09 — 행보드 타이머 모듈 ✅ (가장 복잡)
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

### S10 — 등반 볼륨 모듈 (Lead/Bouldering) ✅
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

### S11 — 보조 근력 모듈 (Strength + Campus) ✅
**Goal:** 웨이트·캠퍼스 보드 기록.
**Dependencies:** S05, S07, S08
**Tasks:**
- 종목 selector + 자주 쓰는 종목 즐겨찾기
- 중량/세트/반복 stepper
- 캠퍼스: 종목 + 렁 사이즈 (Large/Medium/Small)
**Acceptance Criteria:**
- [ ] 5종목 연속 입력 60초 이내
- [ ] DB row 정상 저장

### S12 — 오프라인 입력 큐 ✅

### S19 — 과거 세션 조회/관리 (`/logs`) ✅

### S20 — 장소/타깃 Picker UX ✅
**Goal:** 새 세션 폼의 "장소" / "메인 타깃" 텍스트 입력을 prebuilt 리스트 + MRU + 직접 입력 picker로 교체.
**Dependencies:** S08 ✅
**Tasks:**
- `lib/picker-presets.ts`: 한국 클라이밍 짐 prebuilt + 야외 암장 + 타깃(그레이드/컨디션/기술/캐주얼) 카테고리.
- `lib/mru.ts`: localStorage MRU 6개 누적 (key: locations / targets), push/get/SSR 안전.
- `components/picker.tsx`: 공통 Picker (검색 + MRU + presets grid + 직접 입력 모드 토글).
- `/sessions/new`: 기존 input 2개 → `LocationPicker` / `TargetPicker`. 세션 생성 성공 시 MRU push.
**Acceptance Criteria:**
- [x] 폼 진입 시 prebuilt 리스트 + 아이콘 표시
- [x] 검색 input으로 prebuilt 즉시 필터
- [x] "직접 입력" 토글 → 일반 text input
- [x] 세션 생성 후 입력값이 MRU에 누적되어 다음 진입 시 상단에 표시
- [x] 모바일 한 손 조작 + 48dp+ 터치 타겟

### S21 — 지도 SDK 연동 (장소 픽) ⬜ (v1.1 후보)
**Goal:** S20의 직접 입력 단계를 카카오맵/네이버 places로 보강 — 검색 결과에서 장소 picking.
**Dependencies:** S20
**Tasks:**
- 카카오맵 vs 네이버 Places 비교 (한국 클라이밍 짐 데이터 정확성·API 한도·비용).
- API key 발급 + 환경변수 분리 (NEXT_PUBLIC_KAKAO_KEY 등).
- 장소 검색 dropdown → 선택 시 location.name(+ 위경도 메타) 저장.
- (선택) 세션 record에 lat/lng 필드 추가 마이그레이션.
**Out of scope (현 단계):** 지도 시각화, 거리 기반 추천.

### S22 — 짐/타깃 데이터테이블화 ✅
**Goal:** S20의 lib 상수 prebuilt 리스트를 PB 컬렉션 2개 (`gyms`, `targets`)로 옮겨 운영 중 관리 가능하게 한다.
**Dependencies:** S20 ✅
**Tasks:**
- PB 마이그레이션 신규 (`infra/pocketbase/pb_migrations/1750000002_gyms_targets.js`):
  - `gyms`: `name` (text, unique), `category` (select: gym-seoul/gym-suburb/outdoor/home), `sort_order` (number). List/View rule `@request.auth.id != ''`. Create/Update/Delete는 admin만.
  - `targets`: `label` (text, unique), `category` (select: grade/condition/technique/casual), `sort_order` (number). 동일 rule.
  - up: 현 `LOCATION_PRESETS` / `TARGET_PRESETS` 22+23개 그대로 seed (sort_order = 배열 인덱스).
  - down: 두 컬렉션 삭제.
- `web/src/lib/gyms.ts` — `useGyms()` (TanStack Query, perPage 200, sort `sort_order,name`).
- `web/src/lib/targets.ts` — `useTargets()` 동일 패턴.
- `web/src/components/picker.tsx` — `presets` prop을 PB 데이터로 교체, 로딩 skeleton, 카테고리 타입은 각 lib에 정의.
- `web/src/lib/picker-presets.ts` 삭제.
- 로고는 본 Story 범위 외 — `gyms`에 file 필드 없음.
**Acceptance Criteria:**
- [x] PB Admin UI에서 `gyms` / `targets` 컬렉션이 22+23개 레코드와 함께 보임
- [x] /sessions/new 진입 시 PB 데이터로 chip 그리드 렌더 (네트워크 탭 `/api/collections/gyms/records` 확인)
- [x] 비인증 시 401, 인증 시 200
- [x] 로딩 중에는 skeleton chip 표시, 에러 시 직접 입력 fallback hint
- [x] 기존 acceptance criteria (검색 / 직접 입력 / MRU / 48dp) 회귀 없음

### S23 — 현재 세션 페이지 재구조화 ✅
**Goal:** 활성 세션 화면에서 행보드/등반/보조근력 카드를 메인 노출에서 빼고, "+ 운동 추가" 단일 버튼으로 모듈 선택을 한 단계 숨김. 대신 그 자리에 현 세션 동안 입력된 운동 항목들이 시간순으로 나열되는 timeline을 노출.
**Dependencies:** S08 ✅, S09-S11 ✅
**Tasks:**
- `lib/sessions.ts`: `useActiveSessionLogs(sessionId)` — 4개 컬렉션 (hangboard/climbing/strength/campus)을 병렬 fetch + created 기준 시간순 정렬 + 단일 timeline array 반환. 각 row에 `kind`/`summary` 정규화.
- `components/add-module-sheet.tsx` (또는 sheet 대신 inline modal): "+ 운동 추가" 버튼 → 4 모듈 (행보드 / 등반(Lead·Bouldering) / 보조 근력 / 캠퍼스) 선택. 각각 기존 라우트로 이동.
- `app/(protected)/sessions/active/page.tsx`:
  - 기존 `<section aria-label="모듈 선택">` 3장 카드 제거.
  - `+ 운동 추가` CTA 하나 (h-tap-default brand).
  - 그 아래에 timeline section — 각 row는 `Icon + 한 줄 요약 + 시각`. 빈 경우 "아직 추가된 운동이 없습니다" hint.
  - row tap → 해당 모듈 라우트(또는 detail) 이동 (현 v1.0에서는 단순 이동만, 편집은 별도 Story).
- 4개 lib (hangboard/climbing/strength/campus)에 row 삭제 mutation이 이미 있으면 timeline row swipe-to-delete는 follow-up.
**Acceptance Criteria:**
- [x] /sessions/active에 3장 모듈 카드가 보이지 않음
- [x] "+ 운동 추가" 버튼 → 4 모듈 선택 → 해당 라우트로 이동
- [x] 활성 세션에 입력된 모든 운동 항목이 시간순으로 timeline에 표시됨
- [x] timeline에 모듈별 icon + 한 줄 요약 (예: "행보드 · 20mm half_crimp · 4/5세트")
- [x] 빈 상태 hint 노출
- [x] BottomNav + "세션 종료" 버튼 회귀 없음
**Out of scope:**
- timeline row tap 시 편집·삭제 — 별도 Story.
- row swipe gesture.

---

## Phase 3 — 배포

### S13 — 서버 인프라 (Compute + Docker Compose + Caddy) ✅
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

### S14 — PocketBase 자동 백업 ✅
**Goal:** SQLite + uploads를 GCS로 일 1회 백업 (ADR-6 2026-06-19 갱신: R2 → GCS).
**Dependencies:** S13
**Tasks:**
- 컨테이너 cron 또는 systemd timer
- `pb_data` 압축 → rclone (S3 호환, provider=GCS, HMAC 키) → GCS
- 30일 보관 정책 (GCS lifecycle + rclone --min-age 이중 안전망)
- 복원 리허설 1회 (별도 인스턴스로 복원 후 검증)
**Acceptance Criteria:**
- [ ] 백업 객체가 GCS에 존재
- [ ] 복원 절차 `docs/RUNBOOK.md`에 문서화

### S15 — VM Caddy 정적 서빙 + 배포 파이프라인 ✅
**Goal:** PB와 같은 VM의 Caddy에서 `out/` 정적 서빙, main 푸시 시 자동 빌드·배포 (ADR-3 결정 변경, 2026-06-17).
**Dependencies:** S04, S13
**Tasks:**
- `infra/prod/Caddyfile`에 `{$APP_DOMAIN}` 두 번째 hostname 블록 추가 (`root /srv/app` + `file_server` + 보안 헤더 + SPA fallback)
- `infra/prod/docker-compose.prod.yml`에 host 디렉토리(`${DATA_DIR}/app`) → caddy `/srv/app` 마운트, `${APP_DOMAIN:?}` fail-fast
- `infra/prod/.env.prod.example` + RUNBOOK §3에 두 hostname (PB + 프론트) 등록 절차 (DDNS 시 서브도메인 2개)
- 빌드: 로컬 `pnpm build` → `web/out/`. VM에 `rsync` 1회 절차 RUNBOOK에 명시
- 자동화 (GitHub Actions, 옵션): main 푸시 시 `pnpm build` → `rsync -av out/ <vm>:/opt/breakteau/data/app/` (SSH key는 GitHub secret)
- PB 측 CORS Allowed Origins에 프론트 hostname 추가
- `NEXT_PUBLIC_PB_URL`을 빌드 시점 PB hostname으로 빌드
**Acceptance Criteria:**
- [ ] `https://<APP_DOMAIN>/` 접속 시 다크 모드 홈 화면 + BottomNav 정상 표시
- [ ] HTTPS (Let's Encrypt) + SW 등록 + manifest 인식 (Lighthouse PWA)
- [ ] 로컬 push → 배포 절차 완료 + 30초 내 새 콘텐츠 반영

---

## Phase 4 — v1.1 (출시 후)

### S16 — 대시보드 모듈 ✅
**Goal:** 진행 추적 시각화.
**Tasks:** 주간 볼륨 / 평균 그레이드 추세 / 행보드 추정 1RM
**Library:** Recharts

### ~~S17 — 음성 메모 입력~~ ❌ Cancelled
~~**Goal:** Web Speech API로 메모 받아쓰기.~~
**취소 사유:** 사용자 결정 (2026-06-19) — 우선순위 낮음, 텍스트 메모로 충분.

### S24 — 프로젝트명 Breakteau 리브랜딩 ✅
**Goal:** 프로젝트 식별자/표시 이름을 `climb-forge`/`Climb-Forge`에서 `breakteau`/`Breakteau`로 일괄 변경.
**Dependencies:** 없음 (선행 처리).
**명명 규칙:**
- 표시 이름: `Breakteau` (= break + plateau)
- lowercase 식별자: `breakteau`
- localStorage 키 prefix: `bt:` (이전 `cf:`)
- 컨테이너/이미지: `breakteau-pb` / `breakteau-pocketbase:<v>` / `breakteau-caddy` / `breakteau-backup:s14`
- 경로 예시: `/opt/breakteau/...`
- GCS 버킷 예시: `breakteau-backups` / `breakteau-media`
- 도메인 예시: `pb.breakteau.example.com` / `app.breakteau.example.com`
- SW 캐시: `breakteau-shell-`
**Tasks:**
- 소스 코드: layout.tsx 메타데이터, manifest.webmanifest, icon SVG, sw.js, page.tsx UI 텍스트.
- localStorage 키 `cf:` → `bt:` 치환 + `lib/pb.ts`에 one-shot 마이그레이션 (기존 `cf:` 키 발견 시 `bt:`로 복사 후 삭제).
- 인프라: 모든 docker-compose 파일 (image/container_name), Dockerfile 헤더, Caddyfile 헤더, backup.sh의 BACKUP_NAME prefix.
- env 템플릿: `.env.local.example`, `.env.prod.example` (도메인/버킷/경로 예시).
- 문서: CLAUDE.md, PRD.md, ADR.md, RUNBOOK.md, STORIES.md, design-tokens.md, STITCH_PROMPTS.md, infra/*/README.md, web/AGENTS.md, .github/workflows/deploy-frontend.yml 헤더 주석.
- history/review 파일은 점-인-타임 기록이라 그대로 유지.
**Acceptance Criteria:**
- [x] `git grep -i "climb-forge\|Climb-Forge"`가 docs/history, docs/review, 본 Story 정의 외 0건
- [x] `pnpm build` 통과
- [x] `pnpm smoke` 모든 단계 통과 (`title: "Breakteau"` 확인)
- [x] 브라우저 진입 시 title/manifest name이 "Breakteau"
- [x] 기존 dev localStorage(`cf:*`)가 `lib/pb.ts` one-shot으로 자동 마이그레이션

### S18 — 세션 미디어 (사진/영상 첨부) ⬜
**Goal:** PRD §8의 폼 코칭/AI 분석 후보 — 본인 영상을 세션에 첨부, 반복 재생.
**Dependencies:** S08 (세션 관리), ADR-6 (GCS 객체 스토리지, 2026-06-19 갱신).
**분할:** A (인프라) → B (컬렉션·업로드) → C (재생·라이브러리).

#### S18-A — GCS file storage 인프라 전환 ✅
**Goal:** PB file storage를 GCS로 전환 + 미디어 SA/HMAC를 백업 SA와 격리.
**Dependencies:** S14 (GCS 백업) ✅
**Tasks:**
- RUNBOOK §7.5: PB Admin UI → Settings → Files → S3 storage 활성 + GCS endpoint(`storage.googleapis.com`) 설정 절차.
- 미디어용 SA + HMAC 별도 발급 (`breakteau-media` 버킷 전용). 사용자 위임.
- `.env.prod.example`에 `MEDIA_GCS_*` placeholder 추가 (PB admin UI 입력값을 1Password와 함께 보관용 메타데이터).
- 검증: PB admin에서 테스트 이미지 1개 업로드 → GCS console / `gcloud storage ls`에서 객체 확인.
**Acceptance Criteria:**
- [x] RUNBOOK §7.5 절차로 PB가 GCS를 file storage로 사용
- [x] 백업 SA(`breakteau-backup`)와 미디어 SA(`breakteau-media`)가 버킷·권한 측에서 격리됨 (설계 — 백업 SA는 v1.1 배포 시 함께 생성)
- [x] PB admin에서 업로드한 테스트 파일이 `breakteau-media` 버킷에 도착

#### S18-B — 미디어 컬렉션 + 업로드 흐름 ✅
**Goal:** PB `media` 컬렉션 + 모바일 file input + 진행률 표시.
**Dependencies:** S18-A
**Tasks:**
- PB collection `media`: `session_id` (rel cascade), `client_id` (unique), `kind` (select: photo/video), `file` (file), `note` (text). list/view rule auth, create rule auth, delete rule own only.
- `lib/media.ts` — `useSessionMedia(sessionId)`, `useUploadMedia()` (XHR progress + 오프라인 큐).
- `components/media-uploader.tsx` — `<input type="file" accept="image/*,video/*" capture="environment">` + 진행률 bar.
- `/sessions/active` timeline에 미디어 항목 통합 또는 `/logs/detail`에서만 표시.
**Acceptance Criteria:**
- [x] 모바일에서 영상/사진 캡처 → 첨부 → 진행률 표시 → 저장
- [x] PB rule: 미인증 list는 PB 관례상 200 + empty (listRule `@request.auth.id != ''`이 빈 필터처럼 동작), create는 403. 단일 사용자라 owner 분리 불필요

#### S18-C — 재생 + 라이브러리 ⬜
**Goal:** 세션 상세 영상 재생 + `/library` 일람.
**Dependencies:** S18-B
**Tasks:**
- `/logs/detail`에 첨부 그리드 + lightbox/`<video controls>`.
- `/library` 신규 라우트 (날짜별 그룹 + 검색).
**Acceptance Criteria:**
- [ ] 세션 상세에서 영상 재생 (PB ↔ GCS same-region 무료, 사용자 egress 1GB/월 무료 한도 내)
- [ ] /library에서 전체 미디어 일람

**Out of scope (v1.2+):**
- 영상 transcoding / thumbnail 생성
- AI 폼 분석 모델 연동 (별도 Phase)

---

## 의존성 요약

```
S01 → S02, S03, S06
S03 → S04 → S05
S05, S07 → S08 → S09, S10, S11 → S12 → S19
S08 → S16 → (analysis)
S08 → S20 → S21, S22
S08, S09-S11 → S23
S02, S06 → S13 → S14
S04, S13 → S15
S08, S13 → S18
```

## 진행 순서 권장
1. **Phase 0–1 (완료)**: S01–S07
2. **Phase 2 핵심 (완료)**: S08 → S09 → S10 → S11 → S12 → S19
3. **Phase 2 follow-up (완료)**: S20 → S22 (picker + 카탈로그 데이터화)
4. **Phase 3 배포 (완료)**: S13 → S14 → S15
5. **Phase 4 v1.1 (진행)**:
   - S16 (분석) ✅
   - S23 (현재 세션 timeline) ✅
   - S18 (세션 미디어 — GCS file storage) ⬜ ← 다음 (S18-A 인프라부터)
   - S21 (지도 SDK, 선택)
   - ~~S17 음성 메모 (취소)~~
