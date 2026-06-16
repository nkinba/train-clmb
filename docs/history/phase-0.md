# Phase 0 — History

본 워크플로우(`CLAUDE.md` Story 워크플로우) 도입 이전에 완료된 작업은 retrospective로 백필함. review 파일은 사이클을 거치지 않아 생략.

## S01 — 2026-06-16 (commit ec1e7ba, Ultraplan)
**변경 파일:** `docs/PRD.md`
**주요 결정:**
- 통증을 0–3 스케일로 정량화하고 세션 시작/종료에 양쪽(어깨·손가락) 기록 → 통증 빈도 지표(success metric #4)와 직접 연결
- RPE는 hangboard·climbing·strength 모두에 도입 (캠퍼스만 제외 — 동작 본위)
- `client_id` (UUID, UNIQUE) 도입으로 오프라인 큐 멱등 재전송 보장 — 모든 컬렉션에 적용. 서버 PK와 분리
- 행보드 실패 시 `actual_hang_seconds` 별도 필드 → 단순 binary 성공/실패보다 분석 가치 높음
- 클라이밍 프로젝트 추적용 `project_name` 추가 (V7 마일스톤 추적 핵심)
- NFR(오프라인·타이머·응답성·단일 사용자), 성공 지표 5종, 사용 시나리오 3종, 분석 화면 요구 신설
**다음 Story 영향:** S06 (PocketBase 스키마) — 모든 컬렉션에 `client_id` UNIQUE 인덱스 필수. S08–S11 모든 mutation은 client_id 발급 후 IndexedDB → PocketBase 흐름.
**Follow-up:** 없음.

## S02 — 2026-06-16 (commit ec1e7ba, Ultraplan)
**변경 파일:** `docs/ADR.md`, `docs/UI.md` (신규)
**주요 결정:**
- ADR-4 PWA: Workbox 기반 SW + IndexedDB 큐. 오프라인 → 온라인 동기화 4단계 (pending → POST → 409 멱등 처리 → failed/synced). Background Sync는 보조용
- ADR-5 인증: 단일 사용자, JWT를 localStorage. 1인 + 서드파티 스크립트 없음 → XSS 표면 미미하므로 localStorage 수용
- ADR-6 백업: Cloudflare R2 (egress 무료) 일 1회, 30일 보관. GCS는 egress 과금으로 탈락
- ADR-7 타이머: Wake Lock + Web Audio + Vibration 3계층. iOS 백그라운드 제약은 UX 안내로 흡수
- ADR-8 region: us-west1 확정 (한국 사용자지만 입력 위주이고 분석은 캐시 가능 → 0원 제약 우선)
- `docs/UI.md` 신규 — 화면별 ASCII 와이어프레임과 기술 결정 명시
**다음 Story 영향:** S03 (디자인 토큰)은 UI.md 결정을 기반으로 토큰화. S04 (프론트 부트스트랩)는 ADR-4의 Workbox + IndexedDB 구조 필요. S13 (서버)는 ADR-8의 us-west1로 프로비저닝. S14 (백업)는 R2로.
**Follow-up:**
- iOS PWA 푸시 알림 16.4+ 부분 지원 — 본 앱은 푸시 미사용으로 영향 없음. 향후 재평가 시 ADR-4 확장
- `next-pwa` vs Workbox 수동 구성 — UI.md §4에서 Workbox 수동으로 기울었으나 S04에서 최종 결정
