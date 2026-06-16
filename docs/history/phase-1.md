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
