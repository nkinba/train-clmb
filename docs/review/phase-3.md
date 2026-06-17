# Phase 3 — Review

## S13 — 2026-06-17

### Subagent (general-purpose) 원문

종합 평가: **accept-with-fixes**. Story acceptance criteria(`/_/` admin UI 접근, RTT 측정 절차)는 RUNBOOK §4.1/§5.2에 안전하게 명시되어 있고 보안 기본기(SHA256 검증, 비-root, internal 네트워크, `admin off`, HSTS+preload)도 잘 잡혀 있다. 다만 (1) WAL 일관성·SQLite 백업 안전성, (2) Caddy `header_up X-Real-IP` 이중 헤더 가능성, (3) DATA_DIR 상대경로/볼륨 부트스트랩, (4) Caddy 로그 `format console` 운영 부적합 — 이 네 가지는 머지 전 정리 권장.

#### 🔴 Critical
- `docs/RUNBOOK.md:225-243` & `infra/pocketbase/README.md:63-69` — `stop pocketbase → tar → start` 절차의 WAL 일관성 미보장. PB admin API `POST /api/backups` 우선 권장 + 수동 tar 시 `wal_checkpoint(TRUNCATE)` 노트.
- `infra/prod/docker-compose.prod.yml:30,51-52` — `${DATA_DIR:-./data}` 상대경로 + 디렉토리 자동 생성. Linux prod 첫 부팅 시 비-root user(uid 100) 권한 부족 가능. mkdir + chown 100:101 + DATA_DIR 명시 단계 추가.

#### 🟡 Suggested
- `Caddyfile:16-18` — `X-Real-IP` 명시 잉여. Caddy 기본 동작 신뢰.
- `Caddyfile:38-42` — `format console` → `format json` (운영 grep/jq 표준).
- `infra/prod/README.md:54-55` — admin endpoint mitigation을 "강한 비밀번호"에서 멈추지 말고 Caddy IP allowlist 스니펫 + 적용 시점 명시.
- `docker-compose.prod.yml:54-55` — DOMAIN/ACME_EMAIL fail-fast가 caddy environment에만 적용. RUNBOOK에 `compose config` 단계 추가.
- `RUNBOOK.md:209-221` — SHA256 갱신 시 롤백 절차 한 줄 부재.
- `docker-compose.prod.yml:32-37` — healthcheck `start_period: 10s`는 첫 부팅 마이그레이션에 부족할 수 있음. `30s + interval 10s` 권장.

#### 🟢 Nit
- `Dockerfile:39` — `/home/pb` dead weight.
- `infra/prod/README.md:9-15` — ASCII 다이어그램에 public net 캡션 추가.
- `infra/pocketbase/README.md:71-78` — "프로덕션 (S13 영역)" TODO → ✅ 갱신.
- ADR-2 "이미지 동일, 네트워크 정책만 분리" 한 줄 명시.

#### 합격 항목 요약
- SHA256 핀 + 아키텍처 분기, 비-root user, pb_migrations:ro, internal/public 네트워크 분리, `admin off`, HSTS+preload+보안 헤더 풀세트, `depends_on: condition: service_healthy`, gzip+zstd+HTTP/3, `.gitignore` 정확, RUNBOOK 처음 보는 사람도 따라갈 수 있는 흐름, e2-micro OOM 언급, Acceptance Criteria 매핑 명확.

### 본인 수용/반박 판단

| 항목 | 결정 | 사유 |
| --- | --- | --- |
| 🔴 WAL 일관성 백업 | **수용** | RUNBOOK §7.1 PB admin API + §7.2 fallback에 wal_checkpoint 명시. |
| 🔴 DATA_DIR 권한 부트스트랩 | **수용** | RUNBOOK §4.0 mkdir+chown 100:101 + `.env.prod.example` DATA_DIR 활성. |
| 🟡 X-Real-IP 잉여 | **수용** | `reverse_proxy pocketbase:8090` 단일 라인. |
| 🟡 log format json | **수용** | docker logs grep/jq 표준. |
| 🟡 admin IP allowlist 예시 | **수용** | `infra/prod/README.md`에 Caddyfile 스니펫 + 적용 시점 명시. |
| 🟡 DOMAIN/ACME_EMAIL fail-fast | **반박** | `:?` 패턴이 caddy 시작 시 강제. RUNBOOK §4.2에 `compose config` 단계만 추가. |
| 🟡 SHA256 갱신 롤백 | **수용** | RUNBOOK §6.4에 git checkout fallback. |
| 🟡 healthcheck start_period | **수용** | 30s + interval 10s. |
| 🟢 home dir / wget 사이즈 | **반박** | 무해, 변경 위험 회피. |
| 🟢 다이어그램 캡션 | **수용** | `public net: caddy only` 추가. |
| 🟢 infra/pocketbase README 갱신 | **수용** | ✅ S13 처리됨 명시. |
| 🟢 ADR-2 한 줄 | **수용** | "이미지 동일, 네트워크 정책만 분리" 한 줄. |
