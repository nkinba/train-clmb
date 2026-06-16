# Google Stitch Prompts — Climb-Forge

본 문서의 prompt를 Google Stitch에 그대로 입력하여 화면 mock을 생성한다.
산출물(이미지/Figma 링크)은 `docs/design/` 아래에 화면명으로 저장.

근거 문서: `docs/UI.md` (와이어프레임), `docs/design-tokens.md` (색·간격·타이포).

---

## 공통 컨텍스트 (모든 prompt에 prefix)

```
Design context:
- Mobile-first PWA for solo climbing training tracker
- Frame: iPhone 14 portrait, 390×844px
- Dark mode default (NEVER light mode)
- Background #09090b (zinc-950), surface #18181b (zinc-900), elevated #27272a (zinc-800)
- Primary text #fafafa, secondary #a1a1aa, muted #71717a
- Brand orange #f97316 for **primary CTAs** (single positive goal: "세션 시작", "완등!")
- Emerald #10b981 + rose #f43f5e for **binary state choices** (equal-weight choice: 성공/실패 buttons on hangboard set result). Both are background colors with text #09090b on top.
- Min touch target 48dp, primary actions 56dp+
- Hero actions (timer pause, set success/fail) 80dp tall
- Bottom tab nav (64dp), 4 tabs: 오늘 / 기록 / 분석 / 설정
- Korean text labels
- Portrait orientation locked
- Thumb-reachable zone is bottom 1/3 — primary actions live there
- Use tonal hierarchy (border + slightly elevated bg), NOT large shadows
- Typography: system sans, tabular-nums for numeric displays
- Avoid glassmorphism, neumorphism, gradients on backgrounds
```

---

## Screen 1 — 홈 (오늘 탭)

**Filename:** `home-today.png`

```
Generate a mobile screen design based on the common context above.

Screen: Home / Today tab.

Layout (top to bottom):
1. Status bar (system).
2. Offline indicator strip — thin (24dp), full-width, bg #27272a (zinc-800, elevated), text #a1a1aa "오프라인 · 큐 2개" with small dot icon at left in #f59e0b (amber-500). Only when offline; show in this mock.
3. Main content (16dp padding):
   - Large primary CTA button "+ 세션 시작" (full-width, 56dp, brand orange bg, dark text).
   - Section title "최근 7일" (text.h2, 24dp top margin).
   - Stats card (radius.md, bg.surface, 16dp padding): 3 inline stats — "행보드 4세션", "등반 2회", "통증 평균 0.5". Each label is text.caption (muted), value text.h3.
   - Section title "모듈" (text.h2, 24dp top margin).
   - 2x2 grid of module tiles (radius.lg, bg.surface, 1px border zinc-700, square, gap 12dp):
     - 행보드 (icon: dumbbell-like)
     - 등반 (icon: mountain)
     - 보조 (icon: barbell)
     - 캠퍼스 (icon: ladder)
   - Each tile has icon (32dp) centered, label below in text.bodyLg.
4. Bottom tab nav (fixed, 64dp): 오늘 (active, orange icon+label) / 기록 / 분석 / 설정. Inactive tabs use text.muted.

Tone: utilitarian, gym-friendly, no decoration. Focus on legibility and one-hand reach.
```

---

## Screen 2 — 행보드 인터벌 타이머

**Filename:** `hangboard-timer.png`

```
Generate a mobile screen design based on the common context above.

Screen: Hangboard interval timer (fullscreen).

Layout (top to bottom):
1. Status bar (system, but the screen is fullscreen so consider it as overlay).
2. Top context strip (16dp padding):
   - Left: "세트 3 / 5" (text.bodyLg, semibold).
   - Right: "하프 크림프 · 18mm · +5kg" (text.caption, muted).
3. Center HERO area (flex 1, vertically centered):
   - Massive number "0:08" — font-size 10rem (160px), bold, tabular-nums, color #ef4444 (timer.hang).
   - Below: label "매달리기" in text.h2, color #ef4444.
   - Subtle red glow shadow around the number (shadow.glow.danger).
4. Bottom action row (16dp padding, gap 12dp):
   - Two buttons side by side, EACH 80dp tall, full-width split:
     - "일시정지" (bg #27272a elevated, text #fafafa)
     - "종료" (2px border #f43f5e (status.danger / rose-500), transparent bg, text #f43f5e)

Hide bottom tab nav (fullscreen mode).
Background: pure #09090b. No gradient. The number itself is the focal point.
```

