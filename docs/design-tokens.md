# Design Tokens — Breakteau

본 토큰은 Tailwind config로 옮길 기준값. 다크 모드 우선, 라이트는 보조.
근거는 `UI.md` (한 손 조작·분필 손·암장 조명·풀스크린 타이머)에서 도출.

> **⚠️ S05 이후의 namespace 변경 (구현 ≠ 본 spec 문서):**
> Tailwind 4로 옮기면서 토큰 명을 다음과 같이 단축·정돈했다. 구현 진실값은
> `web/src/app/globals.css`이며, 본 문서는 의미 단위로 읽기 위한 spec.
>
> | 본 문서 (spec) | 구현 (`globals.css`) |
> |---------------|----------------------|
> | `bg.base` | `--color-canvas` |
> | `bg.surface` | `--color-surface` |
> | `bg.elevated` | `--color-elevated` |
> | `bg.subtle` | `--color-subtle` |
> | `text.primary/secondary/muted/disabled/inverse` | `--color-fg-primary/-secondary/-muted/-disabled/-inverse` |
> | `brand.primary/hover/active/onPrimary` | `--color-brand/-hover/-active`, `--color-on-brand` |
> | `bg.success/danger/warning` | `--color-success/-danger/-warning` |
> | `text.onSuccess/onDanger` | `--color-on-success/-on-danger` |
> | `border.default/strong/disabled` | `--color-border/-strong/-disabled` |
> | `focus.ring` (값) | `--shadow-focus-ring` |
> | `bg.selected/pressed` | `--color-bg-selected/-pressed` |
> | (기타 timer/status/pain/rpe) | 동일 접두 (`--color-timer-*`, `--color-pain-*`, `--color-rpe-*`) |
>
> §10 (구) "Tailwind 3 JS config" 예제는 historical. Tailwind 4 `@theme` 매핑은
> `globals.css`를 source of truth로 사용한다.

---

## 1. Color

### 1.1 Surface (다크 모드)
| Token | Hex | 용도 |
|-------|-----|------|
| `bg.base` | `#09090b` (zinc-950) | 화면 배경 |
| `bg.surface` | `#18181b` (zinc-900) | 카드·시트 |
| `bg.elevated` | `#27272a` (zinc-800) | 모달·상위 surface |
| `bg.subtle` | `#3f3f46` (zinc-700) | hover/active 미묘한 강조 |
| `border.default` | `#3f3f46` (zinc-700) | 카드 border |
| `border.strong` | `#52525b` (zinc-600) | focus 가능 요소 |

### 1.2 Surface (라이트 모드, 보조)
| Token | Hex |
|-------|-----|
| `bg.base` | `#fafafa` (zinc-50) |
| `bg.surface` | `#ffffff` |
| `bg.elevated` | `#f4f4f5` (zinc-100) |
| `border.default` | `#e4e4e7` (zinc-200) |

### 1.3 Text (다크 모드)
| Token | Hex | on bg.base contrast |
|-------|-----|---------------------|
| `text.primary` | `#fafafa` (zinc-50) | **18.6 : 1** (AAA) |
| `text.secondary` | `#a1a1aa` (zinc-400) | **7.96 : 1** (AAA) |
| `text.muted` | `#71717a` (zinc-500) | **4.65 : 1** (AA) |
| `text.disabled` | `#52525b` (zinc-600) | 2.87 : 1 (장식·비텍스트만) |
| `text.inverse` | `#09090b` | primary 위에 사용 |

### 1.4 Brand
| Token | Hex | 비고 |
|-------|-----|------|
| `brand.primary` | `#f97316` (orange-500) | 클라이밍 chalk/rock 톤, 주 액션 |
| `brand.primaryHover` | `#fb923c` (orange-400) | hover |
| `brand.primaryActive` | `#ea580c` (orange-600) | pressed |
| `brand.onPrimary` | `#09090b` | primary 배경 위 텍스트 |

