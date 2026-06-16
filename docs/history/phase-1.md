# Phase 1 — History

## S04 — 2026-06-16
**변경 파일:**
- `web/` (신규) — Next.js 16.2.9 + React 19.2 + Tailwind 4 + ESLint 9 scaffold
  - `next.config.ts`: `output: "export"`, `trailingSlash: true`, `images.unoptimized: true`
  - `src/app/layout.tsx`: 한국어, dark theme color, manifest 링크, SwRegister
  - `src/app/page.tsx`: placeholder "셋업 완료"
  - `src/app/globals.css`: Tailwind 4 `@theme`로 baseline 토큰 (bg.base/surface/elevated, text.primary/secondary/muted, brand), 시스템 폰트 스택, 16px 입력(iOS zoom 방지), `prefers-reduced-motion` 글로벌 처리
  - `src/components/sw-register.tsx`: prod에서만 `/sw.js` 등록
  - `src/lib/utils.ts`: shadcn `cn()` 헬퍼
  - `components.json`: shadcn 셋업 (style=new-york, baseColor=zinc, lucide)
  - `public/manifest.webmanifest`, `public/icon.svg`, `public/icon-maskable.svg` (80% 안전영역), `public/sw.js`
- `docs/review/phase-1.md` (신규) — S04 subagent 리뷰 + 본인 판단
- `docs/STORIES.md` — S04 ✅
- `docs/history/phase-1.md` (신규) — 본 엔트리

**주요 결정:**
- **Tailwind 4 채택** — create-next-app 16 기본값. JS config 없이 CSS `@theme` 디렉티브로 토큰 정의. 전체 토큰 매핑(design-tokens.md §10)은 S05에서 확장.
- **Geist 폰트 제거, 시스템 sans-serif 사용** — design-tokens.md §4와 일치. Google Fonts 의존성 제거로 정적 export·오프라인 친화.
- **dark mode를 default로** — light mode CSS 분기 없음. class-based dark variant는 S05에서 `@custom-variant`로 도입.
- **SW는 hand-written baseline** — ADR-4의 Workbox 옵션 중 hand-written으로 시작. precacheAndRoute·hashed asset manifest는 S12에서 마이그레이션. TODO(S12) 주석으로 footgun 3건 명시.
- **shadcn 컴포넌트는 lazy install** — `components.json` + `cn()` 준비만. 실제 컴포넌트는 S05에서 `pnpm dlx shadcn add` 시 자동 설치.
- **viewport.userScalable·maximumScale 제거** — 리뷰 후 적용. iOS input zoom은 globals.css의 16px 규칙으로 이미 해결되므로 접근성을 해칠 이유 없음. WCAG 1.4.4 회피.

**Review 처리:** finding 17건 중:
- 즉시 수용 (4건): viewport 정정, SHELL_URLS에 `/index.html` 추가, navigation fallback 순서 보강, sw.js TODO(S12) 주석
- S05로 이월 (3건): token 명명 재검토, `@custom-variant dark` 도입, 미사용 token 활용
- 사용자 검증 시 확인 (1건): Lighthouse PWA audit (PNG fallback 필요시 추가)
- 정보·무해 (9건): action 없음
- 상세는 `docs/review/phase-1.md`

**다음 Story 영향:**
- **S05 (디자인 시스템):**
  - `@custom-variant dark` 추가
  - design-tokens.md §10 전체 토큰을 `globals.css @theme`로 옮기기
  - `text-text-primary` → `text-fg-primary` 등 namespace 재명명 검토
  - `pnpm dlx shadcn add button card input` 등으로 첫 컴포넌트 추가
- **S06 (PocketBase):**
  - `NEXT_PUBLIC_PB_URL` 환경변수 사용. 클라이언트 컴포넌트에서만 SDK 호출 (static export 제약).
- **S12 (오프라인 큐):**
  - `public/sw.js` TODO(S12) 항목 3개 처리: Workbox precache, update prompt UI, IndexedDB queue.
