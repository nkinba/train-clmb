# Climb-Forge — 운영 RUNBOOK

운영 환경(PocketBase + Caddy)을 처음 띄우거나 재구축할 때 따라가는 절차.
백엔드는 GCP e2-micro (ADR-8, us-west1) 위에 단일 VM으로 운영.

---

## 1. VM 프로비저닝 (GCP)

### 1.1 인스턴스 생성

GCP Console 또는 `gcloud`로 e2-micro 인스턴스 생성:

```bash
gcloud compute instances create climb-forge-pb \
  --zone=us-west1-a \
  --machine-type=e2-micro \
  --image-family=debian-12 \
  --image-project=debian-cloud \
  --boot-disk-size=30GB \
  --boot-disk-type=pd-standard \
  --tags=http-server,https-server
```

- `e2-micro`: Always Free 적용 (1 vCPU shared, 1GB RAM).
- 디스크 30GB: Always Free 한도. SQLite + 백업 임시본 + 도커 이미지에 충분.

### 1.2 방화벽

```bash
gcloud compute firewall-rules create allow-http-https \
  --allow=tcp:80,tcp:443,udp:443 \
  --target-tags=http-server,https-server \
  --description="HTTP/HTTPS + HTTP/3"
```

- TCP 80: Caddy HTTP-01 challenge + HTTPS 리다이렉트.
- TCP 443: HTTPS.
- UDP 443: HTTP/3 (선택, Caddy가 자동 지원).

### 1.3 SSH 접속

```bash
gcloud compute ssh climb-forge-pb --zone=us-west1-a
```

### 1.4 Static IP (VM 재시작 시 IP 보존)

VM의 Ephemeral 외부 IP는 재시작 시 변경되어 DNS A 레코드가 깨질 수 있음. Static IP로 승격 — **VM이 켜져 있는 동안은 무료** (Always Free 한도 안).

```bash
# 1) Static 주소 예약 (현재 VM이 쓰는 ephemeral IP를 그대로 가져옴)
gcloud compute addresses create climb-forge-pb-ip \
  --region=us-west1

# 받은 IP 확인
gcloud compute addresses describe climb-forge-pb-ip --region=us-west1 \
  --format="get(address)"

# 2) VM의 외부 IP를 Static으로 교체
gcloud compute instances delete-access-config climb-forge-pb \
  --zone=us-west1-a \
  --access-config-name="external-nat"

gcloud compute instances add-access-config climb-forge-pb \
  --zone=us-west1-a \
  --access-config-name="external-nat" \
  --address=<위에서 받은 IP>
```

⚠️ Static IP를 reserve해두고 **할당된 VM이 없으면 시간당 과금** 시작. VM을 영구 삭제할 때는 같이 `gcloud compute addresses delete climb-forge-pb-ip --region=us-west1` 호출.

---

## 2. VM 초기 설정

이하 VM 안에서 수행 (Debian 12 기준).

### 2.1 swap 2GB (e2-micro 1GB RAM 대응)

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo "/swapfile none swap sw 0 0" | sudo tee -a /etc/fstab
free -h
```

### 2.2 Docker + Compose

```bash
# Docker 공식 설치 스크립트
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
rm get-docker.sh

# 현재 사용자에게 docker 권한
sudo usermod -aG docker $USER
newgrp docker  # 또는 로그아웃 후 재로그인

