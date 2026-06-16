# Phase 0 — Review

## S03 — 2026-06-16

Reviewer: general-purpose subagent (independent, no prior context).

### 원문 요약

**Verdict:** Pass with notes. 4개 AC 모두 충족. S04(부트스트랩)에는 영향 없으나, S05(디자인 시스템 구현) 전 다음 5개는 수정 필요.

**Findings (severity 분류):**

1. **[major] 잘못된 contrast 수치** — 수동 luminance 계산 결과:
   - `#ef4444` on `#09090b`: 명시 4.55, 실제 ~5.36 (과소)
   - `#10b981` on `#09090b`: 명시 6.50, 실제 ~8.06 (과소)
   - `brand.onPrimary` on `brand.primary`: 명시 8.5, 실제 ~7.4 (과대)
   - 나머지(`#fafafa`, `#a1a1aa`, `#fbbf24`)는 ±5% 이내로 정확.

2. **[major] Stitch가 `bg.success` 토큰 참조하지만 미정의** — STITCH_PROMPTS.md:108에서 `#10b981`을 background로 사용하지만 `status.success`는 text/icon용으로만 정의. 또한 "성공" 버튼(emerald)과 "완등" 버튼(brand orange)이 동등한 positive action으로 충돌 — 명시적 결정 필요.

3. **[major] `pain.2`가 brand.primary와 동일** — 둘 다 `#f97316`. 분석 화면 통증 히트맵에서 pain-2 셀과 CTA가 시각적으로 동일 → 경고 의미 손실. amber-500(`#f59e0b`)로 교체 권장.

4. **[major] RPE 1–10 시각 처리 부재** — PRD `*_logs.rpe`와 UI.md §3.3 RPE 카드 언급되나 토큰에 RPE 색 스케일 없음. S09–S11에서 필요.

5. **[major] state 토큰 부재** — `focus.ring`, `bg.disabled`, `opacity.disabled`, skeleton/shimmer 색 없음. 분필/땀 손가락 + PWA 오프라인 UX에서 focus·disabled 가독성 중요.

6. **[minor] Tailwind 예시 스니펫 미완성** — `tailwind.config.ts` 예제가 brand/timer/pain/fontSize 일부만 포함. surface·text·shadow·motion·z-index·screens·radius 모두 누락 — S05에서 다시 derive할 위험.

7. **[minor] motion/easing/z-index Tailwind 매핑 미명시** — `transitionDuration`, `transitionTimingFunction`, `zIndex` 키 명시 필요 (#6과 묶임).

8. **[minor] 하단 탭 라벨 불일치** — UI.md/STITCH는 "오늘/기록/분석/설정" 4탭, STORIES.md S05는 "4개 모듈 + 대시보드 자리" (5개?)로 표기. STORIES.md 표현이 모호.

9. **[minor] 타이머 "종료" 버튼의 red 색상 모호** — `#ef4444`(timer.hang)와 `#f43f5e`(status.danger) 중 미지정.

10. **[nit] 오프라인 인디케이터 시각 무게 과함** — STITCH는 zinc-400 bg → 다크 모드에서 매우 밝은 바. UI.md는 "얇은 띠"만 명시. bg.elevated + text.muted가 적절.

11. **[nit] xs breakpoint 라벨 오기** — `360px = iPhone SE 1세대`라 했으나 SE1은 320px. 360은 Android baseline.

12. **[nit] Stitch 공통 컨텍스트가 system status bar 렌더링 지시** — PWA지만 mock 충실도용. 무해.

**우선순위 권고:** 2, 3, 4, 5, 6은 S05 시작 전 반드시. 1도 정확성 위해 같이 처리. 나머지는 nice-to-have.

### 본인 판단

전체 12건 모두 **수용**. 반박 없음. 근거:
- 1번: 직접 luminance 계산 결과 → 객관적 수치 오류. 수정.
- 2번: positive action 의미가 두 패턴(primary CTA vs binary state choice)로 분리됨을 명시하고, `bg.success`/`bg.danger`/`text.onSuccess`/`text.onDanger` 토큰 추가. 세트 결과 화면의 성공/실패 버튼은 emerald/rose 유지 (binary choice 의미), 볼더링 완등은 brand orange 유지 (primary CTA 의미). 두 패턴 차이를 토큰 문서에 박음.
- 3번: pain.2를 `#f59e0b` (amber-500)로 교체.
- 4번: RPE를 4-band로 정의 (1–3 emerald / 4–6 amber / 7–8 orange / 9–10 rose).
- 5번: state 토큰 섹션 신설.
- 6번: tailwind config 예제를 완전 매핑으로 확장.
- 8번: STORIES.md S05 설명을 "BottomNav (오늘/기록/분석/설정 4탭)"으로 정정.
- 9번: "종료" 버튼은 `#f43f5e` (status.danger)로 고정.
- 10번: 오프라인 strip을 bg.elevated + text.muted로 수정.
- 11번: device label 제거, 단순히 "360px 모바일 최소"로 변경.

수정 후 commit 시 `S03: ` prefix + 본 review에 대한 추적성 확보 (커밋 메시지에 review 파일 언급).