- **S15 (Cloudflare Pages):**
  - `out/` 디렉토리를 그대로 배포. trailingSlash=true이므로 추가 `_redirects` 불필요. `_headers`로 `/sw.js` Cache-Control: no-cache 권장.

**Follow-up:**
- 사용자 Comet MCP 검증 (CLAUDE.md "브라우저 검증" 절차):
  - `cd web && pnpm dev` 후 `http://localhost:3000` 또는 `out/`을 정적 서버로 띄워서:
    - DevTools → Application → Manifest 유효성
    - Application → Service Workers 등록·activate 확인
    - Lighthouse PWA audit (installable 조건 + PNG fallback 권고 시 추가)
    - 모바일 뷰포트(iPhone 14, 390×844)에서 lang="ko", theme-color 적용 확인
- 검증 통과 시 본 history에 ✅ 한 줄 추가, fail 시 추가 fix Story 작성.

## S05 — 2026-06-16
**변경 파일:**
- `web/src/app/globals.css` — 전체 토큰 매핑 (`@theme`), `@custom-variant dark`, focus ring (box-shadow), reduced-motion, skeleton keyframe, `bg-selected/-pressed` 추가
- `web/src/components/bottom-nav.tsx` (신규, server component) — 4탭 (오늘/기록/분석/설정), lucide 아이콘, safe-area-inset 처리
- `web/src/components/number-stepper.tsx` (신규, client) — ±버튼 + 거대 숫자 표시, min/max/step/unit, disabled 처리
- `web/src/components/timer-display.tsx` (신규, server) — 풀스크린 거대 숫자 (10rem) + phase별 색·glow, `aria-live="off"` (S09 TODO)
- `web/src/components/pain-selector.tsx` (신규, client) — 통증 0–3, roving tabindex + Arrow/Home/End 키
- `web/src/components/rpe-selector.tsx` (신규, client) — RPE 1–10 5×2 그리드, 4-band 색, roving tabindex
- `web/src/app/dev/components/page.tsx` (신규) — 컴포넌트 카탈로그 (색·타입 스케일·5개 컴포넌트·CTA·focus ring 시연)
- `web/src/app/{logs,analysis,settings}/page.tsx` (신규) — BottomNav 라우트 placeholder
- `web/src/app/page.tsx` — home에 BottomNav + /dev/components 안내
- `web/package.json` — lucide-react, class-variance-authority 추가
- `docs/design-tokens.md` — S05 namespace 변경 노트 상단 추가, §10 historical 표기
- `docs/review/phase-1.md` — S05 리뷰 + 본인 판단
- `docs/STORIES.md` — S05 ✅
- `docs/history/phase-1.md` — 본 엔트리

**주요 결정:**
- **토큰 namespace 정돈** — `text-text-primary` → `text-fg-primary`, `bg.base` → `canvas`, `bg.success` → `success` 등. design-tokens.md는 의미 단위 spec으로 유지, `globals.css`가 source of truth. 명시적 매핑 표를 doc 상단에 박음.
- **Tailwind 4 `@theme` 전면 채택** — JS config 없이 CSS-only. `--text-*--line-height` modifier 문법으로 line-height와 weight 동시 정의.
- **focus ring: box-shadow 2겹** — outline 대신 layout-shift 없는 ring. **border-radius 강제 없음** — 요소 본래 모서리 따라감 (리뷰 finding 1).
- **dark mode `@custom-variant`** — 클래스 기반 토글 진입점만 준비. 실제 라이트 모드 토큰 매핑은 v1.1 또는 사용자 요청 시.
- **roving tabindex로 radio 그룹 a11y** — `button[role=radio]`는 native arrow nav 없음. 두 컴포넌트에 인라인 핸들러 (공통 hook은 YAGNI). 1D 모델: Left/Up=prev, Right/Down=next, Home/End.
- **BottomNav는 server component** — hook 없음. 클라이언트 번들 절감.
- **TimerDisplay `aria-live="off"`** — 매 초 갱신 SR 스팸 회피. phase 전환 announce는 S09에서 별도 region.

