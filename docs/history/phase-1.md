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

