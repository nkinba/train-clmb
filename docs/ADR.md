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

* **상태:** 확정 (2026-06-17 결정 변경 — CF Pages → GCP VM Caddy)
* **컨텍스트:** 현업 표준 기술(Next.js, Tailwind CSS)을 사용하여 빠른 UI 컴포넌트 조립이 필요함. 단, e2-micro 서버의 1GB 메모리 환경에서 Node.js SSR 서버를 가동할 경우 OOM(Out of Memory) 발생 위험이 큼. ADR-2의 "외부 의존 플랫폼을 늘리지 않으면서" 원칙 적용 — 프론트 호스팅 채널까지 자체 운영해 모니터링 지점을 한 곳으로 통합.
* **결정:** **Next.js (App Router) Static Export + GCP VM의 Caddy에서 정적 서빙** (PB와 같은 VM, 다른 hostname 블록).
* **근거:**
  * Next.js 파일 기반 라우팅 + React 생태계 + `output: 'export'`로 순수 HTML/CSS/JS 정적 파일 빌드 → SSR 서버 리소스 부담 제거.
  * **PB와 같은 VM의 Caddy** — 이미 배포된 Caddy 컨테이너에 hostname 블록 하나만 추가하면 됨. 추가 인프라 0, 새 SaaS 추가 0.
  * **ADR-2 "인프라 학습" 의도와 일관** — 정적 서빙 + 배포 파이프라인까지 자체 운영 학습.
  * **운영 모니터링 한 곳으로 통합** — 프론트/PB/백업 로그가 같은 `docker compose logs`에 모임. uptime 모니터도 한 hostname만 보면 됨.
  * **장애 격리 손실은 단일 사용자라 영향 작음** — PB가 다운되면 프론트가 살아 있어도 데이터 못 받아 어차피 사용 불가. 두 호스팅 분리의 장애 격리 가치가 본 시나리오에선 낮음.
  * **e2-micro 메모리 부담 무시 가능** — 정적 자산 서빙은 Caddy가 디스크에서 직접 읽음 (~10MB 추가). PB(150MB) + 백업(50MB) + Caddy(20MB) + Node SSR 무 → 충분히 1GB 안에 들어옴.
* **검토 후 기각된 대안 (2026-06-17):**
  * **Cloudflare Pages** *(직전 ADR-3 결정)* — 배포 자동화/PR preview/즉시 롤백/글로벌 edge 이점은 분명하나 (1) 단일 사용자 PWA는 Service Worker가 자산 캐시 → edge 이점이 첫 진입에 한정, (2) ADR-2 "외부 종속 최소화"와 "인프라 학습"에 대해 한 곳 더 추가, (3) R2와 같은 계정이라도 대시보드 모니터링은 결국 분리됨. 자동화 부담은 GitHub Actions로 같은 수준 달성 가능. **→ 트레이드오프 재평가 결과 VM 일원화가 우세.**
  * **Vercel** — Hobby tier "personal/non-commercial only" 라이선스 + R2와 분리된 두 SaaS + static export는 first-party 이점 거의 없음. (CF Pages와 동일 기각 + 라이선스 추가)
  * **GitHub Pages** — PR preview deployment 부재 + 외부 SaaS 추가.
* **트레이드오프:**
  * **배포 자동화는 self-managed** — git push 시 자동 배포는 GitHub Actions(빌드 → rsync over SSH) 1회 셋업으로 달성. CF Pages의 "git push만 하면 끝"보다 셋업 비용 있음.
  * **PR preview 부재** — preview URL이 필요하면 별도 staging hostname(`staging-app.<sub>.duckdns.org`) + 별도 디렉토리 마운트. 단일 사용자 단계에선 over-engineering.
  * **글로벌 edge 손실** — 한국 첫 진입 시 us-west1 RTT ~150ms 노출. **Service Worker 캐시 적용 후 0ms**. PWA 시나리오에 잘 맞음.
  * **`out/` 디렉토리 만 옮기면 어디든 이전 가능** — 향후 Pages/Vercel 등으로 갈아탈 비용 1시간 미만.
