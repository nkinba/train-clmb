# prod — Climb-Forge 운영 인프라

PocketBase + Caddy(자동 SSL) 2-컨테이너 구성. ADR-2, ADR-6, ADR-8.

처음 띄우기: **`docs/RUNBOOK.md`** 참조 (VM 프로비저닝 / 도메인 / 첫 부팅).

## 구성

```
internet ──443──> caddy (public + internal)
                      │
                      └─[internal only]─> pocketbase (internal only)
                                                │
                                                └── /pb_data (host volume)
```

- **pocketbase**: `../pocketbase/Dockerfile`로 빌드(ADR-2 로컬과 동일 이미지). host 8090 노출 X — Caddy를 통해서만.
- **caddy**: host 80/443 바인딩. 자동 Let's Encrypt SSL + HTTP/3 + 보안 헤더.
- **internal network**: PB와 Caddy만. 외부 접근 차단.
- **public network**: Caddy만. 외부 80/443 진입점.

> ADR-2: 이미지는 로컬·prod 동일. compose의 네트워크 정책만 분리 (로컬 = host 8090, prod = internal only).

## 파일

- `docker-compose.prod.yml` — compose 정의
- `Caddyfile` — reverse proxy + TLS + 보안 헤더
- `.env.prod.example` — DOMAIN, ACME_EMAIL, DATA_DIR 템플릿
- `.env` *(gitignore)* — 실제 값
- `data/` *(gitignore)* — pb_data + caddy 인증서

## 일상 명령

```bash
cd /opt/climb-forge/infra/prod

# 시작 / 중지
docker compose -f docker-compose.prod.yml --env-file .env up -d
docker compose -f docker-compose.prod.yml down

# 상태
docker compose -f docker-compose.prod.yml ps
curl -fsS https://$DOMAIN/api/health

# 로그
docker compose -f docker-compose.prod.yml logs -f --tail 200
docker compose -f docker-compose.prod.yml logs --tail 50 caddy
docker compose -f docker-compose.prod.yml logs --tail 50 pocketbase

# 재시작 (마이그레이션 반영 등)
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

## 알려진 주의사항

- **CORS**: PocketBase admin UI > Settings > Application > "Allowed origins"에 프론트 도메인을 명시. `*` 그대로 두면 ADR-5의 단일 사용자 가정과 어긋남.
- **admin endpoint 노출**: `/_/`와 `/api/admins/*`는 외부 접근 가능. 자격증명만이 방어선. 사용자 IP가 고정이면 **Caddyfile에 IP allowlist 1회 추가**가 거의 무료의 추가 방어:
  ```caddyfile
  {$DOMAIN} {
      @admin {
          path /_/* /api/admins/*
          not remote_ip <HOME_OR_OFFICE_IP>
      }
      respond @admin 403
      reverse_proxy pocketbase:8090
      # ... 기존 header/encode/log 그대로
  }
  ```
  적용 시점: 도메인 발급 + 첫 admin 로그인 직후 (자기 자신을 막지 않도록 IP 확정 후).
- **swap 2GB**: e2-micro RAM 1GB라 빌드/마이그레이션 시 OOM 가능. RUNBOOK §2.1 참조.
- **백업**: 현재는 수동. RUNBOOK §7.1의 PocketBase admin API 방식이 WAL 일관성 안전. **S14**에서 cron + R2 자동화.

## 변경 영향

`Dockerfile` / `docker-compose.prod.yml` / `Caddyfile` 변경 시:

1. 로컬에서 `docker compose -f docker-compose.prod.yml --env-file .env.local-prod config` 로 syntax 확인.
2. staging 인스턴스 있으면 그쪽 먼저.
3. main 머지 → VM `git pull && docker compose ... up -d --build`.