# 검증
docker --version
docker compose version
```

### 2.3 디렉토리 + 코드 배포

```bash
sudo mkdir -p /opt/climb-forge
sudo chown $USER:$USER /opt/climb-forge
cd /opt/climb-forge
git clone https://github.com/<owner>/<repo>.git .
```

또는 코드만 옮기는 경우 `rsync` / `scp`로 `infra/` + `web/` (선택) 만 옮겨도 무방.

---

## 3. 도메인 / DNS — 두 옵션 (ADR-2)

Caddy는 발급 단위가 **hostname**이라 커스텀 도메인이든 무료 DDNS든 후속 절차는 동일. 어느 쪽이든 `.env`의 `DOMAIN=`만 다르게 채우면 됨.

VM 외부 IP는 §1.4 절차 후:

```bash
gcloud compute addresses describe climb-forge-pb-ip --region=us-west1 --format="get(address)"
```

### 3.A 커스텀 도메인 (예: `pb.example.com`)

조건: 도메인 등록업체에 도메인 1개 보유 ($10/년대). DNS 관리는 어디서든 가능 (Cloudflare 추천 — 무료).

DNS 관리 콘솔에서 A 레코드 추가:

```
pb.<your-domain>.   A   <VM 외부 IP>   TTL 300
```

`.env` 예시:

```
DOMAIN=pb.your-domain.com
ACME_EMAIL=admin@your-domain.com
```

### 3.B 무료 DDNS (예: DuckDNS)

조건: 도메인 비용 0원. URL이 `<sub>.duckdns.org` 형태라 미관 양보. 단일 사용자 + hostname만 본인이 알면 됨이라 운영상 무해.

1. https://www.duckdns.org 접속 → GitHub/Google/Reddit/Twitter OAuth 로그인.
2. 빈 칸에 원하는 서브도메인 입력 (예: `climb-forge-pb`) → `add domain`.
3. 페이지 상단의 **token** 복사 (Slack 토큰 같은 UUID).
4. **현재 IP 1회 등록** — VM에서 또는 로컬에서:

   ```bash
   # SUBDOMAIN과 TOKEN을 채워 한 번 호출
   curl "https://www.duckdns.org/update?domains=<SUBDOMAIN>&token=<TOKEN>&ip=<VM 외부 IP>"
   # → "OK" 응답이면 성공
   ```

5. 전파 확인 (대개 1분 내):

   ```bash
   dig +short <SUBDOMAIN>.duckdns.org
   # → VM 외부 IP가 보이면 OK
   ```

§1.4의 **Static IP**를 적용했다면 한 번만 호출하면 끝. Ephemeral IP를 쓰는 경우 VM 부팅 시 동기화가 필요하지만 권장 안 함 (Static이 무료라 안전).

`.env` 예시:

```
DOMAIN=climb-forge-pb.duckdns.org
ACME_EMAIL=<본인이 받는 이메일>   # Let's Encrypt 만료 알림용, DuckDNS와 무관
```

⚠️ DDNS 측에서 일정 기간 IP 업데이트가 없으면 서브도메인을 회수할 수 있음 (DuckDNS 기준 약 30일). Static IP면 변경 없지만 안전을 위해 월 1회 cron으로 위 `curl` 한 번 호출하는 것을 권장:

```bash
# crontab -e 에 추가 (VM 시간대 무관)
0 4 1 * * curl -fsS "https://www.duckdns.org/update?domains=<SUBDOMAIN>&token=<TOKEN>&ip=" >/dev/null
```

(IP를 빈 값으로 보내면 DuckDNS가 호출 source IP를 자동 사용.)

---

## 4. 첫 부팅

### 4.0 데이터 디렉토리 + 권한 (Linux prod 필수)

PocketBase 컨테이너는 비-root user `pb`(uid 100, gid 101)로 실행되므로 host mount의 `pb_data`도 그 uid가 쓸 수 있어야 한다. macOS Docker Desktop은 자동 처리하지만 **Linux는 명시적 권한 설정 필요**.

```bash
sudo mkdir -p /opt/climb-forge/data/{pb_data,caddy_data,caddy_config}
sudo chown -R 100:101 /opt/climb-forge/data/pb_data
sudo chown -R root:root /opt/climb-forge/data/caddy_data /opt/climb-forge/data/caddy_config
```

### 4.1 환경변수

```bash
cd /opt/climb-forge/infra/prod
cp .env.prod.example .env
vi .env   # DOMAIN, ACME_EMAIL, DATA_DIR=/opt/climb-forge/data 채움
```

### 4.2 syntax 검증 → 빌드/실행

```bash
docker compose -f docker-compose.prod.yml --env-file .env config >/dev/null   # syntax/env 누락 fail-fast
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

- 첫 빌드 시 PocketBase 0.22.21 바이너리 다운로드 + SHA256 검증.
- Caddy가 도메인 valid 확인 후 Let's Encrypt 인증서 자동 발급 (수 초 ~ 1분).

상태 확인:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f caddy   # 인증서 발급 로그
```

### 4.3 PocketBase admin 초기화

브라우저 → `https://<DOMAIN>/_/`

첫 접속 시 admin 생성 폼 노출. email/password 입력 → 저장.
이후 admin 자격증명을 안전한 곳에 보관 (1Password 등).

### 4.4 일반 user 생성

Climb-Forge 프론트엔드는 일반 user(`users` 컬렉션) 인증을 사용 — admin과 별개:

1. admin UI에서 `Collections > users > + New record`.
2. email, password 입력 + `verified: true` 체크.
3. 이 자격증명을 프론트엔드 `.env.local`의 `CF_TEST_EMAIL`/`CF_TEST_PASSWORD`로 사용 (선택, smoke 검증용).

