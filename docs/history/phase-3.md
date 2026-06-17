# Phase 3 — History

## S13 — 2026-06-17 (commit 7938f8c)

### 변경 파일 요약
- `infra/pocketbase/Dockerfile` — PocketBase 0.22.21 amd64/arm64 SHA256 검증 + 비-root user `pb`(uid 100, gid 101) + `chown -R pb:pb /pb_data /pb_migrations`. wget 추가(healthcheck용).
- `infra/pocketbase/README.md` — "프로덕션 (S13 영역)" 체크리스트를 처리 완료(✅) + S14 잔여(🔜)로 갱신. RUNBOOK 참조 안내.
- `infra/prod/docker-compose.prod.yml` *(신규)* — Caddy + PocketBase 2-컨테이너, internal/public 네트워크 분리, `${DOMAIN:?}`/`${ACME_EMAIL:?}` fail-fast, `depends_on: service_healthy`, healthcheck start_period 30s/interval 10s.
- `infra/prod/Caddyfile` *(신규)* — `admin off`, 자동 SSL(Let's Encrypt), HSTS+preload+X-Frame-Options DENY+nosniff+Referrer-Policy+`-Server`, gzip+zstd, HTTP/3, log format json.
- `infra/prod/.env.prod.example` *(신규)* — DOMAIN/ACME_EMAIL/DATA_DIR.
- `infra/prod/.gitignore` *(신규)* — `.env`, `data/`.
- `infra/prod/README.md` *(신규)* — 토폴로지/일상 명령/주의사항(CORS, admin IP allowlist 스니펫, swap, 백업).
- `docs/RUNBOOK.md` *(신규)* — VM 프로비저닝→swap→docker→도메인→첫 부팅(권한 부트스트랩 포함)→검증(health, time_total, SSL)→일상 운영(로그/재시작/마이그레이션/업그레이드+롤백)→백업(PB admin API §7.1, 수동 tar §7.2 with wal_checkpoint)→장애 대응(인증서/PB/OOM).
- `docs/STORIES.md` — S13 → ✅ Done.
- `docs/review/phase-3.md` *(신규)* — self-review + 수용/반박 판단.

### 주요 의사결정·트레이드오프

#### 1. 이미지 동일, 네트워크 정책만 분리 (ADR-2)
로컬 compose는 `127.0.0.1:8090` host 바인딩, prod compose는 `expose: 8090` (internal network만). 같은 Dockerfile 이미지를 양쪽에서 빌드하므로 ADR-2 "IaC 동일성"은 이미지 레벨에서 보존. 네트워크 정책 분리는 로컬 dev tools가 PB에 직접 붙어야 하는 워크플로우와 prod의 보안을 모두 만족.

#### 2. 비-root user (pb, uid 100)
공격 표면 최소화. 컨테이너 내부에서 어떤 취약점으로 escape하더라도 권한이 host pb_data 디렉토리에 한정. macOS Docker Desktop은 자동 매핑, **Linux prod는 RUNBOOK §4.0의 명시적 `chown -R 100:101`이 필수**.

#### 3. PocketBase 바이너리 SHA256 핀
공급망 공격(릴리스 자체 손상) 방지. Dockerfile case 문에서 amd64/arm64 각각 명시. 업그레이드 절차는 RUNBOOK §6.4 (checksums.txt 확인 + 코드 갱신 + 빌드 실패 시 git checkout fallback).

#### 4. internal/public 네트워크 분리
PocketBase는 `internal`만, Caddy만 `public`(80/443). 외부에서 PB 직접 진입 불가. ADR-5(단일 사용자) + admin endpoint IP allowlist(prod README 스니펫)와 결합 시 다층 방어.

#### 5. Caddyfile 보안 헤더 풀세트
- HSTS 1년 + preload — 사용자가 HTTP로 다시 안 가도록 + preload list 등록 가능.
- X-Frame-Options DENY — iframe 임베드 차단 (PocketBase admin UI clickjacking 회피).
- nosniff, Referrer-Policy, `-Server` — 표준 hardening.

#### 6. 자동 SSL — `admin off`
Caddy admin API(localhost:2019)를 외부에 노출하지 않도록 `admin off`. 운영 변경은 SSH + 파일 수정 + reload (`docker compose restart caddy`) 흐름. 추가 보안 + 의도하지 않은 변경 회피.

#### 7. healthcheck 보강
첫 부팅 시 PocketBase가 마이그레이션을 실행하면 healthy 도달이 늦어 Caddy `depends_on`가 길게 대기 → ACME challenge 윈도우가 좁아질 수 있음. `start_period 30s + interval 10s`로 보강.

#### 8. 백업 우선순위: PB admin API
SQLite WAL 모드 특성상 stop-tar-start는 silently corrupt 위험. PocketBase admin API `POST /api/backups`가 서버 내부에서 일관 스냅샷을 zip으로 묶어주므로 우선. 수동 tar는 fallback + `wal_checkpoint(TRUNCATE)` 명시.

### 다음 Story (S14)에 영향 줄 컨텍스트
- 자동 백업은 PB admin API `POST /api/backups`를 cron으로 호출 + 결과 zip을 R2로 업로드하는 흐름이 자연스러움. PB 측에서 일관성 보장하므로 추가 로직 단순화.
- 비-root user(uid 100) 때문에 백업 cron이 host에서 직접 pb_data를 읽으려면 root 권한 또는 group 매칭 필요. PB admin API 경유가 더 깔끔.
- Caddy log JSON 포맷 — S15(또는 v1.1) 모니터링에서 fluentbit/loki 등으로 수집 시 즉시 사용 가능.

### 미해결 follow-up
- **CORS 화이트리스트**: PB admin UI > Settings > Application > "Allowed origins"에서 프론트 도메인(S15 배포 후 확정) 추가. 현재 `*`인지 admin UI에서 확인 필요.
- **admin endpoint IP allowlist**: 도메인 발급 + 첫 admin 로그인 후 사용자 IP 안정성 확정되면 README 스니펫 적용.
- **staging 환경**: 현재는 prod 직배포. PB 버전 업그레이드 검증용 별도 인스턴스 검토 — Always Free 한도 안에서 가능.
- **모니터링/알람**: Caddy 인증서 만료 임박(자동 갱신 실패 시), PB OOM 등. uptime-kuma 등 검토.

### 사용자 위임 (실 VM/도메인 필요)
- Acceptance criteria의 `https://<domain>/_/` 실 접근 — VM + 도메인 + DNS 전파 후 RUNBOOK §4 실행.
- `curl -w "%{time_total}"` 한국 측정 — 동일.
- SSL Labs A+ 점수 확인 — 동일.

### 로컬에서 검증 완료
- `docker build infra/pocketbase` — SHA256 검증 + 비-root 빌드 성공.
- 임시 컨테이너 실행: `/api/health` 200, `id` → `uid=100(pb)`, `/pb_data` owner `pb`.
- `docker compose -f infra/prod/docker-compose.prod.yml config` — syntax OK.
- `caddy validate /etc/caddy/Caddyfile` — **Valid configuration** (경고 0).

---

## S14 — 2026-06-17 (commit 571b472)

### 변경 파일 요약
- `infra/prod/backup/Dockerfile` *(신규)* — alpine + curl + rclone + jq + unzip + tzdata, 비-root user `backup`, ENV 기본 `BACKUP_HOUR_UTC=19`/`BACKUP_MINUTE_UTC=0`/`BACKUP_ON_START=0`.
- `infra/prod/backup/backup.sh` *(신규)* — PB admin API auth → POST /api/backups → 다운로드 → unzip -t 무결성 검증 → R2 `auto/` sub-prefix 업로드 → PB 측 zip 삭제 → 잔여 zip 카운트 로그 → R2 30일 cleanup. 실패 시 옵션 webhook 알림.
- `infra/prod/backup/entrypoint.sh` *(신규)* — daily sleep-loop, BACKUP_ON_START 기본 0.
- `infra/prod/docker-compose.prod.yml` — backup 서비스 추가 (internal network, depends_on PB healthy, R2_PREFIX/BACKUP_ALERT_WEBHOOK 환경변수).
- `infra/prod/.env.prod.example` — PB_ADMIN_*, R2_*, R2_PREFIX, BACKUP_ALERT_WEBHOOK placeholder.
- `docs/RUNBOOK.md` — §7.0 자동 백업 개요, §7.3 R2 셋업 (버킷/토큰/lifecycle prefix `auto/`/.env/첫 백업 검증), §7.4 복원 리허설 (admin API / pb_data unzip 두 경로), §6.1 백업 실패 주간 점검, §6.4 PB 업그레이드 시 backup 호환성 점검.
- `docs/STORIES.md` — S14 → ✅ Done.
- `docs/review/phase-3.md` — S14 self-review append.

### 주요 의사결정·트레이드오프

#### 1. PB admin API 경유 (WAL 일관성)
S13 history의 메모대로 `POST /api/backups`가 PB 서버 내부에서 일관 zip을 만들어줌. 수동 tar(stop-tar-start)의 WAL race 위험 회피. 비용은 PB admin 자격증명을 backup 컨테이너에 노출 — internal network + non-root user로 표면 최소화.

#### 2. R2 sub-prefix 격리 (`auto/`)
backup 객체를 `r2:${R2_BUCKET}/auto/climb-forge-*.zip`에 격리. rclone cleanup도 `auto/` 안에서만 동작 → 같은 버킷에 수동 백업/임시 객체가 섞여도 영향 분리. R2 lifecycle 룰의 prefix도 `auto/`로 일치.

#### 3. zip 무결성 검증
다운로드 후 `unzip -t`로 정합성 빠르게 검증. 깨진 zip이 R2에 영구화되는 시나리오(부분 다운로드, PB finalize race) 방지. Dockerfile에 unzip 추가.

#### 4. 옵션 webhook 알림
`BACKUP_ALERT_WEBHOOK` 환경변수가 설정되어 있으면 단계별 실패 시 Slack/Discord/Telegram 호환 JSON `{"text":"..."}` POST. 미설정 시 silent → RUNBOOK §6.1의 주 1회 grep 권장 절차로 대체.

#### 5. 진단 로그 강화
- step 1(admin auth): 실패 시 응답 본문 head 200자 출력 (token redacted).
- step 2(create snapshot): 응답을 임시 파일로 받아 실패 시 head 200자 출력.
- step 5: PB 잔여 zip 개수 로그 (디스크 누적 모니터링).

#### 6. BACKUP_ON_START 기본 0
Dockerfile ENV + entrypoint default 모두 0. compose도 0. 검증 시는 명시 override (`BACKUP_ON_START=1 docker compose up backup`). reviewer 지적한 "이미지 기본 1 vs compose 기본 0" 불일치 footgun 해소.

#### 7. UTC 기준 스케줄
sleep-loop가 UTC 기준 다음 BACKUP_HOUR_UTC/MINUTE_UTC까지 계산. KST 04:00 = UTC 19:00. DST/윤초 무관. 컨테이너 재시작 시 다음 실행 시각만 다시 계산되어 중복 실행 없음.

### 다음 Story (S15)에 영향 줄 컨텍스트
- 자동 백업이 운영 중이므로 S15 (Cloudflare Pages 배포)에서 PB 도메인 ↔ 프론트 도메인 CORS 설정 시 백업 트래픽 영향 없음 (internal network).
- BACKUP_ALERT_WEBHOOK은 S16(분석/대시보드)에서 다른 알림 채널과 통합 가능.

### 미해결 follow-up (사용자 위임)
- **복원 리허설 실 수행** — 별도 staging VM(또는 macOS Docker)에서 RUNBOOK §7.4 절차로 1회 검증 + history에 ✅ 한 줄 기록.
- **R2 lifecycle 룰 적용** — Cloudflare dashboard에서 prefix `auto/` 30일 삭제 룰 추가 (UI 작업, code 외).
- **webhook URL 설정** — 알림 채널 (Slack/Discord 등) 선정 + `.env`에 추가.
- **docker compose secrets 이관 (v1.1)** — 자격증명을 file mount + ENV로 분리. 모니터링 에이전트 도입 시 노출 표면 ↓.

### 로컬에서 검증 완료
- `docker build infra/prod/backup` — alpine + 도구 풀세트, 비-root user.
- `docker compose -f infra/prod/docker-compose.prod.yml config` — 3개 서비스 인식, 환경변수 fail-fast 작동.
- 컨테이너 단독 실행: 환경변수 누락 시 `PB_INTERNAL_URL required`로 명확한 fail, 컨테이너 죽지 않고 다음 19:00 UTC sleep 정확히 계산.
- 기본 `BACKUP_ON_START=0` 적용 — 즉시 실행 없이 sleep으로 들어감.

### 사용자 위임 (실 R2/도메인 필요)
- Acceptance criteria의 "백업 객체가 R2에 존재" — 실 R2 버킷/토큰 발급 후 RUNBOOK §7.3 절차로 첫 백업 + R2 console 확인.
- "복원 절차 문서화" — RUNBOOK §7.4로 충족. 실 리허설은 별도 staging.

---

## Phase 3 follow-up — ADR-2 갱신 (DDNS 옵션) — 2026-06-17 (commit f225151)

### 배경

S14 완료 직후 사용자가 "PB 도메인을 위해 매년 ~$10 지불하는 게 ADR-2의 '비용 0원' 의도와 맞는가?"를 재검토. 동시에 "외부 플랫폼 종속을 늘리고 싶지 않다"는 명확한 제약을 표명.

### 결정 분석

세 가지 대안을 평가:
- **Supabase free** — 7일 비활성 paused 정책이 단일 사용자 운동 패턴(주 2–3회)과 충돌 + ADR-1/2 폐기.
- **Fly.io free** — `.fly.dev` 자동 hostname이지만 새 플랫폼 종속.
- **Cloudflare Tunnel / Containers** — Quick Tunnel URL 휘발, Named는 도메인 필요, Containers 베타.
- **무료 DDNS (DuckDNS)** — 도메인 0원 + URL 미관 양보. **단순 DNS resolver라 추가 플랫폼 종속으로 간주 안 됨** (코드/데이터 lock-in 없음).

→ 사용자 선택: **A' — GCP+PB 유지 + DDNS 옵션 명문화**. ADR-2 의도(인프라 학습 + 비종속) 정합.

### 변경 파일
- `docs/ADR.md` — ADR-2 갱신: 컨텍스트에 "외부 의존 플랫폼을 늘리지 않으면서" 명문화, 도메인을 두 옵션(커스텀 / DDNS) 허용, 검토 후 기각 대안 4개 명시, 트레이드오프 정리.
- `docs/RUNBOOK.md` — §1.4 GCP Static IP 단계 추가 (VM 재시작 시 IP 보존 + DDNS 동기화 단순화), §3 도메인/DNS 섹션을 두 옵션으로 분리 (§3.A 커스텀 도메인 / §3.B DuckDNS 절차 + cron heartbeat).
- `infra/prod/.env.prod.example` — `DOMAIN` 주석에 두 옵션 모두 명시.
- `infra/prod/README.md` — 도메인 두 옵션 안내 한 줄.

### 코드/인프라 변경 없음

Caddy/compose/backup 컨테이너 모두 hostname-agnostic이라 코드 변경 없음. 운영자가 `.env`의 `DOMAIN=`을 어떤 형태로 채우든 동일 흐름.

### 다음 Story (S15)에 영향 줄 컨텍스트
- 프론트 도메인은 `.pages.dev`(또는 `.vercel.app`) 자동 발급. PB 도메인이 DDNS여도 CORS 화이트리스트 설정만 일관되면 무관.
- ADR-3(프론트 호스팅)도 비슷한 의사결정 검토 가치 있음 — S15 진입 전 ADR-3 재검토 자연스러움.

### 미해결 follow-up
- ADR-3 재검토 (CF Pages vs Vercel) — S15 진입 직전에 결정.
- 사용자가 실제 어느 옵션(커스텀/DDNS) 사용할지 — RUNBOOK 따라 진행 후 history에 기록.

---

## Phase 3 follow-up — ADR-3 갱신 (대안 검토 + 종속 정합성) — 2026-06-17 (commit 9ce7143)

### 배경

ADR-2 갱신 직후 사용자가 "ADR-3도 같은 방식으로 가다듬어 달라" 요청. ADR-2의 "외부 의존 플랫폼을 늘리지 않으면서" 원칙이 ADR-3에도 적용되는지, Vercel/GH Pages 같은 대안과의 비교가 ADR-3에 빠져있다는 인식.

### 변경

`docs/ADR.md` ADR-3:
- **컨텍스트**에 ADR-2의 "외부 종속 최소화" 원칙을 끌어와 평가 기준에 명시.
- **근거**를 4개로 정리:
  1. Next.js 파일 기반 라우팅 / React 생태계.
  2. static export = 호스팅 lock-in 0 (어디든 옮길 수 있음).
  3. `.pages.dev` 무료 hostname + 자동 SSL → ADR-2 "도메인 0원" 정합.
  4. ADR-6 R2와 같은 Cloudflare 계정 → 새 SaaS 추가가 아닌 기존 사용 범위 확장.
- **검토 후 기각된 대안 3개 명시**: Vercel(Hobby 라이선스 제약 + R2와 분리된 두 SaaS), GitHub Pages(PR preview 없음), 같은 GCP VM Caddy 서빙(메모리 빠듯 + edge 없음).
- **ADR-2와의 일관성** 섹션 추가 — Pages 의존이 데이터/코드 lock-in을 만들지 않음을 명문화.
- **트레이드오프** — Pages 정책 변경 시 산출물 plain 정적 파일이라 이전이 단순.

### 코드/인프라 변경 없음

순수 ADR 갱신. S15 진입 시 동일한 결정(CF Pages)으로 진행하되 의사결정 명세가 명확.

### 다음 (S15) 영향
- ADR-3 명세대로 `wrangler` 또는 `Cloudflare Pages` 대시보드를 통한 main 푸시 자동 배포 + PR preview 셋업.
- 빌드 명령 `pnpm build`, 출력 `out`, 환경변수 `NEXT_PUBLIC_PB_URL=<PB 도메인>`.

---

## Phase 3 follow-up — ADR-3 결정 변경 (CF Pages → VM Caddy) — 2026-06-17 (commit b5e76a3)

### 배경

ADR-3 가다듬기 직후 사용자가 "프론트만 GCP가 아닌 CF Pages에 두는 진짜 이점이 있나?"를 본질 질문. ADR-3에 적힌 이점(edge latency / 메모리 / 배포 자동화)을 단일 사용자 PWA 시나리오에서 재평가한 결과:

- **Edge latency**: SW 캐시로 첫 진입 외 0ms — 실 체감 무의미.
- **VM 메모리**: 정적 서빙 ~10MB 추가, 1GB 한도에 부담 없음.
- **배포 자동화**: CF Pages가 깔끔하지만 GitHub Actions로 동등 달성 가능.
- **ADR-2 일관성**: 인프라 학습 + 외부 종속 최소화 측면에서 VM 일원화가 더 정합.

→ 사용자 선택: **VM Caddy 정적 서빙**으로 결정 반전.

### 변경

`docs/ADR.md` ADR-3:
- **상태**에 "2026-06-17 결정 변경 — CF Pages → GCP VM Caddy" 추가.
- **결정** 본문 교체: PB와 같은 VM Caddy + 다른 hostname 블록.
- **근거 6개** 정리: Next.js 이점, 같은 VM 추가 인프라 0, ADR-2 학습 의도 일관, 모니터링 한 곳 통합, 장애 격리 손실 작음, 메모리 부담 무시 가능.
- **기각 대안**에 직전 결정인 CF Pages 추가 (재평가 결과 VM 일원화 우세).
- **트레이드오프**: self-managed 배포 자동화 / PR preview 부재 / edge 손실 (SW 캐시로 무관) / 이전 비용 1시간 미만.
- **구현 메모 (S15)**: Caddyfile 두 번째 hostname 블록 / docker-compose 디렉토리 마운트 / rsync 배포 + GitHub Actions follow-up / DDNS 서브도메인 2개.

`docs/STORIES.md` S15:
- 제목: "Cloudflare Pages 배포 파이프라인" → "**VM Caddy 정적 서빙 + 배포 파이프라인**"
- Dependencies: S04 → **S04, S13**
- Tasks 재정의: Caddyfile 블록 추가, compose 마운트, RUNBOOK §3에 두 hostname, rsync 절차, GitHub Actions 옵션, PB CORS 갱신, `NEXT_PUBLIC_PB_URL` 빌드 시점 주입.
- Acceptance: `https://<APP_DOMAIN>/` 정상 + HTTPS/SW/manifest + 30초 내 배포 반영.

### 코드/인프라 변경 없음

순수 ADR + STORIES 갱신. 실제 Caddyfile/compose/배포 스크립트 변경은 S15 작업 본체.

### 다음 (S15) 영향

- Caddyfile에 hostname 블록 1개 + Caddy `file_server` directive + SPA fallback (`try_files` 동등).
- DDNS를 사용하는 경우 `pb-<sub>.duckdns.org` + `app-<sub>.duckdns.org` 두 서브도메인 등록 (DuckDNS는 5개까지 무료).
- Caddyfile에서 `{$APP_DOMAIN}`/`{$PB_DOMAIN}` 두 변수로 분리 — 현재 `{$DOMAIN}`은 `{$PB_DOMAIN}`으로 명명 변경 권장.
- PB admin UI > Settings > Application > Allowed origins에 `https://<APP_DOMAIN>` 추가 (S13 follow-up #1 자동 처리).

### 미해결 (ADR 갱신 follow-up)
- 단일 와일드카드 인증서(`*.<sub>.duckdns.org`) vs 개별 인증서 비용 — Caddy는 둘 다 자동, Let's Encrypt rate limit 영향 평가 (현재 도메인 2개라 무관).

---

## Phase 3 follow-up — ADR-6 결정 변경 (R2 → GCS) + S14 재작성 — 2026-06-17 (commit e40a2e5)

### 배경

ADR-3 결정 변경 직후 사용자가 "백업 저장소로 Cloudflare R2를 쓰는데 그냥 GCP Storage 써도 되지 않나?"를 본질 질문. ADR-6 재평가:

- **R2 egress 무료가 빛나는 시나리오**: 다른 클라우드/로컬 PC로 자주 다운로드. **우리 시나리오 아님** — 복구는 같은 GCP VM에서 일어날 가능성 높고 1년에 1번 미만.
- **ADR-2 정합성**: R2는 Cloudflare 추가 종속, GCS는 GCP 한 곳 통합.
- **자격증명 노출**: R2는 `R2_ACCESS_KEY_ID`/`SECRET` 평문 환경변수 필수 / GCS는 VM Service Account metadata token → **자격증명 환경변수 노출 자체 사라짐**.

→ 사용자 선택: **GCS로 결정 변경**.

### 변경

`docs/ADR.md` ADR-6:
- 결정 본문 교체: GCS us-west1 + Service Account 인증.
- 근거 5개: ADR-2 통합 / GCS Always Free 5GB-month / Class A/B 한도 충분 / same region egress 무료 / Service Account = 자격증명 노출 0.
- 기각 대안에 직전 결정 R2 추가 (재평가 결과 우리 시나리오에서 egress 무료 이점 실현 안 됨).
- 트레이드오프 정리: 외부 region 복구는 < 1GB 무료 / Always Free 한도 충분.

`infra/prod/backup/backup.sh`:
- `R2_*` → `GCS_*` 환경변수.
- rclone remote `r2:` → `gcs:`.
- rclone backend `s3 (Cloudflare provider)` → `google cloud storage`.
- 인증: VM metadata token 자동 (env에 자격증명 0) 또는 SA file 옵션.

`infra/prod/docker-compose.prod.yml`:
- backup 서비스 환경변수: `R2_BUCKET/PREFIX/ACCESS_KEY/SECRET/ACCOUNT_ID` → `GCS_BUCKET/PREFIX/SERVICE_ACCOUNT_FILE`.
- `RCLONE_CONFIG_GCS_TYPE: "google cloud storage"` + `BUCKET_POLICY_ONLY: true` + `SERVICE_ACCOUNT_FILE` (비어있으면 metadata).
- backup 서비스에 `public` 네트워크 추가 (GCS 외부 호출).
- 로컬 테스트용 `${GCS_SERVICE_ACCOUNT_HOST_PATH}` host volume 마운트 옵션 (기본 `/dev/null`).

`infra/prod/.env.prod.example`:
- R2_* 4개 → GCS_BUCKET + SA 옵션 변수 2개.
- 운영(SA 첨부)은 두 변수 비워두고 metadata 사용 명시.

`docs/RUNBOOK.md` §7.0/§7.3:
- §7.0: R2 → GCS 표현 + 보안 한 줄 (자격증명 환경변수 노출 0).
- §7.3 전면 재작성:
  - §7.3.1 `gcloud storage buckets create` us-west1 + uniform IAM.
  - §7.3.2 SA 생성 + bucket-scoped `roles/storage.objectAdmin`.
  - §7.3.3 VM에 SA 첨부 (instances stop → set-service-account → start).
  - §7.3.4 lifecycle JSON으로 `auto/` prefix 30일 삭제 룰.
  - §7.3.5 `.env` 갱신 + 컨테이너 재시작.
  - §7.3.6 첫 백업 검증 + `gcloud storage ls`로 객체 확인.
  - §7.3.7 로컬 테스트용 SA key 발급 절차 (운영은 미사용).
- §7.4.1 복원 zip 다운로드: rclone 컨테이너 → `gcloud storage cp` 한 줄.
- §6.1 백업 실패 grep 안내 — R2 → GCS.

`infra/prod/README.md`:
- 백업 항목: R2 → GCS + Service Account 보안 강조.

`docs/STORIES.md`: 변경 없음 (S14는 이미 ✅, ADR-6 변경은 history에만).

### 검증

- `docker build infra/prod/backup` — alpine + rclone(GCS 백엔드 포함) + 모든 도구 OK.
- `docker compose -f infra/prod/docker-compose.prod.yml config --services` — 3개 서비스 인식, env 누락 fail-fast.
- backup.sh syntax + entrypoint.sh 변경 없음 (스케줄 로직 그대로).

### 다음 (S15) 영향
- 변경 없음 — S15는 프론트 정적 서빙 작업이라 백업 저장소와 무관.
- ADR-6 변경 덕분에 운영 모니터링이 GCP console 한 곳 (VM + GCS + IAM)으로 통합 — S15에서 우리가 ADR-3로 결정한 "모니터링 한 곳 통합"과 정합.

### 미해결 follow-up
- **VM SA 첨부 첫 적용** — 사용자 위임. RUNBOOK §7.3.3 명령 1회 실행 + history 기록.
- **GCS bucket 생성 + IAM + lifecycle** — RUNBOOK §7.3.1~4 명령 실행, GCS console에서 결과 확인.
- **R2 → GCS 이주 데이터** — 기존 R2에 백업이 있다면 `rclone copy r2:... gcs:...` 또는 폐기. 사용자 결정.

---

## Phase 3 follow-up — ADR-6 재변경 (GCS → R2) + 미디어 후보 명문화 — 2026-06-17 (commit 109db70)

### 배경

ADR-6 GCS 변경 직후 사용자가 "백업 외에 적극적인 객체 저장(인스타그램식 세션별 미디어)도 검토해야"라고 제기. 이후 대화에서 두 사실 정정:
1. **GCS도 S3 호환 가능** — Interoperability mode + HMAC keys로 PB file storage native 호환 (이전 "GCS는 PB native 미지원" 발언 부정확).
2. **앱 영상 재생도 모두 다운로드 egress** — HTTP range request로 바이트 전송 = egress. 브라우저/SW 캐시로 부분 회피 가능하나 PWA SW는 큰 파일(50MB+) 보통 캐시 안 함.

사용자 의사: **"폼 코칭/AI 분석용으로 쓸 것 같다 — 그래야 궁극적 목적에 맞으니까."**

→ 영상 반복 재생이 누적 패턴이면 R2 egress 무료가 다시 결정적 변수. **R2로 재변경.**

### 결정 분석

- 백업만 가정: GCS가 보안(SA metadata 인증) + ADR-2 종속 최소화에서 우세였음.
- 미디어 폼 코칭 적극 사용 가정: 한국 사용자가 us-west1 GCS에서 영상 반복 다운로드 시 egress 누적 (1GB/월 무료 후 ~$0.12/GB, 폼 분석 적극 사용 시 연 $13-60).
- R2 egress 무료 + PB native S3 호환 + 단일 인증 체계가 폼 코칭 시나리오에 명백히 우세.

### 변경

`docs/ADR.md` ADR-6:
- 제목: "백업/복구 전략" → "**객체 스토리지 전략 (백업 + 미디어)**".
- 컨텍스트: 두 사용처(백업 + 미디어) 명시. 폼 코칭/AI 분석이 미디어 적극 사용 의도.
- 결정: GCS → **Cloudflare R2** + S3 호환 (백업 rclone, 미디어 PB native file storage).
- 근거 5개: PB native S3 호환 / egress 무료 / Free tier 10GB / Class A/B 한도 / 백업+미디어 단일 인증.
- 기각 대안: GCS(직전 결정), AWS S3, B2, GCS+R2 하이브리드, VM 디스크.
- 트레이드오프: CF 종속 + access key 노출 vs 폼 코칭 트래픽 자유도.
- **재평가 트리거** 명시: 미디어 미도입 시 GCS 재검토 / R2 free tier 정책 변경 / 월 다운로드 100GB 초과.

`infra/prod/backup/backup.sh`: rclone remote `gcs:` → `r2:`, S3 backend + Cloudflare provider + access key 환경변수. 다른 보강 사항(`auto/` prefix, webhook, 진단 로그, unzip -t) 유지.

`infra/prod/docker-compose.prod.yml`: GCS env 4개 → R2 env 5개 + `--s3-no-check-bucket`. SA volume 마운트 제거. public network는 유지(R2 외부 호출).

`infra/prod/.env.prod.example`: GCS → R2 4개 + prefix 옵션 + 미디어용 별도 token 권장 주석.

`docs/RUNBOOK.md` §7.0/§7.3/§7.4:
- §7.0: GCS → R2 + 미디어 분리 한 줄.
- §7.3 R2 절차 복원(버킷 / 백업 전용 토큰 / lifecycle prefix `auto/` / .env / 첫 백업 검증). 미디어용 토큰 별도 발급 권장 노트 추가.
- §7.4.1 복원 zip 다운로드: gcloud → rclone 컨테이너.

`docs/PRD.md` §8 신규: **세션 미디어 (사진/영상 첨부) v1.1 후보**.
- 궁극적 목적과의 연결 (반복 재생 + AI 폼 코칭).
- 데이터 모델 후보 (별도 `media` 컬렉션 vs `*_logs.media[]`).
- R2 prefix `media/` 격리.
- UX 고려사항 (PWA file input + 비공개 + presigned URL).
- 트래픽 추정 (월 1-3GB 다운로드, R2 egress 무료).

`docs/STORIES.md` S18 신규 (Phase 4):
- "세션 미디어 (사진/영상 첨부)" — PB collection / file storage R2 전환 / 모바일 캡처 / 라이브러리 뷰.
- Acceptance: 4G 환경 30초 영상 1분 내 업로드 / 세션 상세 재생 / 미인증 차단.
- Out of scope (v1.2+): transcoding / AI 모델 연동.

`infra/prod/README.md`: "백업 + 미디어 객체 스토리지" 표현으로 갱신.

### 검증

- `docker build infra/prod/backup` — alpine + rclone S3 backend OK.
- `docker compose -f infra/prod/docker-compose.prod.yml config` — 3개 서비스 인식, 환경변수 fail-fast 작동.
- `grep -rn "GCS\|gcs:"` infra/prod + RUNBOOK — 잔여 흔적 0.

### 다음 (S15) 영향
- 변경 없음 — S15 프론트 정적 서빙은 객체 저장소와 무관.
- S15에서 PB CORS Allowed Origins 갱신 시 미디어 직접 다운로드 URL(R2 도메인)도 화이트리스트 검토 필요. v1.1 시점에 더 정확히.

### 미해결 follow-up
- **S14 acceptance "백업 객체가 R2에 존재"** — 실 R2 버킷/토큰 발급 후 RUNBOOK §7.3 절차로 첫 백업 + R2 console 확인. **사용자 위임**.
- **복원 리허설 1회** — 별도 staging 또는 macOS Docker에서 RUNBOOK §7.4 절차. **사용자 위임**.
- **미디어 access key 별도 발급** — v1.1 S18 진입 시 백업 토큰과 분리.
- **PB CORS 후 미디어 도메인 화이트리스트** — v1.1.

---

## S15 — 2026-06-17 (commit <pending>)

### 변경 파일 요약
- `infra/prod/Caddyfile` — 두 번째 hostname 블록(`{$APP_DOMAIN}`) 추가, `root /srv/app` + `file_server` + `try_files` + `handle_errors` 404 status 유지, 캐시 헤더 (`/_next/static/*` immutable, `/sw.js`/`/manifest.webmanifest`/`/icon.svg` no-cache, `*.html` no-cache), CSP 풀세트 (`connect-src 'self' https://{$PB_DOMAIN}` + `'unsafe-inline'` Next.js RSC 의도 주석).
- `infra/prod/docker-compose.prod.yml` — `${DOMAIN}` → `${PB_DOMAIN}` + `${APP_DOMAIN:?}` fail-fast, `${DATA_DIR}/app:/srv/app:ro` 마운트.
- `infra/prod/.env.prod.example` — `DOMAIN` → `PB_DOMAIN`/`APP_DOMAIN` split, 두 옵션(커스텀 도메인/DDNS) 주석 갱신.
- `infra/prod/README.md` — `DOMAIN` → `PB_DOMAIN`/`APP_DOMAIN` split, ADR-3 추가, 프론트 정적 서빙 안내, 일상 명령에 `$APP_DOMAIN` 추가.
- `docs/RUNBOOK.md`:
  - §3 두 hostname 등록 (커스텀 A 레코드 2개 / DuckDNS 콤마 묶음).
  - §4.0 권한 부트스트랩에 `chown -R "$USER:$USER" data/app` 추가.
  - §4.1 환경변수 주석 갱신.
  - **§8 프론트 배포 (신규)**: §8.1 로컬 rsync / §8.2 GitHub Actions secrets / SSH key 발급 / §8.3 PB CORS / §8.4 캐시 무효화.
  - §9 장애 대응 renumber (§8 → §9), §9.1에 "빈 응답 = 미배포 정상 신호" 한 줄.
- `.github/workflows/deploy-frontend.yml` *(신규)* — main 푸시 시 `pnpm install --frozen-lockfile` + `NEXT_PUBLIC_PB_URL` 주입 빌드 + `rsync -avz --delete-after`로 VM 전송 + `vars.APP_DOMAIN` 스모크 체크 (빈 값 skip).
- `docs/STORIES.md` — S15 → ✅ Done.
- `docs/review/phase-3.md` — S15 self-review append.

### 주요 의사결정·트레이드오프

#### 1. 두 hostname 분리 (`PB_DOMAIN` / `APP_DOMAIN`)
PB는 admin UI(`/_/`)·API라 frame-ancestors DENY + 별도 CORS 필요. 프론트는 정적 자산. 같은 hostname의 path 분리는 PB가 모든 path를 자기 것으로 봐서 불가 → hostname 분리. Caddy는 발급 단위가 hostname이라 자연.

#### 2. `${DOMAIN}` → `${PB_DOMAIN}`/`${APP_DOMAIN}` 재명명
prod 첫 배포 전이라 마이그레이션 부담 0. 호환 layer 두지 않고 깔끔히 split. RUNBOOK/README/Caddyfile 모두 일관.

#### 3. `--delete-after` (rsync)
새 자산 전송 후 옛 파일 삭제 → index가 새 chunks를 가리키기 전에 옛 chunks가 사라지는 윈도우 회피. e2-micro 디스크 30GB에 정적 자산 수MB라 일시 2× 사용 무관.

#### 4. CSP 풀세트 + `'unsafe-inline'` 의도 명시
Next.js RSC payload(`self.__next_f.push(...)`)가 인라인이라 `script-src 'unsafe-inline'` 불가피. `style-src`도 동적. hash 기반 좁힘은 빌드 시점 추출 필요 → v1.1 follow-up. 주석으로 의도 명시.

#### 5. 404 status 유지 (`handle_errors`)
`try_files` 마지막 `/404.html` fallback이 200 응답으로 fallback 서빙되지 않게 `handle_errors`로 404 status 유지. PWA Lighthouse 정확.

#### 6. 캐시 헤더 정책
- `/_next/static/*` — 1년 immutable (파일명 hash).
- `/sw.js`/`/manifest.webmanifest`/`/icon.svg` — no-cache (즉시 반영 필요).
- `*.html`/`/` — no-cache (매번 재검증).
- 외 — Caddy default(ETag).

#### 7. GitHub Actions secrets 패턴
`NEXT_PUBLIC_PB_URL` 빌드 시점 HTML embed(공개 의도). SSH key + DEPLOY_HOST/USER/PATH는 secrets. `APP_DOMAIN`은 공개 정보라 `vars`로 분리 → 스모크 체크에서 정상 사용.

### 다음 (Phase 4 / 사용자 위임)
- 사용자가 VM 셋업 + 도메인 등록 + 첫 배포 + GitHub Secrets 등록까지 1회 수행 후 history에 ✅ 한 줄 기록.
- ADR-3의 "30초 내 배포 반영" Acceptance가 자동 검증되려면 `vars.APP_DOMAIN`이 채워져 있어야 함 → 사용자 결정.

### 로컬에서 검증 완료
- `caddy validate` Caddyfile — **Valid configuration** (PB + APP 두 블록).
- `docker compose config` — 3개 서비스 인식, 환경변수 fail-fast.
- `NEXT_PUBLIC_PB_URL=https://pb.example.com pnpm build` — 15/15 static pages.

### 사용자 위임 (실 VM/도메인 필요)
- Acceptance criteria 3개 모두 — RUNBOOK §3 → §4 → §8 절차 실행 후 검증.
- `https://<APP_DOMAIN>/` 로그인 + 홈 + BottomNav 표시.
- Lighthouse PWA 점수 측정.
- main 푸시 후 30초 내 반영 확인 (자동화 활성 시).