* **ADR-2와의 일관성:** ADR-2의 두 원칙 — "외부 의존 플랫폼을 늘리지 않음" + "인프라 학습" — 둘 다와 정합. PB 도메인과 같은 hostname 트리(`app.<sub>.duckdns.org` / `pb.<sub>.duckdns.org`)로 운영.

### 구현 메모 (S15)
- `infra/prod/Caddyfile`에 두 번째 hostname 블록 추가: `{$APP_DOMAIN}` → `root /srv/app` + `file_server`.
- `infra/prod/docker-compose.prod.yml`에 host 디렉토리(`${DATA_DIR}/app`) → caddy `/srv/app` 마운트.
- 배포: 로컬에서 `pnpm build` → `rsync -av web/out/ <vm>:/opt/climb-forge/data/app/`. 자동화는 GitHub Actions로 follow-up.
- DDNS: DuckDNS에 서브도메인 2개 등록(`pb-...`, `app-...`) 또는 단일 와일드카드 대안 검토.

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

* **상태:** 확정 (2026-06-17 결정 변경 — R2 → GCS)
* **컨텍스트:** PocketBase의 SQLite 파일이 e2-micro 디스크에 단일 존재. 인스턴스/디스크 손실 시 모든 훈련 기록 소실. ADR-2의 "외부 의존 플랫폼 최소화" 원칙도 적용.
* **결정:** 매일 1회 PocketBase admin API(`POST /api/backups`)로 WAL 일관성 zip 생성 → **Google Cloud Storage**(GCP us-west1) 업로드, **Service Account 인증**(VM metadata service). 30일 보관 후 자동 삭제 (bucket lifecycle 룰).
* **근거:**
  * **ADR-2 통합** — 컴퓨트(GCP VM)와 같은 GCP 계정·콘솔. Cloudflare 추가 종속 0.
  * **GCS Always Free** — 5GB-month standard storage (us-east1/central1/west1). 우리 보관 300MB(10MB × 30일)에 충분.
  * **Class A/B 한도** — writes 5,000/월 (매일 1회 < 한도), reads 50,000/월. 무관.
  * **같은 region(us-west1) 내부 트래픽 egress 무료** — VM → GCS 업로드, 복구 시 같은 VM 사용이라면 egress 무료. 외부에서 복구 시 1GB 이하 무료 + 초과 ~$0.12/GB (우리 백업 < 1GB라 사실상 무료).
  * **Service Account IAM** — VM에 SA 첨부 → metadata service에서 자동 토큰. **access key 환경변수 노출 자체가 사라짐** (보안 ↑). 백업 컨테이너 `docker inspect` 평문 노출 표면 제거.
* **검토 후 기각된 대안 (2026-06-17):**
  * **Cloudflare R2** *(직전 ADR-6 결정)* — egress 완전 무료(어디서든)가 핵심 이점이나 (1) 우리 복구 시나리오는 같은 GCP VM 가능성 큼 → GCS도 무료, (2) ADR-2 종속 최소화 위반 (Cloudflare 1개 추가), (3) `R2_ACCESS_KEY_ID`/`SECRET` 평문 환경변수 필수 — SA 인증 같은 무자격증명 옵션 없음. 우리 시나리오에서 egress 무료 이점이 실현되지 않으면 종속/보안 비용만 남음. **→ 재평가 결과 GCS 우세.**
  * **AWS S3 / Backblaze B2** — 같은 이유로 GCP 외부 SaaS, 종속 추가.
  * **VM 같은 디스크 내 백업** — 인스턴스/디스크 손실에 대응 불가, ADR-6 컨텍스트 자체 위배.
* **트레이드오프:**
  * **외부 region에서 복구 시 egress 과금 가능성** — 1GB 이하 매월 무료라 단일 사용자 < 300MB 시나리오에선 실질 0원. 1년에 1번 복구도 무료.
  * **GCS Always Free 5GB-month < R2 10GB** — 우리 사용량(300MB)에서 무관. 보관 정책을 30일 → 90일로 늘려도 1GB 안.
  * **Service Account 권한 관리** — `roles/storage.objectAdmin` on the bucket만. 다른 자원 영향 0.

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