**Review 처리:** finding 13건 중:
- 즉시 수용 (7건): focus-visible border-radius 제거, TimerDisplay aria-live, radio roving tabindex, design-tokens.md rename 노트, bg-selected/pressed 추가, BottomNav use client 제거, RpeSelector scale → ring
- Defer (1건): unused ease 토큰은 S08+ 첫 사용 시 자연 해결
- 무해·확인 (5건): contrast 계산상 AA, viewport, lang, static export, S06+ 영향 분석
- 상세는 `docs/review/phase-1.md`

**다음 Story 영향:**
- **S06 (PocketBase):** 클라이언트 컴포넌트에서 SDK 호출. dev/components 패턴(`"use client"` + `useState`)이 reference.
- **S08 (세션 모듈):** Sheet/Dialog, Chip/Tag, 폼 레이아웃 helper 추가 필요(S08 스코프). PainSelector + NumberStepper + Primary CTA는 즉시 재사용.
- **S09 (행보드 타이머):** TimerDisplay 재사용. Wake Lock + Vibration + Audio + state machine 직접 구현. phase 전환 시 `aria-live="assertive"` 영역 추가.
- **S16 (대시보드):** pain/rpe 색 토큰 그대로 Recharts에서 사용 (구현 hex와 일치).

**Follow-up:**
- Comet MCP로 다음 검증 (CLAUDE.md "브라우저 검증"):
  - `cd web && pnpm dev` 후 `/dev/components`에서
    - 9개 contrast 조합 실측 (design-tokens.md §1.10 — 본 PR 이전 검증으로 충분)
    - PainSelector·RpeSelector에서 키보드 Arrow/Home/End 동작
    - Tab으로 focus ring이 모든 인터랙티브 요소에 표시되고 모서리가 요소를 따라가는지
    - BottomNav 엄지 zone 위치 (iPhone 14, 390×844)
    - 통증 색 가독성 (pain-3 빨강 + 다크 텍스트가 deload 신호로 충분히 강한지)
  - 검증 후 본 history에 결과 한 줄 추가
- S08에서 Sheet·Chip·Form 레이아웃 컴포넌트 추가 (S05 scope 밖이었음).

## S06 — 2026-06-16
**변경 파일:**
- `infra/pocketbase/Dockerfile` (신규) — alpine 멀티스테이지, TARGETARCH 분기로 amd64/arm64 자동 선택, PB v0.22.21 핀, `/api/health` healthcheck
- `infra/pocketbase/docker-compose.yml` (신규) — 단일 서비스, `127.0.0.1:8090`만 노출, `pb_migrations`는 read-only 마운트
- `infra/pocketbase/.gitignore` (신규) — `pb_data/` 차단 (admin 비밀·SQLite 보호)
- `infra/pocketbase/pb_migrations/1750000001_initial_schema.js` (신규) — 5 컬렉션 + 인덱스 + rule. v0.22 Dao API.
- `infra/pocketbase/README.md` (신규) — 빠른 시작, admin/유저 생성, 초기화, S13/S14 영역 명시
- `web/src/lib/pb.ts` (신규) — pb 싱글톤, `Collections` 상수, `newClientId()`
- `web/.env.local.example` (신규) — `NEXT_PUBLIC_PB_URL`
- `web/src/app/dev/pb-check/page.tsx` (신규) — health + 비인증 sessions probe(rule 작동 확인)
- `web/package.json` — pocketbase 0.27.0 추가
- `docs/review/phase-1.md` — S06 리뷰 + 본인 판단
- `docs/STORIES.md` — S06 ✅
- `docs/history/phase-1.md` — 본 엔트리

