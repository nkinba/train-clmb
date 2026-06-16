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

---

## S05 — 2026-06-16

Reviewer: general-purpose subagent.

### 원문 요약

**Verdict:** Pass with required minor fixes. 토큰 맵·TW4 idiom·컴포넌트 모두 깔끔. 2개 실제 버그(focus-visible의 border-radius 덮어쓰기, TimerDisplay aria-live spam)와 1개 a11y 미흡(radio 그룹 arrow-key 없음)이 S08/S09 차단 가능. 스펙/구현 drift(doc 옛 namespace) 1건.

**Findings:**

1. **[major] `:focus-visible`가 `border-radius`를 6px로 덮음** (globals.css:151). 모든 포커스 요소의 모서리가 강제로 6px로 변경 → `rounded-md/lg/xl` 버튼의 ring이 모서리 불일치. 한 줄 삭제로 해결.

2. **[major] `TimerDisplay`의 `aria-live="polite"`가 매 초 SR 스팸** (timer-display.tsx:48). 7s 매달리기·90s 휴식 동안 사용 불가. `aria-live="off"`로 변경, S09에서 phase 전환 시점에만 별도 live region 띄우도록 TODO.

3. **[major] PainSelector/RpeSelector에 화살표 키 내비게이션 없음.** `role="radio*"` 선언했으나 `button[role=radio]`는 native arrow nav 없음. roving tabindex + ArrowLeft/Right/Up/Down 핸들러 추가 필요.

4. **[minor] design-tokens.md namespace drift** — 본 doc은 여전히 `bg.base`, `text.primary` 등 사용. S05 구현은 `--color-canvas`, `--color-fg-primary`로 옮김. doc 상단에 "S05에서 rename" 노트 + §10 historical 표기.

5. **[minor] §1.11 일부 state token 미반영** — `bg.selected`, `bg.pressed` 부재. S08 chips/filters에 필요. 선제 추가.

6. **[nit] `--ease-out-soft`, `--ease-in-soft` 선언했으나 사용 없음.** S08+에서 사용 시 해결. defer.

7. **[nit] `bottom-nav.tsx`가 불필요하게 `"use client"`.** hook/handler 없음 → server component로 만들고 home/logs/analysis/settings 클라이언트 번들 절감.

8. **[nit] PainSelector contrast** — 계산상 모두 AA 이상. 행위 없음. Comet 실측 시 confirm.

9. **[nit] RpeSelector `scale-105`가 grid gap에 살짝 overlap 가능성** — ring 방식으로 교체 권장.

10. **[nit] focus ring contrast vs canvas** — `#fb923c` on `#09090b` ≈ 7.0:1, WCAG UI 3:1 충족. OK.

11. **[pass]** viewport, lang="ko" 유지 확인.

12. **[pass]** static export 8 routes 정상.

13. **[info]** S06–S09 영향: S06 client/server 경계 강제 안 함. S08은 Sheet/Dialog/Chip이 추가로 필요(S08 자체 범위). S09는 Finding #2가 상속됨.

### 본인 판단

**즉시 수용 (S05 commit 전 처리):** 1, 2, 3, 4, 5, 7, 9

- 1: globals.css의 `border-radius` 1행 삭제.
- 2: timer-display.tsx의 `aria-live` → "off" + S09 TODO 주석.
- 3: roving tabindex + arrow key handler를 두 컴포넌트에 인라인 (공통 헬퍼는 YAGNI). 1D 모델: Arrow Left/Up=prev, Right/Down=next, Home=first, End=last.
- 4: docs/design-tokens.md 상단에 rename 노트 + §10 historical 표기.
- 5: `--color-bg-selected`, `--color-bg-pressed` 추가.
- 7: bottom-nav.tsx `"use client"` 제거.
- 9: `scale-105` → `ring-4 ring-fg-primary` 같은 ring 방식. scale 제거.

**Defer:** 6 (ease 토큰 미사용은 S08+ 첫 사용 시 자연 해결).

**무해/확인 완료:** 8, 10–13.

반박: 없음.
