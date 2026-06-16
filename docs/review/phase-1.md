# Phase 1 — Review

## S04 — 2026-06-16

Reviewer: general-purpose subagent (independent, no prior context).

### 원문 요약

**Verdict:** Pass with notes. AC 모두 정적 검증 가능 범위 충족. Comet MCP 라이브 검증은 사용자 영역. 즉시 수정 3건 + S05 이후 처리 4건 + 정보 노트 다수.

**Findings:**

1. **[major] SW가 `/`만 캐시하지만 `trailingSlash:true`로 인해 `/index.html` 직접 요청 시 miss 가능.** `sw.js:8-13` SHELL_URLS에 `/index.html`도 추가하고 navigation fallback도 `/` → `/index.html` 순으로.

2. **[major] Hashed asset / cached HTML mismatch 미처리.** 재배포 시 `_next/static/chunks/<old-hash>.js`가 캐시에 남아있으면서 새 HTML이 새 hash를 참조해 broken. ADR-4의 Workbox precacheAndRoute가 정식 해법. S04는 baseline이므로 TODO(S12) 주석으로 명시.

3. **[major] skipWaiting + clients.claim이 진행 중 탭의 chunk를 갈아끼움.** PRD 타이머·기록 워크플로우와 충돌 가능. S04는 baseline 허용, S12에서 "update available, reload" UI 도입 예정. TODO 명시.

4. **[minor] viewport `userScalable: false` + `maximumScale: 1`** (layout.tsx:24-25). 저시력 사용자에게 적대적, WCAG 1.4.4 fail. iOS input zoom은 globals.css의 16px 규칙으로 이미 해결됨 → 굳이 막을 이유 없음.

5. **[minor] `text-text-primary` 토큰 명명이 어색** — 정상 동작은 확인 (`out/_next/static/chunks/3wo1sw_5w8xq1.css`에서 빌드 결과 검증). S05에서 `--color-fg-primary` 등으로 재명명 검토.

6. **[minor] `@custom-variant dark (&:where(.dark, .dark *));` 미설정.** Tailwind 4 class-based dark mode 진입을 위해 필요. S05 첫 커밋에 포함.

7. **[minor] `bg.surface`, `bg.elevated`, `brand-hover` 토큰 선언되었으나 utility 미사용.** S05에서 사용 시 해결.

8. **[minor] Maskable icon 80% 안전영역 정확.** `icon-maskable.svg:3` `translate(51 51) scale(0.8)` → 80%×80% 중앙 정렬. OK.

9. **[minor] PNG fallback 없음.** SVG-only는 modern Android/Chrome + iOS 16+ OK. Lighthouse PWA audit 등이 192/512 PNG 요구할 수 있음. 사용자 Comet 검증 시 install banner 안 뜨면 PNG 추가.

10. **[minor] `appleWebApp.capable` deprecated (iOS 11.3+)이지만 Next가 `mobile-web-app-capable`도 함께 emit.** 자동 처리됨, action 없음.

11. **[nit] components.json 있지만 shadcn deps 미설치.** `npx shadcn add ...` 시점에 lazy install. `cn()` 헬퍼는 이미 있음.

12. **[nit] `src/components/ui`, `src/hooks` 빈 디렉토리 없음.** shadcn add 시 자동 생성. 무해.

13. **[nit] robots.txt, _headers, _redirects 없음.** S15 (Cloudflare Pages) 영역.

14. **[nit] 기본 scaffold 파일(next.svg, vercel.svg) 제거됨.** Clean.

15-17. **[info]** Static export 호환성·SW prod guard·하드코딩 secret 없음 — 모두 정상.

### 본인 판단

**즉시 수용 (S04 commit 전 처리):** 1, 2, 3, 4
- 1: SHELL_URLS에 `/index.html` 추가. navigation fallback 순서 변경.
- 2: `sw.js` 상단에 TODO(S12) 주석 — Workbox 마이그레이션 + hashed asset 처리 명시.
- 3: 같은 TODO에 reload prompt 도입 예정 명시.
- 4: `userScalable: false`, `maximumScale: 1` 삭제. `viewportFit: "cover"` 유지.

**S05로 이월:** 5 (token 명명), 6 (dark variant), 7 (unused tokens 사용)

**사용자 검증 시 확인:** 9 (Lighthouse PWA audit)

**자동 처리 / 무해:** 8, 10–14

**대기 (다른 Story):** 13 (S15 deploy), 15 (info)

반박: 없음. 모든 finding이 사실 기반이고, 즉시/이월 분류도 합리적.