---

## 5. 검증

### 5.1 health

```bash
curl -fsS https://<DOMAIN>/api/health
# → {"code":200,"message":"API is healthy.","data":{"canBackup":true}}
```

### 5.2 응답 시간 (한국에서)

```bash
curl -o /dev/null -s -w "time_total: %{time_total}s\n" https://<DOMAIN>/api/health
```

ADR-8 us-west1 기준 RTT ~150ms 예상.

### 5.3 HTTPS 등급

```bash
curl -I https://<DOMAIN>/api/health
```

응답 헤더에 `strict-transport-security` 등이 보이는지 확인.

브라우저로 `https://www.ssllabs.com/ssltest/analyze.html?d=<DOMAIN>` 점수 측정 (A+ 목표).

---

## 6. 일상 운영

### 6.1 로그

```bash
cd /opt/climb-forge/infra/prod
docker compose -f docker-compose.prod.yml logs -f --tail 100
```

**백업 실패 주간 점검** (BACKUP_ALERT_WEBHOOK 미설정 시):

```bash
docker compose -f docker-compose.prod.yml logs --since 7d backup | grep -E 'FAILED|ERROR'
# 빈 출력이면 OK. 항목이 보이면 해당 timestamp 로그 풀로 확인 + 자격증명/R2/PB endpoint 점검.
```

### 6.2 재시작

```bash
docker compose -f docker-compose.prod.yml restart pocketbase
```

### 6.3 마이그레이션 적용

새 마이그레이션을 `infra/pocketbase/pb_migrations/`에 추가 후:

```bash
git pull
docker compose -f docker-compose.prod.yml restart pocketbase
docker compose -f docker-compose.prod.yml logs --tail 50 pocketbase   # 적용 확인
```

### 6.4 PocketBase 버전 업그레이드

`infra/pocketbase/Dockerfile`의 `PB_VERSION` + `PB_SHA256` 갱신:

1. https://github.com/pocketbase/pocketbase/releases/download/v<NEW>/checksums.txt 확인.
2. Dockerfile case 문에서 amd64/arm64 SHA256 교체.
3. PR + 머지 후 VM에서:
   ```bash
   git pull
   docker compose -f docker-compose.prod.yml up -d --build
   ```

**롤백** — `docker compose ... up -d --build` 실패 시 (SHA mismatch 등):

```bash
git checkout <이전 commit sha> -- infra/pocketbase/Dockerfile
docker compose -f docker-compose.prod.yml up -d --build
```

또는 `--build` 없이 직전 이미지 태그로 재기동 (이미지가 캐시에 남아있는 경우):

```bash
docker compose -f docker-compose.prod.yml up -d
```

⚠️ v0.23+로 점프 시 `Dao` → `app` API 변경이 마이그레이션을 깨뜨릴 수 있음. 미리 별도 인스턴스에서 검증.

⚠️ **백업 컨테이너 호환성** — v0.23+에서 admin 컬렉션이 `_superusers`로 통합되며 `/api/admins/auth-with-password` endpoint와 `Authorization` 헤더 형식이 변경됨. 업그레이드 후 다음 19:00 UTC 백업이 silent fail하지 않도록 즉시 검증:

```bash
docker compose -f docker-compose.prod.yml logs --tail 100 backup
# 또는 BACKUP_ON_START=1로 즉시 1회 실행해 호환성 확인:
BACKUP_ON_START=1 docker compose -f docker-compose.prod.yml up -d backup
```

깨진 경우 `infra/prod/backup/backup.sh`의 auth endpoint·Authorization 헤더를 업데이트.

---

## 7. 백업

### 7.0 자동 일일 백업 (S14, ADR-6)

`infra/prod/backup/` 컨테이너가 매일 04:00 KST(=19:00 UTC)에 다음을 수행:

1. PocketBase admin API `POST /api/admins/auth-with-password` 토큰 발급
2. `POST /api/backups` — PB 서버 측에서 WAL 일관성 보장 zip 생성
3. zip 다운로드 + 무결성 검증 → **Cloudflare R2** 업로드 (rclone, S3 호환)
4. PB 서버 측 zip 정리 (디스크 절약)
5. R2 30일 이전 객체 cleanup (lifecycle 룰의 이중 안전망)

스케줄/대상 변경은 `.env`의 `BACKUP_HOUR_UTC` / `BACKUP_MINUTE_UTC` / `R2_BUCKET`.

