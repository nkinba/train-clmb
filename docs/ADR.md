# ADR.md (아키텍처 결정 기록)

## ADR 1: 백엔드 및 데이터베이스 기술 선정

* **상태:** 확정
* **컨텍스트:** 1인 개발 및 사용 환경에서 유지보수 비용(시간 및 금전)을 최소화하면서도, 관계형 데이터(세션-훈련기록)를 안정적으로 저장할 API 서버가 필요함.
* **결정:** **PocketBase** 도입.
* **근거:**
  * Go 언어 기반의 단일 바이너리(Single Binary)로 실행되어 메모리 자원을 매우 적게 소모함.
  * 내장 SQLite를 사용하여 별도의 DB 인프라(PostgreSQL 등) 세팅이 불필요함.
  * 기본 제공되는 어드민 UI와 JavaScript SDK를 통해 프론트엔드 연동 속도를 극대화할 수 있음.

## ADR 2: 인프라 및 배포 환경 구성

* **상태:** 확정 (2026-06-17 도메인/DDNS 옵션 명문화)
* **컨텍스트:** 엔지니어로서의 인프라 경험을 위해 외부 호스팅(SaaS) 대신 직접 서버를 구축하되, **외부 의존 플랫폼을 늘리지 않으면서** 운영 비용을 최소화해야 함.
* **결정:** **GCP Compute Engine (e2-micro) + Docker Compose + Caddy**.
  * 도메인은 두 가지 옵션을 허용 (운영자가 선택, 코드 차이 없음):
    1. **커스텀 도메인** (예: `pb.example.com`) — 등록업체 약 $10/년. 미관/장기 안정.
    2. **무료 DDNS** (예: `<sub>.duckdns.org`) — 0원. URL 미관 양보. 단순 DNS resolver라 lock-in이 거의 없음.
* **근거:**
  * GCP Always Free 티어인 e2-micro(1 vCPU, 1GB RAM)를 활용하여 컴퓨트 비용 0원 달성. **외부 의존 = GCP 하나만** (DDNS는 단순 DNS resolver라 추가 플랫폼 종속으로 간주 안 함).
  * Docker Compose를 통해 로컬 맥미니/맥북 환경과 GCP 운영 환경을 100% 동일하게 구성(IaC 기초).
  * Caddy 웹 서버를 앞단(Reverse Proxy)에 배치하여 Nginx 대비 적은 설정(Caddyfile)으로 Let's Encrypt 자동 SSL(HTTPS) 발급 처리. 발급 단위는 **hostname**이므로 커스텀 도메인이든 DDNS든 동일한 흐름.
* **검토 후 기각된 대안 (2026-06-17):**
  * **Supabase free tier** — 도메인 0원이지만 SaaS 회피 의도 정면 위반 + 7일 비활성 시 paused 정책이 단일 사용자 운동 패턴(주 2–3회)과 충돌.
  * **Fly.io free tier** — `.fly.dev` 자동 hostname으로 도메인 비용 0원이지만 플랫폼 종속 증가 + free tier 정책 변경 이력. 학습 의도 약화.
  * **Vercel** — 프론트(Next.js) 호스팅에는 적합(ADR-3 검토 대상)이지만 long-running PB는 못 돌림 — 본 ADR 범위 외.
  * **Cloudflare Tunnel/Containers** — Quick Tunnel은 URL 휘발, Named는 도메인 필요, Containers는 베타 + 가격 모델 미확정.
* **트레이드오프:**
  * 비용 0원 절대 달성을 원하면 DDNS 옵션. 미관 양보 + 단일 사용자 운영자만이 hostname 안다는 가정에서 무해.
  * 커스텀 도메인 선택 시 연 $10가 학습/소유권 가치보다 작은 비용으로 판단.

## ADR 3: 프론트엔드 프레임워크 및 호스팅

* **상태:** 확정
* **컨텍스트:** 현업 표준 기술(Next.js, Tailwind CSS)을 사용하여 빠른 UI 컴포넌트 조립이 필요함. 단, e2-micro 서버의 1GB 메모리 환경에서 Node.js SSR 서버를 가동할 경우 OOM(Out of Memory) 발생 위험이 큼.
* **결정:** **Next.js (App Router) Static Export + Cloudflare Pages 배포**
* **근거:**
  * Next.js의 파일 기반 라우팅 및 React 생태계 이점을 그대로 취함.
  * `output: 'export'` 설정을 통해 순수 HTML/CSS/JS 정적 파일로 빌드하여 SSR 서버 실행에 따른 리소스 부담 제거.
  * 빌드된 결과물을 이미 사이드 프로젝트에 사용 중인 Cloudflare 인프라(Pages)에 배포하여 프론트엔드 호스팅 비용 분리 및 글로벌 엣지 네트워크 활용. (데이터 통신은 PocketBase API와 직접 수행)

## ADR 4: 모바일 전달 방식 (PWA)

