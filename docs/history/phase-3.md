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