**미디어 분리:** v1.1에서 PB file storage가 같은 R2를 사용하지만 prefix(`media/`) 또는 별도 access key/버킷으로 권한·cleanup 격리.

### 7.1 PocketBase admin API (수동, 권장 — WAL 일관성 보장)

PocketBase는 내부에서 일관 스냅샷 zip을 만들어주는 admin API를 제공한다. SQLite WAL이 안전하게 체크포인트된 상태로 묶이기 때문에 **수동 tar보다 안전**.

```bash
# admin 토큰 발급
TOKEN=$(curl -s -X POST https://<DOMAIN>/api/admins/auth-with-password \
  -H "Content-Type: application/json" \
  -d '{"identity":"<ADMIN_EMAIL>","password":"<ADMIN_PW>"}' | jq -r .token)

# 백업 생성 (서버 측에서 zip 묶음 — pb_data 위에 'backups/' 폴더 생김)
curl -s -X POST https://<DOMAIN>/api/backups \
  -H "Authorization: $TOKEN" \
  -d '{"name":"manual-'"$(date +%Y%m%d)"'"}'

# 다운로드 (또는 VM에서 직접 ${DATA_DIR}/pb_data/backups/ 복사)
curl -L -o backup.zip "https://<DOMAIN>/api/backups/manual-$(date +%Y%m%d).zip?token=$TOKEN"
```

### 7.2 수동 tar (admin API 불가 시 fallback)

```bash
cd /opt/climb-forge/infra/prod
docker compose -f docker-compose.prod.yml stop pocketbase

# WAL 체크포인트 — 실행 후 data.db에 변경 사항 통합되어 tar 일관성 ↑.
# 컨테이너 안 sqlite3 또는 호스트의 sqlite3 사용.
sudo apt-get install -y sqlite3
sudo sqlite3 data/pb_data/data.db "PRAGMA wal_checkpoint(TRUNCATE);"

sudo tar czf /tmp/climb-forge-backup-$(date +%Y%m%d).tar.gz -C data pb_data
docker compose -f docker-compose.prod.yml start pocketbase
```

복원:

```bash
docker compose -f docker-compose.prod.yml stop pocketbase
sudo rm -rf data/pb_data
sudo tar xzf <backup>.tar.gz -C data
sudo chown -R 100:101 data/pb_data    # 비-root user 권한 복원
docker compose -f docker-compose.prod.yml start pocketbase
```

### 7.3 R2 셋업 (자동 백업 처음 띄울 때 1회)

#### 7.3.1 버킷 생성

Cloudflare Dashboard → R2 → **Create bucket**:
- 이름: `climb-forge-backups` (또는 원하는 값 — `.env`의 `R2_BUCKET`과 일치).
- 위치: Automatic 또는 가까운 region.
- 미디어(v1.1)가 같은 버킷에 들어올 예정이면 `climb-forge-storage` 같은 일반 명칭도 OK.

#### 7.3.2 백업 전용 API 토큰 발급

R2 → **Manage API Tokens** → **Create API token**:
- Permission: **Object Read & Write**
- Specify bucket: 위에서 만든 단일 버킷만 (다른 버킷 영향 차단).
- TTL: 만료 없음 (운영) 또는 1년 (보안 강화).
- Generate → 보이는 **Access Key ID** / **Secret Access Key** / **Account ID**를 1Password 등에 즉시 저장. 한 번만 표시됨.

> **미디어용 토큰은 별도 발급 권장** (S18 v1.1) — `media/` prefix 한정 권한, PB env에 분리 주입. 백업 토큰이 새도 미디어에 영향 0, 역도 동일.

#### 7.3.3 lifecycle 룰

R2 → 버킷 선택 → **Settings → Object lifecycle rules → Add rule**:
- Prefix: `auto/` — 백업 컨테이너가 `auto/climb-forge-*.zip`에 격리. 다른 prefix 영향 0.
- Action: **Delete objects** after **30 days**.

rclone의 `--min-age 30d` cleanup이 이중 안전망(같은 `auto/` 안에서만 동작). R2 lifecycle 룰이 우선이라 R2 측에 부담 위임.

미디어(v1.1)는 별도 prefix(`media/`) — lifecycle 룰 적용 안 함(사용자가 명시적 삭제할 때까지 영구 보관).

#### 7.3.4 `.env` 설정 + 컨테이너 재시작

```bash
cd /opt/climb-forge/infra/prod
vi .env   # R2_BUCKET, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
          # PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD 채움.
docker compose -f docker-compose.prod.yml --env-file .env up -d --build backup
```