**주요 결정:**
- **PocketBase v0.22.21 핀** — 안정 0.22 series 마지막. v0.23+로 가면 마이그레이션 API가 `Dao` → `app`으로 breaking change. 본 마이그레이션은 v0.22 한정.
- **PocketBase JS SDK v0.27** — 서버 0.22와 major version skew지만 health/CRUD/auth surface는 호환. 추후 SDK 업그레이드 시 audit 필요.
- **단일 마이그레이션 파일로 5 컬렉션 + 인덱스 + rule** 통합. 자식 컬렉션의 `session_id` relation은 `dao.findCollectionByNameOrId("sessions").id`로 해결.
- **모든 컬렉션에 `client_id` UNIQUE 인덱스** — ADR-4 오프라인 큐 멱등 재전송 보장. 클라이언트는 `newClientId()` (crypto.randomUUID) 발급 후 mutation.
- **rule 단일 정책 `@request.auth.id != ''`** — ADR-5 단일 사용자. 다중 사용자 확장 시 `owner` relation 필요(코드 주석).
- **PRD-null vs PB 표현 차이 명시** — `is_send` (bool은 false/true만 → Lead 시 ignore), `project_name` (text는 unset = "" → `!== ""`로 판별). 마이그레이션 주석 + 본 history에 박음.
- **정수 필드는 `noDecimal: true`** — rpe/attempts/reps/sets/통증/seconds/mm 모두. weight_kg는 소수 허용.
- **pb_data bind mount 사용** — Mac Docker Desktop 환경 가정. Linux 운영(S13)에서 USER 비-root + 권한 정렬 필요.
- **포트 `127.0.0.1`만 바인딩** — 로컬 외부 노출 차단. 운영은 Caddy 경유만(S13).

**Review 처리:** finding 18건 중:
- 즉시 수용 5건: pb-check probe 추가, noDecimal: true 일괄, is_send/project_name 주석, README 프로덕션 TODO 일괄
- Skip 4건: MVP 충분 / 공급망(SHA256 파일 미공개) / Linux UID(S13) / 단일 사용자 rule 가정
- 무해·pass 9건
- 상세는 `docs/review/phase-1.md`

**다음 Story 영향:**
- **S07 (인증):** `users` 컬렉션은 PocketBase 기본 제공, 본 마이그레이션이 건드리지 않음. 클라이언트에서 `pb.collection("users").authWithPassword()` 호출 + `pb.authStore` 활용.
- **S08–S11 (모듈):** `newClientId()` 호출 후 mutation. 모든 record 저장 시 client_id 동봉.
- **S09 (행보드):** `hangboard_logs`의 `actual_hang_seconds`로 실패 시 실제 버틴 초 기록. RPE는 세트 종합 종료 시 입력.
- **S10 (등반):** Lead는 `is_send` 무시, Bouldering은 사용. `project_name`은 자동완성 (직전 세션 동일 이름 우선) + `!== ""` 판별.
- **S12 (오프라인 큐):** record 저장 실패 시 IndexedDB 보관, online 복귀 시 동일 client_id로 재전송 → 서버 409(UNIQUE 충돌) = 멱등 처리.
- **S13 (운영):** Caddy + CORS + USER + SHA256 + 백업. README 명시.

**Follow-up:**
- 사용자 검증 (CLAUDE.md "브라우저 검증" + docker):
  - `cd infra/pocketbase && docker compose up --build` → 빌드 성공·헬스 200 확인
  - `http://localhost:8090/_/` admin 생성 → users 컬렉션에 일반 유저 1명 생성
  - `cp web/.env.local.example web/.env.local`
  - `cd web && pnpm dev` → `http://localhost:3000/dev/pb-check`에서 health ✓ + rule probe 401/403 ✓
  - `docker compose down && docker compose up`으로 마이그레이션 idempotent 확인 (재실행 시 변경 없음)
- 결과를 본 history에 ✅ 한 줄 추가, fail 시 fix Story 생성.

