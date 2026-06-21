# Backlog

검토 중인 기능 / 이슈 / 개선의 풀. Sprint planning 시점에 항목을 골라 Story로 분해 후 `docs/sprints/sprint-N.md`로 이동.

**우선순위**: 🔴 High · 🟡 Mid · 🟢 Low · 🔵 Optional (v1.2+ 후보)

**출처**: 본 backlog는 prototype 종료 시점에 prototype/README, `docs/prototype/history/phase-N.md`, RUNBOOK, learning 노트에 흩어져 있던 follow-up을 일괄 수집한 것이다. 새로 떠올린 아이디어 추가 X — 모두 prototype에서 명시된 항목.

---

## 1. Prototype acceptance 미해결 (가장 시급)

### 🔴 모바일 디바이스 실측
PWA 설치(Samsung Internet/Chrome) + 카메라 캡처 + 미디어 업로드 + lightbox 재생까지 실제 디바이스에서 한 사이클. Wake Lock / Audio / Vibration / Notification은 headless 검증 불가라 실 디바이스에서만 확인 가능.
**출처**: S18-C history (미해결 follow-up), prototype/README §즉시 권장.

### 🔴 복원 리허설 (S14 acceptance)
별도 staging VM(또는 로컬 macOS Docker)에서 GCS backup zip 다운로드 → PB 복원 → admin/user/session row 일치 확인. RUNBOOK §7.4 절차 따라가서 1회 수행하고 결과를 history에 기록.
**출처**: RUNBOOK §7.4, prototype/README §즉시 권장.

---

## 2. 운영 안정성 / 보안 강화

### 🟡 BACKUP_ALERT_WEBHOOK 등록
백업 실패 시 silent (`.env`의 webhook 미설정). Slack/Discord/Telegram incoming webhook URL 발급 후 `.env`에 추가. 주 1회 docker logs grep 의존 회피.
**출처**: RUNBOOK §6.1, prototype/README.

### 🟡 PB Admin UI IP allowlist
`/_/`와 `/api/admins/*`가 외부 노출됨 — 자격증명만이 방어선. 본인 회선 IP가 고정이면 Caddyfile에 IP allowlist 한 블록 추가 (infra/prod/README §알려진 주의사항).
**출처**: infra/prod/README §알려진 주의사항.

### 🟡 PB CORS 명시
PB 0.22 기본 wildcard. Caddy 미들웨어로 `Access-Control-Allow-Origin: https://app-breakteau.duckdns.org` 명시. ADR-5 단일 사용자 가정과 정합.
**출처**: prototype/README §즉시 권장.

### 🟢 ysc9606 user 잔여 process cleanup
prototype 종료 시점에 active process 때문에 userdel 미완. VM reboot 시 자동 정리되지만 별도 시점에 `sudo userdel -rf ysc9606` 한 줄로 마무리 가능. dead account이므로 영향 0.
**출처**: 2026-06-22 대화 (history/learning 노트), prototype/README §운영 권장.

---

## 3. 기능 보강 (UX / 분석)

### 🟡 S21 지도 SDK (장소 픽)
S20의 직접 입력 단계를 카카오맵/네이버 places로 보강 — 검색 결과에서 장소 picking. API key 발급 + `NEXT_PUBLIC_KAKAO_KEY` 등 환경변수 분리. (선택) 세션 record에 lat/lng 필드 추가 마이그레이션.
**출처**: STORIES.md S21 ⬜ (v1.1 후보).

### 🟡 운동 row 편집/삭제
/sessions/active timeline에서 long-press 또는 swipe-to-delete. 미디어 row는 이미 lightbox에서 삭제 가능 (window.confirm). 운동 row는 라우트로 모듈 이동만 — 편집 UI 없음.
**출처**: S23 Out of scope, S25 follow-up.

### 🟢 timeline row swipe-to-delete (gesture)
운동/미디어 row 모두 통합. long-press menu와 swipe gesture 중 결정 필요.
**출처**: S23 Out of scope.