#### 7.3.5 첫 백업 검증

```bash
# 컨테이너 시작 + 즉시 1회 실행 (BACKUP_ON_START=1):
BACKUP_ON_START=1 docker compose -f docker-compose.prod.yml --env-file .env up -d --build backup
docker compose -f docker-compose.prod.yml logs --tail 50 backup
```

성공 로그 예시:

```
[...Z] START backup climb-forge-20260617-110000.zip → r2://climb-forge-backups/auto/
[...Z] auth admin
[...Z] create snapshot ...
[...Z] download ...
[...Z] snapshot size: 24576 bytes
[...Z] upload to r2://climb-forge-backups/auto/climb-forge-...zip
[...Z] cleanup PB server-side snapshot
[...Z] cleanup R2 auto/ backups older than 30d
[...Z] OK backup completed ...
```

R2 console에서 객체 존재 확인.

이후 `BACKUP_ON_START=0`(또는 미설정)로 되돌리고 재시작:

```bash
unset BACKUP_ON_START
docker compose -f docker-compose.prod.yml --env-file .env up -d backup
```

### 7.4 복원 리허설 (1회 권장, S14 acceptance)

복원 절차의 신뢰성은 **실제로 한 번 해본 다음**에만 보장됨. **별도 staging VM(또는 로컬 macOS Docker)**에서 다음을 1회 수행하고 결과를 `docs/history/phase-3.md`에 기록:

#### 7.4.1 R2에서 백업 zip 다운로드

```bash
docker run --rm \
  -e RCLONE_CONFIG_R2_TYPE=s3 \
  -e RCLONE_CONFIG_R2_PROVIDER=Cloudflare \
  -e RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
  -e RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
  -e RCLONE_CONFIG_R2_ENDPOINT="https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com" \
  -e RCLONE_CONFIG_R2_REGION=auto \
  -v "$PWD:/data" \
  rclone/rclone:latest copy r2:climb-forge-backups/auto/<백업파일명> /data/
```

#### 7.4.2 PB 인스턴스에 복원

격리된 staging compose로 띄운 PB에 admin 인증 + `POST /api/backups/upload` + `POST /api/backups/restore`:

```bash
TOKEN=$(curl -s -X POST http://localhost:8090/api/admins/auth-with-password \
  -H "Content-Type: application/json" \
  -d '{"identity":"<ADMIN>","password":"<PW>"}' | jq -r .token)

# zip 업로드
curl -s -X POST http://localhost:8090/api/backups/upload \
  -H "Authorization: $TOKEN" \
  -F "file=@<백업파일명>"

# 복원 (PB가 자동 재시작됨)
curl -s -X POST http://localhost:8090/api/backups/<백업파일명>/restore \
  -H "Authorization: $TOKEN"
```

또는 더 단순한 경로 — pb_data 디렉토리 자체를 zip에서 직접 추출:

```bash
docker compose stop pocketbase
sudo rm -rf data/pb_data
sudo unzip <백업파일명> -d data/pb_data
sudo chown -R 100:101 data/pb_data
docker compose start pocketbase
```

#### 7.4.3 검증

복원된 인스턴스의 `https://<staging-domain>/_/`에 admin 로그인 → `sessions` 등 컬렉션에 운영 row가 보이면 OK. user 자격증명도 그대로 동작해야 함.

리허설 후 한 줄 기록:

```bash
# docs/history/phase-3.md S14 섹션에:
# ✅ 복원 리허설 완료 (2026-XX-XX). 백업 zip → staging 복원 → admin/user/session row 일치 확인.
```

---

## 8. 장애 대응

### 8.1 인증서 발급 실패

```bash
docker compose -f docker-compose.prod.yml logs caddy | grep -i error
```

흔한 원인:
- DNS A 레코드가 아직 전파 안 됨 → `dig +short <DOMAIN>` 으로 확인.
- 방화벽 80/443 닫혀있음.
- ACME_EMAIL 미설정 또는 잘못된 형식.

### 8.2 PocketBase가 시작 안 됨

```bash
docker compose -f docker-compose.prod.yml logs pocketbase
```

- 마이그레이션 에러: `data/pb_data` 권한 또는 새 마이그레이션 문법 검증.
- 디스크 가득 참: `df -h`. 백업 임시 파일 정리.

### 8.3 OOM (e2-micro 1GB)

`free -h`로 swap 사용 확인. swap 부족이면 1.5GB로 증설.
Caddy/PB 메모리 사용은 평상시 합쳐서 150~250MB 수준.