### 검증 결과 — 2026-06-17 ✅

사용자 환경(macOS + Docker Desktop)에서 검증 완료. PB 띄움·admin 생성·user 생성·마이그레이션 적용·rule 작동 모두 정상. 검증 과정에서 `/dev/pb-check` probe 로직 결함 3건 발견·수정 (follow-up commits 아래).

### Follow-up commits — pb-check probe 정정

검증 도중 probe가 "rule 우회됨" false alarm을 띄움. 진단·수정 3단계:

1. **`d9ef7a9` — fix(pb-check): list는 filter라 gate 아님 — create probe로 교체**
   - 발견: list rule이 set이고 비인증이면 200 + totalItems=0이 정상 (rule은 SQL WHERE 절에 더해지는 filter이지 401/403 gate가 아님). 이전 probe는 이를 "rule 우회됨"으로 잘못 표시.
   - 수정: list probe를 정보용으로 강등, create probe(실제 gate) 추가.

2. **`b4f3ec1` — fix(pb-check): create probe payload·error detail 확장**
   - 발견: 최소 payload(`client_id`+`date`)로는 PB가 validation 우선 평가 시 rule 도달 전 400. 어느 필드가 막혔는지 보이지 않음.
   - 수정: full ISO datetime + 모든 schema 통과용 필드 채움. err.response.data를 UI에 노출.

3. **`a7a3780` — fix(pb-check): PB v0.22의 "400 + empty data" = rule 거부로 인식**
   - 발견: 사용자 보고 — 400 + `data:{}` + PB 로그 `DrySubmit create rule failure: sql: no rows in result set`. PB v0.22의 DrySubmit이 createRule을 SQL dry-run으로 평가하며 거부 시 **403이 아니라 400 + 빈 data**로 응답.
   - 수정: 400 + empty data → "rule 정상 거부"로 인식. 400 + field-level errors → 진짜 validation 실패. 두 경우를 UI에서 구분.

### 핵심 학습 (다른 Story에 적용)

- **PocketBase list rule은 SQL filter이지 HTTP gate가 아님.** "비인증인데 200이 옴" ≠ "rule 우회됨". list만으로는 rule 작동 판단 불가 — create/update/delete 같은 mutating 호출로 확인.
- **PB v0.22는 createRule 거부를 400 + empty data로 표현** (403 아님). 서버 로그 `DrySubmit ... rule failure: sql: no rows in result set`이 동반. S08+ mutation 호출의 error handling에서 이 케이스를 "auth required"로 매핑할 것 (또는 SDK 상위 wrapper에서 normalize).
- **probe·smoke test는 minimal payload를 보내지 말 것.** PB는 validation 우선 → rule 도달 전 400으로 끝나 진단 불가. 항상 schema 통과할 완전한 payload + error detail surface.

## S07 — 2026-06-17
**변경 파일:**
- `web/src/components/auth-guard.tsx` (신규) — 클라이언트 보호 wrapper. `loading→auth/redirecting` state machine. `pb.authStore.onChange` + `storage` 이벤트(cross-tab) + `cancelled` flag로 mount race 보호
- `web/src/components/logout-button.tsx` (신규) — `pb.authStore.clear` + `/login/`로 replace
- `web/src/app/login/page.tsx` (신규) — 이메일/비번 폼, `pb.collection("users").authWithPassword`. `checkedAuth` 게이팅으로 폼 flash 회피, `mountedRef`로 비동기 콜백 unmount race 가드
- `web/src/app/(protected)/layout.tsx` (신규) — route group layout이 AuthGuard wrap
- `web/src/app/(protected)/page.tsx`, `(protected)/{logs,analysis,settings}/page.tsx` — 옛 비-그룹 라우트에서 이동. URL은 그대로(`/`, `/logs/`, `/analysis/`, `/settings/`)
- `web/src/app/(protected)/settings/page.tsx` — LogoutButton 포함한 "계정" 섹션 추가
- 삭제: `web/src/app/page.tsx`, `web/src/app/{logs,analysis,settings}/page.tsx`, 빈 디렉토리
- `docs/STORIES.md` — S07 ✅, task 설명에 ADR-5와 정합(IndexedDB→localStorage) 정정
- `docs/review/phase-1.md` — S07 리뷰 + 본인 판단
- `docs/history/phase-1.md` — 본 엔트리