---

## Screen 3 — 세트 결과 입력 (매달리기 직후)

**Filename:** `set-result.png`

```
Generate a mobile screen design based on the common context above.

Screen: Set result entry (appears immediately after hang phase ends).

Layout (top to bottom):
1. Status bar.
2. Top header (16dp padding):
   - Title "세트 3 결과" (text.h1).
   - Below: "하프 크림프 · 18mm · +5kg" (text.caption, muted).
3. Two LARGE buttons stacked, each taking ~40% of viewport height. This is a binary state choice (equal weight), so both use saturated semantic colors:
   - Top button "✓ 성공" — bg #10b981 (bg.success / emerald-500), text #09090b, icon checkmark 48dp, label text.h1 600 weight.
   - Bottom button "✗ 실패" — bg #f43f5e (bg.danger / rose-500), text #09090b, icon X 48dp, label text.h1. Below the label in text.caption muted (rgba(9,9,11,0.7)): "길게 눌러 버틴 초 입력".
4. Bottom safe area.

No bottom tab nav (modal context).
Buttons should feel "thumbable" — large with rounded corners (radius.lg).
```

---

## Screen 4 — 등반 빠른 입력 (볼더링)

**Filename:** `bouldering-quick-input.png`

```
Generate a mobile screen design based on the common context above.

Screen: Bouldering quick entry for current project.

Layout (top to bottom):
1. Status bar.
2. Top header card (radius.md, bg.surface, 16dp padding, 16dp margin):
   - Label "프로젝트" (text.caption, muted).
   - Value "V7 노란 슬랩" (text.h2). Small pencil icon at right for edit.
   - Below: stat chips inline — "누적 시도 4 · 완등 0" (text.caption, muted).
3. Two stacked LARGE buttons (16dp padding sides, 12dp gap):
   - "+ 시도" — 80dp tall, bg.elevated, text.primary, plus icon 32dp left of label.
   - "✓ 완등!" — 80dp tall, bg brand orange (#f97316), text.inverse, checkmark icon 32dp.
4. Below buttons (24dp top margin):
   - "노트 추가" link button (transparent, text.secondary, underline).
5. Bottom tab nav visible (기록 tab active, orange).

Make the two main buttons unmistakable — they are the only meaningful actions on this screen.
```

---

## Screen 5 — 분석 (분석 탭)

**Filename:** `analysis.png`

```
Generate a mobile screen design based on the common context above.

Screen: Analysis tab, vertical scrolling charts.

Layout (top to bottom):
1. Status bar.
2. Header (16dp padding):
   - Title "분석" (text.h1).
   - Period filter chips inline: 1M / 3M / 6M / 1Y (current "3M" active with brand bg, others bg.elevated with text.muted). Each chip 32dp tall.
3. Chart cards (radius.lg, bg.surface, 16dp padding, 12dp vertical gap):
   - Card 1: "그립별 최대 +kg" (text.h3 title). Inside: line chart with 2 lines — "하프 크림프" (orange #f97316), "오픈 핸드" (blue #3b82f6). X-axis labels month names, Y-axis kg values. Show small dots as PR markers.
   - Card 2: "주간 등반 볼륨" (title). Bar chart with weekly bars, brand orange.
   - Card 3: "통증 빈도" (title). Monthly calendar heatmap, cells colored by pain scale 0–3 (#71717a / #facc15 / #f97316 / #dc2626).
   - Card 4: "프로젝트 시도" (title). Timeline with rows per project, dots for attempts (small), filled stars for sends.
4. Bottom tab nav (분석 active).

Charts should be data-dense but readable on 390px width. Use minimal grid lines.
Y-axis labels use text.caption muted. Chart titles text.h3.
```

---

## 사용 절차

1. Stitch 접속, 새 디자인.
2. 공통 컨텍스트를 system/intro prompt로 입력.
3. 각 화면 prompt를 차례로 실행.
4. 결과를 PNG로 export, 파일명대로 `docs/design/` 아래 저장.
5. 저장 후 `docs/STORIES.md`의 S03 Out of scope 항목을 ✅로 마킹.
6. mock과 design-tokens.md 사이 불일치 발견 시 토큰을 mock 기준으로 조정 (mock이 실측).
