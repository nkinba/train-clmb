# PocketBase — Climb-Forge

ADR-1, ADR-2 기반 백엔드. 단일 바이너리 + SQLite. 로컬 ↔ GCP 모두 동일 Dockerfile.

## 빠른 시작 (로컬)

```bash
cd infra/pocketbase
docker compose up --build
```

첫 실행 시:
1. 컨테이너 빌드(약 30초): 호스트 아키텍처에 맞는 PocketBase 0.22.21 바이너리 다운로드.
2. 마이그레이션 자동 실행: `pb_migrations/1750000001_initial_schema.js`가 5개 컬렉션 + 인덱스를 생성.
3. 첫 부팅 시 admin 생성을 위해 콘솔 출력에 표시되는 URL로 접속.

## 관리자 생성 (최초 1회)

`docker compose up` 후 콘솔에 다음과 같은 줄이 표시됨:

```
Server started at http://0.0.0.0:8090
> Admin UI: http://0.0.0.0:8090/_/
```

브라우저로 `http://localhost:8090/_/` 접속 → admin 이메일/비밀번호 입력.
**저장된 admin 자격은 호스트의 `pb_data/` (gitignore됨)에 보관됨.** 절대 commit 금지.

## 일반 사용자 생성

ADR-5(단일 사용자 인증) 정책에 따라:
1. admin 로그인 후 `Collections > users > New record`
2. 이메일 + 비밀번호 입력 → 저장
3. 이 사용자가 프론트에서 로그인할 계정. CRUD 권한은 본 마이그레이션의 rule(`@request.auth.id != ''`)로 자동 부여.

## API 확인 (sanity check)

```bash
# 헬스 체크
curl http://localhost:8090/api/health
# → {"code":200,"message":"API is healthy.","data":{}}

# 컬렉션 메타 (admin 토큰 필요 — 실제 호출은 admin UI에서 권장)
```

## 스키마 변경

새 마이그레이션은 `pb_migrations/`에 `<unix_timestamp>_<설명>.js` 형식으로 추가.
컨테이너 재시작 시 자동 실행. 적용된 마이그레이션은 `_migrations` 내부 컬렉션에 기록됨.

## 데이터 초기화 (개발용)

```bash
docker compose down
rm -rf pb_data
docker compose up
```

`pb_data`를 삭제하면 admin/users/마이그레이션 기록 모두 초기화됨. 다시 처음부터.

## 백업 (S14 영역)

자동 백업은 S14에서 구현(cron + R2). 현재는 수동 백업만:

```bash
docker compose stop
tar czf backup-$(date +%Y%m%d).tar.gz pb_data
docker compose start
```

## 프로덕션

운영 환경은 `infra/prod/`. 다음 항목은 **S13에서 모두 적용됨**:
- ✅ **Caddy reverse proxy + autotls** — `infra/prod/Caddyfile` 자동 Let's Encrypt + HSTS/X-Frame-Options 등 보안 헤더.
- ✅ **컨테이너 비-root 사용자** — 본 Dockerfile에 `USER pb` (uid 100, gid 101). 로컬·prod 동일.
- ✅ **PocketBase 바이너리 SHA256 검증** — 본 Dockerfile의 download 단계.
- 🔜 **CORS 화이트리스트** — PB admin UI에서 첫 부팅 후 수동 설정. RUNBOOK §4.3 참조.
- 🔜 **자동 백업** — **S14**에서 cron + R2.

처음 띄우는 단계는 `docs/RUNBOOK.md` 참조.

## 주요 결정

- **PocketBase 0.22.21** 핀: 안정 버전. v0.23+ 마이그레이션 시 `Dao` → `app` API 변경 필요.
- **healthcheck**: `wget /api/health`로 30초 주기 체크.
- **포트 바인딩**: `127.0.0.1:8090`만 — 로컬 외부 노출 차단 (운영은 Caddy를 통해서만).
- **`pb_migrations`를 read-only로 마운트** — 컨테이너에서 임의 수정 방지.
