# Prototype — Phase 0~4 Archive

본 디렉토리는 **Breakteau 프로젝트의 prototype 단계 (Phase 0–4) 산출물 아카이브**입니다. 2026-06-22에 prototype 종료 — v1.1 launch + CI/CD 가동까지 — 시점에 history/review 전체를 이 위치로 이관해 "현재 살아있는 문서"와 "회고/기록 문서"를 분리했습니다.

## 구조

```
prototype/
├── README.md           ← 이 파일 (회고 + 전환 가이드)
├── history/
│   ├── phase-0.md      문서·디자인 선행 (PRD, ADR 1-8, 디자인 토큰)
│   ├── phase-1.md      인프라·스캐폴딩 (S04 부트스트랩 ~ S07 인증)
│   ├── phase-2.md      기능 (S08 세션 ~ S12 오프라인 큐, S19/S20/S22/S23 follow-up)
│   ├── phase-3.md      배포 (S13 VM/Caddy ~ S15 정적 서빙)
│   └── phase-4.md      v1.1 (S16 분석, S18 A/B/C 미디어, S25 timeline UX)
└── review/
    └── phase-0~4.md    각 Story별 subagent 리뷰 + 본인 판단 기록
```

## Phase 회고 요약

### Phase 0 — 문서·디자인 (Ultraplan)
PRD/ADR 1-8 작성, 디자인 토큰 + Stitch prompt. 전체 프로젝트의 컨텍스트 기준을 잡은 단계.

### Phase 1 — 인프라·스캐폴딩 (S04–S07)
Next.js + Tailwind v4 + PocketBase docker compose + 인증. **결정적 트레이드오프**: PocketBase 단일 바이너리 채택으로 Supabase 의존 회피 (ADR-1) + 정적 export 채택으로 hosting 자유도 확보 (ADR-3).

### Phase 2 — 핵심 기능 (S08–S12, S19/S20/S22/S23)
- S09 행보드 타이머가 가장 복잡 (Wake Lock + Audio + Vibration + SW 백그라운드 알림)
- S12 오프라인 큐 (IndexedDB) — S18-B 미디어는 여전히 통합 안 됨 (follow-up)
- S19 /logs 페이지 + 정적 export 호환 dynamic route (useSearchParams + Suspense)
- S20 picker UX → S22 PB 데이터테이블로 진화 — 운영 중 짐/타깃 추가 가능
- S23 활성 세션 페이지를 모듈 카드 → "+ 운동 추가" + timeline으로 재구조화

### Phase 3 — 배포 (S13–S15)
GCP VM (e2-micro / us-west1) + Docker Compose + Caddy 자동 SSL. ADR-3 결정 변경: Cloudflare Pages → GCP VM Caddy로 단일 인프라 일원화 (ADR-2 "외부 종속 최소화" 정합).

### Phase 4 — v1.1 (S16, S18 A/B/C, S25, S24)
- S16 분석 차트 (Recharts 5종)
- S18-A GCS file storage 전환 — 처음엔 R2 가려다 콘솔 작동 불가 + 1인 운영 비용 trivial로 GCS 재변경 (ADR-6 3차 갱신)
- S18-B 미디어 컬렉션 + XHR 업로드 (PB SDK는 progress 미지원)
- S18-C lightbox + 그리드 + /library + BottomNav 5탭
- S25 timeline 미디어 row UX 보강
- S24 프로젝트명 climb-forge → Breakteau 일괄 리브랜딩

## 결정 변경 이력 (특히 ADR-3 / ADR-6)

| 시점 | 결정 | 사유 |
|---|---|---|
| 2026-06-13 | ADR-3 초안: Cloudflare Pages 프론트 | 자동 배포 + edge CDN 이점 |
| 2026-06-17 | ADR-3 갱신: VM Caddy로 일원화 | ADR-2 "외부 종속 최소화" + 단일 hostname tree로 운영성 ↑ |
| 2026-06-12 | ADR-6 초안: GCS (백업 + 미디어 미정) | SA metadata 인증 |
| 2026-06-17 | ADR-6 갱신: R2 (미디어 적극 사용 → egress 무료 우세) | 폼 분석 영상 반복 재생 가정 |
| 2026-06-19 | ADR-6 재갱신: R2 → GCS (콘솔 작동 불가 + 1인 비용 trivial) | 운용 가능성 + 1인 단계 cost trivial |

## v1.1 launch 회고 (2026-06-21~22)

운영 first deploy에서 발견된 비자명 함정 (`docs/learning/v1.1-deployment-qa.md`에 상세):

1. **CSP img-src/media-src 누락** — 두 hostname 분리에서 cross-origin 차단. 로컬에선 발견 안 됨.
2. **PB 0.22 backup download의 file-token** — admin token 대신 별도 short-lived file-token + ?token= 쿼리.
3. **`.env` chmod 600 + sudo vim** — root 소유 파일에 일반 vim은 read-only 빈 buffer로 노출.
4. **rsync Debian 12 미포함** — GitHub Actions runner는 있지만 VM은 sudo apt-get install -y rsync 필요.
5. **OS Login user 변환** — `ysc9606@gmail.com` → `ysc9606_gmail_com` (`@`/`.` → `_`).

## Prototype 종료 후 권장 사항

1. **PRD 재정비** — prototype 검증된 가정 (단일 사용자, 모바일 우선, 폼 코칭 미디어)만 남기고 v1.0 launch criteria 명확히
2. **STORIES v1.0 신규 파일** — prototype STORIES.md는 backlog 누적이라 가독성 ↓. 다음 Story 카탈로그는 `docs/stories/v1.0.md`로 새로 시작
3. **history/review 다음 phase 기록 시 `docs/history/`, `docs/review/` 재생성** — prototype 아카이브는 immutable, 다음 단계 산출물은 새 공간에 (DOCS_GUIDE.md 참조)
4. **인프라 비용 모니터링** — e2-micro Always Free + GCS Standard us-west1 비용 추적 (월 $1 이하 전망, 실측 후 ADR-8 보강)
5. **사용자 피드백 루프** — 본인이 실제 클라이밍 세션에서 사용 → 매주 1회 회고를 `docs/learning/<topic>.md`에 누적