### 🟢 영상 thumbnail 자동 생성
PB collection의 `thumbs` 옵션 추가 (file 필드) + grid에서 thumb URL 사용. 누적 미디어 50개+ 시 그리드 진입 부담 ↓. `media-grid.tsx` V3 follow-up.
**출처**: S18-C self-review V3, prototype/README.

### 🟢 오프라인 큐에 미디어 통합
S12 queuedCreate는 JSON 가정. 미디어는 multipart라 별도 큐 구조(chunked upload + 진행률 보존) 필요. v1.1 출시 후 사용 패턴 보고 결정.
**출처**: S18-B history §주요 의사결정 4번.

### 🟢 미디어 file URL token mid-stream
PB file-token TTL은 ~5분. 5분+ 영상 재생 시 chunk range request의 token 만료로 끊김 가능. PB token TTL 늘리거나 video element가 새 토큰으로 재구성. 1인 30초 영상에선 immediate 영향 작음.
**출처**: S18-C self-review V2, prototype/README §미해결 follow-up.

### 🟢 PR(개인 최고) 마커
Recharts `ReferenceDot`로 각 month/week 최고치 표시 (그립 1RM, 등반 그레이드 등).
**출처**: S16 history §미해결 follow-up.

### 🟢 분석 시간 범위 선택
분석 페이지에 전체 / 3개월 / 12개월 필터 추가. 현재는 전체.
**출처**: S16 history.

### 🟢 분석 빈 상태 hint
첫 사용자 (데이터 0건) 시 "기록을 시작하세요" CTA. 현재 차트는 빈 그리드만.
**출처**: S16 history.

### 🟢 개별 통증 라인
어깨/손가락 따로 라인 표시. 현재 합산 max만.
**출처**: S16 history.

### 🟢 난이도 가중치 UI 노출
`WeeklyClimbChart`에 weighted toggle 또는 stacked bar.
**출처**: S16 history.

### 🟢 chip 키보드 네비게이션
picker chip Arrow / Home / End. PainSelector 패턴 참조. 현재 마우스/터치 only.
**출처**: S20 history.

### 🟢 검색 시 MRU hybrid 모드
picker에서 검색 중에도 MRU 매칭 항목 위에 표시 (현재는 검색 중 MRU 숨김).
**출처**: S20 history.

### 🟢 prebuilt 리스트 확장
gyms 22개 / targets 23개에서 사용자 피드백 받아 점진 추가. PB Admin UI에서 가능.
**출처**: S20 history.

### 🟢 gyms/targets에 alias 배열
"강남클파"처럼 별칭 검색 매칭. picker 검색 input에서 alias도 매칭.
**출처**: S22 history §미해결 follow-up.

### 🟢 카탈로그 prefetch in /app boot
useGyms/useTargets staleTime 5분 안에서도 첫 진입 skeleton flash 회피 — boot 시점에 prefetch.
**출처**: S22 history.

### 🟢 campus deeplink
`/sessions/active/strength/?type=campus` query param으로 캠퍼스 폼 자동 활성화. 현재는 strength 페이지 진입 후 type 토글 필요.
**출처**: S23 self-review §1, S23 history §미해결 follow-up.

### 🟢 timeline focus trap
모바일 single-tap 우선 + ESC/외부 클릭 있어 v1.0 차단 이슈 아님. 모바일 키보드 사용자 접근성 강화 시점에 도입.
**출처**: S23 self-review §V3, S25 history.

### 🟢 /logs/detail에 timeline 형태 적용
현재 /logs/detail은 4 그룹 (hangboard/climbing/strength/campus + media) 분리 표시. /sessions/active timeline과 통일이 좋을지 검토.
**출처**: S23 history §다음 Story에 영향.