### 1.5 Semantic — 타이머 단계 (UI.md §3.2)
| Token | Hex | 단계 |
|-------|-----|------|
| `timer.hang` | `#ef4444` (red-500) | 매달리기 (active) |
| `timer.rest` | `#10b981` (emerald-500) | 휴식 |
| `timer.countdown` | `#fbbf24` (amber-400) | 카운트다운 3s 경고 |

### 1.6 Semantic — 상태 (text/icon)
| Token | Hex | 용도 |
|-------|-----|------|
| `status.success` | `#10b981` (emerald-500) | 완등/성공 — text/icon |
| `status.danger` | `#f43f5e` (rose-500) | 실패/오류 — text/icon |
| `status.warning` | `#f59e0b` (amber-500) | deload 권고 등 — text/icon |
| `status.info` | `#3b82f6` (blue-500) | 정보·동기화 진행 |
| `status.offline` | `#a1a1aa` (zinc-400) | 오프라인 인디케이터 |

### 1.7 Semantic — 상태 (배경, 이항 선택 버튼용)
긍정적 액션이 **두 패턴**으로 분리됨:
- **Primary CTA** (예: "세션 시작", "완등!") → `brand.primary` 사용. 모듈의 주 목표 강조.
- **Binary state choice** (예: 행보드 세트 결과의 성공/실패) → 아래 `bg.*` 토큰. 두 선택이 동등 무게.

| Token | Hex | on-text | 용도 |
|-------|-----|---------|------|
| `bg.success` | `#10b981` (emerald-500) | `#09090b` | 성공 버튼 (이항) |
| `bg.danger` | `#f43f5e` (rose-500) | `#09090b` | 실패 버튼 (이항) |
| `bg.warning` | `#f59e0b` (amber-500) | `#09090b` | 경고 배너 |
| `text.onSuccess` | `#09090b` | — | bg.success 위 텍스트 |
| `text.onDanger` | `#09090b` | — | bg.danger 위 텍스트 |

### 1.8 통증 스케일 (PRD 0–3)
brand.primary와의 시각적 충돌 회피를 위해 pain.2는 amber-500 사용 (brand orange-500과 구별).

| 값 | Token | Hex | 의미 |
|----|-------|-----|------|
| 0 | `pain.0` | `#71717a` (zinc-500) | 없음 |
| 1 | `pain.1` | `#facc15` (yellow-400) | 약함 |
| 2 | `pain.2` | `#f59e0b` (amber-500) | 보통 |
| 3 | `pain.3` | `#dc2626` (red-600) | 강함 — deload 신호 |

### 1.9 RPE 스케일 (PRD 1–10)
운동강도 자각도. 4-band로 단순화하여 시각 부하 최소화.

| RPE | Token | Hex | 의미 |
|-----|-------|-----|------|
| 1–3 | `rpe.easy` | `#10b981` (emerald-500) | 쉬움·웜업 |
| 4–6 | `rpe.moderate` | `#f59e0b` (amber-500) | 보통 |
| 7–8 | `rpe.hard` | `#f97316` (orange-500) | 어려움 |
| 9–10 | `rpe.max` | `#f43f5e` (rose-500) | 최대 노력 — 부상 위험대 |

### 1.10 핵심 contrast 조합 (WCAG 검증)
수치는 WCAG 2.1 relative luminance 공식 직접 계산값 (subagent 검증).