* **상태:** 확정
* **컨텍스트:** 사용 환경의 대부분이 모바일(행보드 룸, 암장)이며, 한 손 조작·오프라인 입력·화면 유지·홈 화면 설치가 모두 필요함. 네이티브 앱(iOS/Android) 양쪽 개발/배포는 1인 운영 부담 큼.
* **결정:** **PWA**로 단일 코드베이스 운영. Next.js static export 위에 Workbox(또는 `next-pwa`)로 Service Worker 구성.
* **근거:**
  * 매니페스트(`display: standalone`) + 홈 화면 아이콘으로 네이티브에 준하는 진입 경험.
  * Service Worker 캐시로 오프라인 셸 및 정적 자원 서빙.
  * 입력 오프라인 큐는 IndexedDB에 직접 저장 후 온라인 복귀 시 PocketBase로 flush (PocketBase JS SDK는 내장 오프라인 큐 미제공 — 직접 구현 필요).
* **오프라인 → 온라인 동기화 패턴:**
  1. 모든 쓰기는 먼저 IndexedDB에 `status=pending`, 클라 생성 `client_id` (UUID)로 기록 — UI는 즉시 optimistic 반영.
  2. Sync worker가 `online` 이벤트 / 앱 시작 / `visibilitychange` / 수동 재시도 트리거로 PocketBase에 POST.
  3. 성공 시 `status=synced` + `server_id` 저장. 409(client_id 중복)도 멱등으로 간주하여 `synced` 처리. 4xx는 `failed`로 마킹해 사용자 수정/재시도 유도. 5xx·네트워크는 `pending` 유지 + 지수 백오프.
  4. PocketBase 측 모든 `*_logs`와 `sessions`에 `client_id` UNIQUE 인덱스 (PRD §3 참조) — 망 단절이 "서버 수신 후 / 클라 ack 전" 사이에 일어나도 중복 레코드 방지.
* **Background Sync API**는 Android Chrome만 지원 → 보조용으로만 사용, 주 트리거는 포그라운드 이벤트.
* **트레이드오프:** iOS는 PWA 지원이 Android보다 제한적(특히 푸시 알림 — 16.4+ 부분 지원). 본 앱은 푸시 비의존이라 영향 적음.

## ADR 5: CORS 및 인증 정책

* **상태:** 확정
* **컨텍스트:** 프론트는 Cloudflare Pages 도메인, API는 GCP 도메인으로 분리됨. 1인 사용이지만 인증은 필요 (어드민 UI 보호, API 무차별 호출 방지).
* **결정:**
  * PocketBase에 단일 사용자 계정(이메일/비밀번호) 생성.
  * JWT는 프론트 `localStorage`에 저장.
  * PocketBase CORS는 프론트 도메인(`*.pages.dev` 또는 커스텀 도메인)만 화이트리스트.
* **근거:**
  * 1인 사용 + 서드파티 스크립트 미포함 → XSS 공급 경로가 사실상 없음 → `localStorage` 위험 수용 가능.
  * httpOnly 쿠키 방식은 크로스 도메인 설정 부담이 큼.
* **트레이드오프:** 추후 사용자 추가 시 XSS 표면 재평가 필요.

## ADR 6: 백업/복구 전략

* **상태:** 확정
* **컨텍스트:** PocketBase의 SQLite 파일이 e2-micro 디스크에 단일 존재. 인스턴스/디스크 손실 시 모든 훈련 기록 소실.
* **결정:** PocketBase Hooks(또는 cron 컨테이너)로 매일 1회 SQLite 파일 스냅샷 → **Cloudflare R2** 업로드. 30일 보관 후 자동 삭제.
* **근거:**
  * R2는 egress 무료이므로 복구 시 비용 0원.
  * Free tier 10GB 저장으로 SQLite(수 MB 단위) 백업에 충분.
  * GCS도 가능하나 egress 과금이 있어 복구 시 비용 부담.

## ADR 7: 인터벌 타이머 안정성

* **상태:** 확정
* **컨텍스트:** 행보드 룸에서 폰을 거치한 채 10s/3min 인터벌을 정확히 알려야 함. 화면 꺼짐, 다른 앱 전환, 잠금 화면 모두 발생 가능한 상황.
* **결정:** 다음 3계층 조합:
  1. **Wake Lock API** (`navigator.wakeLock.request('screen')`)로 화면 꺼짐 방지 — 타이머 화면 진입 시 자동 요청, 이탈 시 해제.
  2. **Web Audio API**로 비프 신호 (`<audio>` 태그는 iOS에서 타이밍 부정확 — Web Audio의 정확한 스케줄링 사용).
  3. **Vibration API**로 시각 외 신호 보강 (이어폰 미착용 시 비프 누락 대비).
  4. Service Worker 백그라운드 타이머는 보조용(iOS는 백그라운드 ~30s 후 정지). 주 타이밍은 **포그라운드 유지** 가정.
* **근거:**
  * iOS Safari의 백그라운드 제약은 우회 불가 — UX 레벨에서 "사용 중에는 화면을 켜둬야 합니다" 안내로 흡수.
  * Wake Lock + Web Audio 조합은 행보드 룸 거치 사용에 충분.

## ADR 8: GCP 리전 선택

* **상태:** 확정
* **컨텍스트:** GCP Always Free e2-micro는 us-west1 / us-central1 / us-east1에서만 제공. 한국 사용자는 RTT ~150ms 발생.
* **결정:** **us-west1**(오리건) 선택.
* **근거:**
  * 본 앱은 입력 위주 (작은 JSON POST) — 체감 지연 미미.
  * 분석 화면은 클라이언트 캐시 가능.
  * 향후 한국 리전 사용 시 월 ~$5 비용 발생하므로 0원 제약과 충돌.