### 🟢 timeline media row thumbnail 부담
실제 영상 첫 프레임 받는 부담 — S18-C V3 follow-up과 동일 (썸네일 컬렉션).
**출처**: S25 history.

### 🟢 timeline 일자/시간대 그룹
미디어 row 누적 시 timeline 길이. 일자/시간대 그룹 옵션.
**출처**: S25 history.

---

## 4. 기술 부채 / 인프라 정리

### 🟢 rsync 사전 설치 자동화
RUNBOOK §2.1.5에 명시했지만 매번 수동. cloud-init 또는 Terraform script로 VM 생성 시 자동 설치. infra의 "코드로 관리" 원칙 정합.
**출처**: RUNBOOK §2.1.5, learning 카테고리 8.

### 🟢 CSP `unsafe-inline` hash 기반으로 좁히기
script-src/style-src의 `'unsafe-inline'`은 Next.js RSC payload + 동적 style 때문에 불가피. 빌드 시점 hash 추출로 좁힐 수 있음 (Caddyfile 주석에 v1.1 검토로 명시).
**출처**: Caddyfile §보안 헤더 주석.

### 🟢 ADR-3 / ADR-6의 supersede 패턴 retroactive 적용
prototype에서 in-place 갱신한 ADR-3 (CF Pages → VM Caddy), ADR-6 (GCS→R2→GCS) 본문에 "Status: Superseded by ADR-N" 추가 + ADR-N 별도 작성. 추적성 정합.
**출처**: prototype/README §결정 변경 이력, DOCS_GUIDE.md §2.2.

### 🟢 인프라 비용 모니터링
e2-micro Always Free + GCS Standard us-west1 비용 추적 (월 $0.15 전망). 실측 후 ADR-8 보강 여부 결정.
**출처**: prototype/README §운영 권장, PROJECT_GUIDE.html §5.

---

## 5. v1.2+ 기능 후보 (장기)

### 🔵 AI 폼 분석 모델 연동
영상 → keypoint detection → 코칭 인사이트. PRD §8의 궁극적 사용처. 별도 phase로 분리 (모델 호스팅 / GPU / 비용 등 결정 다수).
**출처**: PRD §8, STORIES.md S18 Out of scope.

### 🔵 외부 데이터 import
Mountain Project / Kakao Places 등에서 route/gym 정보 import. 단일 사용자 사용 패턴 확립 후.
**출처**: PROJECT_GUIDE.html §10.

### 🔵 다른 사용자 공유 모드
1인 가정이 깨지므로 ADR-5 재평가. 다중 사용자 인증/권한 분리 필요.
**출처**: PROJECT_GUIDE.html §10, ADR-5 재평가 트리거.

### 🔵 음성 메모 입력
Web Speech API. prototype S17은 ❌ Cancelled. 사용자 피드백 후 재검토 시.
**출처**: STORIES.md S17 ❌ Cancelled, prototype/history/phase-4.md.

### 🔵 미디어 검색
/library에 검색 input — 메모 텍스트 / 날짜 / 세션 target 매칭.
**출처**: S18-C history.

### 🔵 HEIC → JPEG transcoding
iOS Safari가 HEIC native 지원하지만 안드로이드 브라우저 미흡. 클라이언트 측 변환 또는 PB hook으로 서버 측 변환.
**출처**: S18-B history.

---

## Sprint planning 시 권장 점검

- [ ] 항목별 의존성 그래프 (예: 영상 thumbnail은 PB 마이그레이션 + grid 컴포넌트 둘 다 영향)
- [ ] 한 sprint 안에 묶을 항목 — 같은 영역 묶기 (예: 분석 보강 4건을 한 sprint로)
- [ ] 외부 의존 / 결정 필요한 항목은 sprint 전 prep (예: 지도 SDK는 API key 발급 + 비용 검토)
- [ ] 모바일 디바이스 실측은 sprint와 무관하게 운영 중 발견 즉시 → 새 backlog 항목으로 추가