| 조합 | 비율 | 등급 |
|------|------|------|
| `text.primary` (#fafafa) on `bg.base` (#09090b) | 19.1 : 1 | AAA |
| `text.primary` on `bg.surface` (#18181b) | 17.0 : 1 | AAA |
| `text.secondary` (#a1a1aa) on `bg.base` | 8.0 : 1 | AAA |
| `text.secondary` on `bg.surface` | 7.3 : 1 | AAA |
| `text.muted` (#71717a) on `bg.base` | 4.65 : 1 | AA |
| `brand.onPrimary` (#09090b) on `brand.primary` (#f97316) | 7.4 : 1 | AAA |
| `timer.hang` (#ef4444) on `bg.base` | 5.4 : 1 | AA (large + small text) |
| `timer.rest` (#10b981) on `bg.base` | 8.1 : 1 | AAA |
| `timer.countdown` (#fbbf24) on `bg.base` | 12.2 : 1 | AAA |

> 구현 후 Comet MCP로 실측 재확인 (CLAUDE.md 브라우저 검증 절차).

---

## 1.11 State 토큰
입력·버튼·카드의 상호작용 상태.

| Token | 값 | 용도 |
|-------|-----|------|
| `focus.ring` | `2px solid #fb923c` (brand.primaryHover) + 2px offset | 키보드 포커스 표시 — 분필 손가락 대비 visual confirm 필요 |
| `bg.disabled` | `#27272a` (zinc-800) | 비활성 버튼 배경 |
| `border.disabled` | `#3f3f46` (zinc-700) | 비활성 입력 |
| `opacity.disabled` | 0.5 | 텍스트·아이콘 disabled 처리 |
| `bg.skeleton` | `#27272a → #3f3f46` (1.2s linear infinite) | 로딩 shimmer |
| `bg.selected` | `rgba(249, 115, 22, 0.15)` | 칩·필터 active 상태 (brand 반투명) |
| `bg.pressed` | `rgba(255, 255, 255, 0.08)` | 터치 ripple 대용 (모바일 active feedback) |

---

## 2. Spacing

8pt 그리드 기반. Tailwind 기본 스케일 유지.

| Token | px | rem | 용도 |
|-------|----|-----|------|
| `space.0` | 0 | 0 | reset |
| `space.1` | 4 | 0.25 | icon gap |
| `space.2` | 8 | 0.5 | inline gap |
| `space.3` | 12 | 0.75 | tight padding |
| `space.4` | 16 | 1 | 기본 padding |
| `space.5` | 20 | 1.25 | 카드 내부 |
| `space.6` | 24 | 1.5 | 섹션 gap |
| `space.8` | 32 | 2 | 그룹 분리 |
| `space.12` | 48 | 3 | 큰 섹션 |
| `space.16` | 64 | 4 | 화면 여백 |

---

## 3. Touch Targets

UI.md §1: 한 손 + 분필 손 → 최소 48dp, 핵심 액션은 56dp+.

| Token | px | 용도 |
|-------|----|------|
| `tap.min` | 48 | WCAG AA 최소 |
| `tap.default` | 56 | 일반 버튼 (한 손 안전 마진) |
| `tap.hero` | 80 | 타이머 일시정지·세트 결과 성공/실패 버튼 |
| `tap.bottomNav` | 64 | 하단 탭 (높이) |

---

## 4. Typography

폰트 스택: 시스템 sans + tabular-nums (타이머 등 숫자 정렬).

```css
--font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
--font-mono: ui-monospace, SFMono-Regular, "Menlo", monospace;
```

### 4.1 스케일
| Token | px | rem | line-height | 용도 |
|-------|----|----|-------------|------|
| `text.timer` | **160** | 10 | 1 | 풀스크린 타이머 거대 숫자 (`tabular-nums`) |
| `text.display` | 48 | 3 | 1.1 | 화면 헤더 핵심 숫자 (오늘 세션 수 등) |
| `text.h1` | 30 | 1.875 | 1.2 | 페이지 제목 |
| `text.h2` | 24 | 1.5 | 1.25 | 섹션 제목 |
| `text.h3` | 20 | 1.25 | 1.3 | 카드 제목 |
| `text.body` | 16 | 1 | 1.5 | 본문 (모바일 기본) |
| `text.bodyLg` | 18 | 1.125 | 1.5 | 강조 본문 (입력 라벨) |
| `text.caption` | 14 | 0.875 | 1.4 | 메타 정보 |
| `text.micro` | 12 | 0.75 | 1.3 | 배지·통계 캡션 |

### 4.2 Weight
| Token | weight |
|-------|--------|
| `font.regular` | 400 |
| `font.medium` | 500 |
| `font.semibold` | 600 |
| `font.bold` | 700 |

타이머 거대 숫자는 `font.bold` + `tabular-nums` 강제.

---

## 5. Radius

| Token | px | 용도 |
|-------|----|------|
| `radius.sm` | 6 | 입력 필드·작은 버튼 |
| `radius.md` | 10 | 카드 |
| `radius.lg` | 16 | 시트·모듈 타일 |
| `radius.xl` | 24 | 모달·풀스크린 시트 |
| `radius.full` | 9999 | 원형 (배지, 아이콘 버튼) |

---

## 6. Shadow

다크 모드는 그림자 효과가 약함 → border + 살짝 elevated bg를 우선 사용. 그림자는 다음만.

| Token | 값 | 용도 |
|-------|-----|------|
| `shadow.sm` | `0 1px 2px rgba(0,0,0,0.4)` | 카드 hover |
| `shadow.md` | `0 4px 8px rgba(0,0,0,0.5)` | 시트 |
| `shadow.lg` | `0 12px 24px rgba(0,0,0,0.6)` | 모달 |
| `shadow.glow.primary` | `0 0 16px rgba(249,115,22,0.4)` | 주 액션 강조 (타이머 일시정지) |
| `shadow.glow.danger` | `0 0 24px rgba(239,68,68,0.5)` | 매달리기 페이즈 강조 |

---

## 7. Motion

| Token | 값 | 용도 |
|-------|-----|------|
| `motion.fast` | 100ms | 미세 hover/active |
| `motion.base` | 150ms | 일반 transition |
| `motion.slow` | 300ms | 시트·모달 |
| `motion.timerTick` | 1000ms (linear) | 초 카운트 |
| `ease.out` | `cubic-bezier(0.16, 1, 0.3, 1)` | enter |
| `ease.in` | `cubic-bezier(0.7, 0, 0.84, 0)` | exit |

`prefers-reduced-motion: reduce` 시 모든 transition `motion.fast`로 다운그레이드, 깜빡임 효과(`shadow.glow.*`) 제거.

---

## 8. Breakpoints

모바일 우선. lg 이상은 분석 화면만 데스크톱 친화 고려.

| Token | min-width | 기준 |
|-------|-----------|------|
| (base) | 0 | 320px iPhone SE 1세대까지 동작 보장 |
| `xs` | 360px | 대다수 Android baseline |
| `sm` | 390px | iPhone 14/15 (디자인 기준) |
| `md` | 768px | iPad portrait |
| `lg` | 1024px | iPad landscape, 데스크톱 분석 |

---

## 9. Z-Index 계층

| Token | 값 | 용도 |
|-------|----|------|
| `z.base` | 0 | 기본 |
| `z.bottomNav` | 40 | 하단 탭 |
| `z.offlineBar` | 50 | 상단 오프라인 인디케이터 |
| `z.sheet` | 60 | 바텀 시트 |
| `z.modal` | 70 | 다이얼로그 |
| `z.toast` | 80 | 토스트 |
| `z.fullscreenTimer` | 90 | 풀스크린 타이머 (최상위) |

---

## 10. Tailwind 매핑 가이드 (Historical — Tailwind 3 JS config 예제)

> 이 절은 S04 이전 Tailwind 3 가정 하에 작성됐다. Tailwind 4로 migration된 현재
> source of truth는 `web/src/app/globals.css`의 `@theme` 블록이다. 아래는 참고용
> 보관.

`tailwind.config.ts`로 옮길 때 `theme.extend`에 추가. 기본 색상 팔레트(zinc/orange/red 등)는 Tailwind 기본을 그대로 사용하고, 본 프로젝트 고유 토큰만 extend.

```ts
// tailwind.config.ts (전체 매핑 — S05에서 copy-paste)
import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    screens: {
      xs: '360px',
      sm: '390px',
      md: '768px',
      lg: '1024px',
    },
    extend: {
      colors: {
        bg: {
          base: '#09090b',
          surface: '#18181b',
          elevated: '#27272a',
          subtle: '#3f3f46',
          success: '#10b981',
          danger: '#f43f5e',
          warning: '#f59e0b',
          disabled: '#27272a',
          selected: 'rgba(249, 115, 22, 0.15)',
          pressed: 'rgba(255, 255, 255, 0.08)',
        },
        text: {
          primary: '#fafafa',
          secondary: '#a1a1aa',
          muted: '#71717a',
          disabled: '#52525b',
          inverse: '#09090b',
          onSuccess: '#09090b',
          onDanger: '#09090b',
        },
        brand: {
          DEFAULT: '#f97316',
          hover: '#fb923c',
          active: '#ea580c',
          on: '#09090b',
        },
        timer: {
          hang: '#ef4444',
          rest: '#10b981',
          countdown: '#fbbf24',
        },
        status: {
          success: '#10b981',
          danger: '#f43f5e',
          warning: '#f59e0b',
          info: '#3b82f6',
          offline: '#a1a1aa',
        },
        pain: {
          0: '#71717a',
          1: '#facc15',
          2: '#f59e0b',
          3: '#dc2626',
        },
        rpe: {
          easy: '#10b981',
          moderate: '#f59e0b',
          hard: '#f97316',
          max: '#f43f5e',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        timer: ['10rem', { lineHeight: '1', fontWeight: '700' }],
        display: ['3rem', { lineHeight: '1.1' }],
        h1: ['1.875rem', { lineHeight: '1.2' }],
        h2: ['1.5rem', { lineHeight: '1.25' }],
        h3: ['1.25rem', { lineHeight: '1.3' }],
        body: ['1rem', { lineHeight: '1.5' }],
        bodyLg: ['1.125rem', { lineHeight: '1.5' }],
        caption: ['0.875rem', { lineHeight: '1.4' }],
        micro: ['0.75rem', { lineHeight: '1.3' }],
      },
      spacing: {
        tap: '3rem',          // 48px min
        'tap-default': '3.5rem', // 56px
        'tap-hero': '5rem',   // 80px
        'tab-bar': '4rem',    // 64px bottom nav
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '16px',
        xl: '24px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0,0,0,0.4)',
        md: '0 4px 8px rgba(0,0,0,0.5)',
        lg: '0 12px 24px rgba(0,0,0,0.6)',
        'glow-primary': '0 0 16px rgba(249,115,22,0.4)',
        'glow-danger': '0 0 24px rgba(239,68,68,0.5)',
        'focus-ring': '0 0 0 2px #09090b, 0 0 0 4px #fb923c',
      },
      transitionDuration: {
        fast: '100ms',
        base: '150ms',
        slow: '300ms',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
        in: 'cubic-bezier(0.7, 0, 0.84, 0)',
      },
      zIndex: {
        bottomNav: '40',
        offlineBar: '50',
        sheet: '60',
        modal: '70',
        toast: '80',
        fullscreenTimer: '90',
      },
      opacity: {
        disabled: '0.5',
      },
      keyframes: {
        skeleton: {
          '0%, 100%': { backgroundColor: '#27272a' },
          '50%': { backgroundColor: '#3f3f46' },
        },
      },
      animation: {
        skeleton: 'skeleton 1.2s linear infinite',
      },
    },
  },
} satisfies Config;
```

**S05 작업 시 주의:**
- `prefers-reduced-motion: reduce`는 글로벌 CSS로 별도 처리 (Tailwind에서 toggle 어려움).
- `focus-ring`은 shadow로 구현해 layout shift 없음. 사용 예: `focus-visible:shadow-focus-ring focus-visible:outline-none`.
- pain·rpe 토큰은 차트(Recharts)에서도 같은 값으로 사용.