**주요 결정:**
- **route group `(protected)`로 묶음** — `/`, `/logs/`, `/analysis/`, `/settings/`가 한 layout 안에서 AuthGuard 공유. URL 경로는 영향 없음. `/login/`, `/dev/*`는 그룹 밖이라 비보호.
- **AuthGuard는 클라이언트 hydration 후에만 판단** — SSR/static render에서는 항상 "loading"로 시작 → hydration mismatch 회피. 정적 산출물(`out/`)의 보호 페이지 HTML은 spinner만 포함.
- **STORIES.md 옛 task 표현 "IndexedDB 영속화" 정정** — ADR-5는 `JWT를 localStorage에 저장` 명시. SDK 기본 `LocalAuthStore`가 localStorage 사용. IndexedDB 미사용.
- **cross-tab logout 동기화** — PB SDK는 `storage` 이벤트 자체 발행 안 함. AuthGuard가 `window.addEventListener("storage", ...)`로 `pocketbase_auth` 키 변경 감지 → 다른 탭에서 logout 시 즉시 보호 라우트에서 빠짐.
- **mount race 가드** — `cancelled` 플래그(AuthGuard) + `mountedRef`(LoginPage). 진행 중 navigate에서 setState-after-unmount 회피.
- **로그인 폼 flash 방지** — `checkedAuth` state. 초기에는 spinner만 렌더, useEffect로 `isValid` 확인 후 form 또는 redirect 결정.

**Review 처리:** finding 7건 중:
- 즉시 수용 4건: state-set-after-unmount, cross-tab sync, login flash, login mount race
- Defer 1건: Settings에 이메일/버전 표시 (S08+)
- Skip 2건: BottomNav layout 끌어올림 / error message 표면 (현재 패턴 충분)
- 상세는 `docs/review/phase-1.md`

**다음 Story 영향:**
- **S08 (세션 모듈):** AuthGuard 안에서 자유롭게 mutation 호출. `pb.authStore.record?.id`로 user id 접근. 이미 보호 라우트에 있으므로 추가 가드 불필요.
- **S12 (오프라인 큐):** flush 시 `pb.authStore.isValid` 체크 후 진행. logout 상태에서 큐 retain.
- **S13 (배포):** PB admin UI의 CORS "Allowed origins"에 Cloudflare Pages 도메인 추가 필요. 로컬은 `http://localhost:3000`, `http://localhost:3001`.
- **S15 (Cloudflare Pages):** 정적 산출물의 보호 페이지가 spinner HTML이라 SEO/crawler 영향 있지만 솔로 PWA라 무관.

**Follow-up — 사용자 검증 (docker + Comet):**
1. 진행 중 docker compose / pnpm dev 그대로 두고
2. `http://localhost:3000/`로 접속 → 토큰 없으므로 자동으로 `/login/`로 이동 (spinner → 폼)
3. PB admin UI에서 만든 user의 이메일/비번 입력 → 로그인 → `/`로 이동
4. `/settings/`에서 로그아웃 → 즉시 `/login/`로 이동 (보호 라우트 차단)
5. 로그인 후 새로고침(F5) → 폼 안 보이고 곧바로 `/`에 머무름 (세션 유지)
6. 두 탭 열어서 한쪽에서 로그아웃 → 다른 탭이 자동으로 `/login/`로 (cross-tab sync 확인)
7. 검증 결과를 본 history에 ✅ 한 줄 추가.

