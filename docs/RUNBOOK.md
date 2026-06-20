# Breakteau — 운영 RUNBOOK

운영 환경(PocketBase + Caddy)을 처음 띄우거나 재구축할 때 따라가는 절차.
백엔드는 GCP e2-micro (ADR-8, us-west1) 위에 단일 VM으로 운영.

---

## 1. VM 프로비저닝 (GCP)

### 1.1 인스턴스 생성

GCP Console 또는 `gcloud`로 e2-micro 인스턴스 생성:

```bash
gcloud compute instances create breakteau-pb \
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
gcloud compute ssh breakteau-pb --zone=us-west1-a
```

### 1.4 Static IP (VM 재시작 시 IP 보존)

VM의 Ephemeral 외부 IP는 재시작 시 변경되어 DNS A 레코드가 깨질 수 있음. Static IP로 승격 — **VM이 켜져 있는 동안은 무료** (Always Free 한도 안).

```bash
# 1) Static 주소 예약 (현재 VM이 쓰는 ephemeral IP를 그대로 가져옴)
gcloud compute addresses create breakteau-pb-ip \
  --region=us-west1

# 받은 IP 확인
gcloud compute addresses describe breakteau-pb-ip --region=us-west1 \
  --format="get(address)"

# 2) VM의 외부 IP를 Static으로 교체
gcloud compute instances delete-access-config breakteau-pb \
  --zone=us-west1-a \
  --access-config-name="external-nat"

gcloud compute instances add-access-config breakteau-pb \
  --zone=us-west1-a \
  --access-config-name="external-nat" \
  --address=<위에서 받은 IP>
```

⚠️ Static IP를 reserve해두고 **할당된 VM이 없으면 시간당 과금** 시작. VM을 영구 삭제할 때는 같이 `gcloud compute addresses delete breakteau-pb-ip --region=us-west1` 호출.

---

## 2. VM 초기 설정

이하 VM 안에서 수행 (Debian 12 기준).

### 2.1 swap 2GB (e2-micro 1GB RAM 대응)

**왜 필요한가:** e2-micro는 RAM 1GB. steady state로 Linux+Docker+PB+Caddy+backup이 약 500MB 점유, 여유 500MB가 다음 **transient spike**에 부족:

- `docker compose up --build` — PB/Caddy 이미지 빌드 시 일시적으로 500MB+
- PB `POST /api/backups` — pb_data 전체(DB + uploads) 압축 시 메모리 피크 (미디어 누적 시 ↑)
- SQLite VACUUM / WAL checkpoint, 마이그레이션 다수 record 변환
- rsync 수신 중 file system 캐시 압력

이 spike가 RAM 한계를 넘으면 **Linux OOM killer가 가장 큰 프로세스(보통 PB)를 SIGKILL** → 사이트 down + WAL 미체크포인트로 SQLite 손상 위험.

**swap 2GB의 역할:**
- spike 시 LRU 페이지를 disk로 내려 RAM 확보 → OOM 회피
- steady state에선 swap 거의 안 씀(`free -h`의 used ~0)
- "5초 swap I/O 페널티" vs "PB 프로세스 강제 종료" trade-off에서 후자 회피가 압도적 우세
- 디스크 30GB 중 2GB는 보험료 ≈ 0

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo "/swapfile none swap sw 0 0" | sudo tee -a /etc/fstab
free -h
```

**점검 시점**: 주 1회 `free -h`로 `Swap: used`가 100MB+ 지속되면 RAM 부족 신호 → 머신 타입 업그레이드(e2-small 등) 검토. 평소 0~수십MB 수준이 정상.

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
sudo mkdir -p /opt/breakteau
sudo chown $USER:$USER /opt/breakteau
cd /opt/breakteau
git clone https://github.com/<owner>/<repo>.git .
```

또는 코드만 옮기는 경우 `rsync` / `scp`로 `infra/` + `web/` (선택) 만 옮겨도 무방.

---

## 3. 도메인 / DNS — 두 hostname 등록 (ADR-2, S13/S15)

PB와 프론트가 같은 VM의 Caddy에서 서빙되지만 hostname은 분리:
- `PB_DOMAIN` — PocketBase API + admin UI (예: `pb.<your>.com` / `pb-breakteau.duckdns.org`)
- `APP_DOMAIN` — 프론트 정적 자산 (예: `app.<your>.com` / `app-breakteau.duckdns.org`)

두 hostname 모두 A 레코드가 같은 VM 외부 IP를 가리킴. Caddy는 발급 단위가 hostname이라 각각 자동 SSL.

VM 외부 IP는 §1.4 절차 후:

```bash
gcloud compute addresses describe breakteau-pb-ip --region=us-west1 --format="get(address)"
```

### 3.A 커스텀 도메인 (예: `pb.<your>` + `app.<your>`)

조건: 도메인 등록업체에 도메인 1개 보유 ($10/년대). DNS 관리는 어디서든 가능 (Cloudflare 추천 — 무료).

DNS 관리 콘솔에서 A 레코드 2개 추가:

```
pb.<your-domain>.    A   <VM 외부 IP>   TTL 300
app.<your-domain>.   A   <VM 외부 IP>   TTL 300
```

`.env` 예시:

```
PB_DOMAIN=pb.your-domain.com
APP_DOMAIN=app.your-domain.com
ACME_EMAIL=admin@your-domain.com
```

### 3.B 무료 DDNS (예: DuckDNS) — 서브도메인 2개

조건: 도메인 비용 0원. URL이 `<sub>.duckdns.org` 형태라 미관 양보. DuckDNS는 한 계정에서 **최대 5개 서브도메인 무료** — 2개 등록.

1. https://www.duckdns.org 접속 → GitHub/Google/Reddit/Twitter OAuth 로그인.
2. 빈 칸에 원하는 서브도메인 2개 입력 → `add domain`:
   - 예: `breakteau-pb`, `breakteau-app`
3. 페이지 상단의 **token** 복사 (한 토큰이 모든 서브도메인 관리).
4. **현재 IP를 두 서브도메인에 동시 등록**:

   ```bash
   # SUBDOMAIN을 콤마로 묶으면 한 번 호출로 둘 다 갱신.
   curl "https://www.duckdns.org/update?domains=breakteau-pb,breakteau-app&token=<TOKEN>&ip=<VM 외부 IP>"
   # → "OK" 응답이면 성공
   ```

5. 전파 확인:

   ```bash
   dig +short breakteau-pb.duckdns.org
   dig +short breakteau-app.duckdns.org
   ```

§1.4의 **Static IP**를 적용했다면 한 번만 호출하면 끝.

`.env` 예시:

```
PB_DOMAIN=breakteau-pb.duckdns.org
APP_DOMAIN=breakteau-app.duckdns.org
ACME_EMAIL=<본인이 받는 이메일>   # Let's Encrypt 만료 알림용, DuckDNS와 무관
```

⚠️ DDNS 측에서 일정 기간 IP 업데이트가 없으면 서브도메인 회수 가능 (DuckDNS 약 30일). 안전을 위해 월 1회 cron heartbeat:

```bash
# crontab -e
0 4 1 * * curl -fsS "https://www.duckdns.org/update?domains=breakteau-pb,breakteau-app&token=<TOKEN>&ip=" >/dev/null
```

(IP를 빈 값으로 보내면 DuckDNS가 호출 source IP를 자동 사용.)

---

## 4. 첫 부팅

### 4.0 데이터 디렉토리 + 권한 (Linux prod 필수)

PocketBase 컨테이너는 비-root user `pb`(uid 100, gid 101)로 실행되므로 host mount의 `pb_data`도 그 uid가 쓸 수 있어야 한다. macOS Docker Desktop은 자동 처리하지만 **Linux는 명시적 권한 설정 필요**.

```bash
sudo mkdir -p /opt/breakteau/data/{pb_data,caddy_data,caddy_config,app}
sudo chown -R 100:101 /opt/breakteau/data/pb_data
sudo chown -R root:root /opt/breakteau/data/caddy_data /opt/breakteau/data/caddy_config
# 프론트 정적 자산: rsync로 부어넣을 user(보통 SSH user)에게 쓰기 권한.
# 운영자 본인 user에 두고 Caddy(root)는 읽기만.
sudo chown -R "$USER:$USER" /opt/breakteau/data/app
```

### 4.1 환경변수

```bash
cd /opt/breakteau/infra/prod
cp .env.prod.example .env
vi .env   # PB_DOMAIN, APP_DOMAIN, ACME_EMAIL, DATA_DIR=/opt/breakteau/data 채움
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

브라우저 → `https://<PB_DOMAIN>/_/`

첫 접속 시 admin 생성 폼 노출. email/password 입력 → 저장.
이후 admin 자격증명을 안전한 곳에 보관 (1Password 등).

### 4.4 일반 user 생성

Breakteau 프론트엔드는 일반 user(`users` 컬렉션) 인증을 사용 — admin과 별개:

1. admin UI에서 `Collections > users > + New record`.
2. email, password 입력 + `verified: true` 체크.
3. 이 자격증명을 프론트엔드 `.env.local`의 `BT_TEST_EMAIL`/`BT_TEST_PASSWORD`로 사용 (선택, smoke 검증용).

---

## 5. 검증

### 5.1 health

```bash
curl -fsS https://<PB_DOMAIN>/api/health
# → {"code":200,"message":"API is healthy.","data":{"canBackup":true}}
```

### 5.2 응답 시간 (한국에서)

```bash
curl -o /dev/null -s -w "time_total: %{time_total}s\n" https://<PB_DOMAIN>/api/health
```

ADR-8 us-west1 기준 RTT ~150ms 예상.

### 5.3 HTTPS 등급

```bash
curl -I https://<PB_DOMAIN>/api/health
```

응답 헤더에 `strict-transport-security` 등이 보이는지 확인.

브라우저로 `https://www.ssllabs.com/ssltest/analyze.html?d=<PB_DOMAIN>` 점수 측정 (A+ 목표).

---

## 6. 일상 운영

### 6.1 로그

```bash
cd /opt/breakteau/infra/prod
docker compose -f docker-compose.prod.yml logs -f --tail 100
```

**백업 실패 주간 점검** (BACKUP_ALERT_WEBHOOK 미설정 시):

```bash
docker compose -f docker-compose.prod.yml logs --since 7d backup | grep -E 'FAILED|ERROR'
# 빈 출력이면 OK. 항목이 보이면 해당 timestamp 로그 풀로 확인 + 자격증명/GCS/PB endpoint 점검.
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
3. zip 다운로드 + 무결성 검증 → **GCS (us-west1)** 업로드 (rclone S3 호환 + HMAC)
4. PB 서버 측 zip 정리 (디스크 절약)
5. GCS 30일 이전 객체 cleanup (lifecycle 룰의 이중 안전망)

스케줄/대상 변경은 `.env`의 `BACKUP_HOUR_UTC` / `BACKUP_MINUTE_UTC` / `GCS_BUCKET`.

**미디어 분리:** v1.1에서 PB file storage가 **별도 버킷(`breakteau-media`)** + **별도 SA/HMAC**을 사용해 백업과 권한·cleanup 격리.

### 7.1 PocketBase admin API (수동, 권장 — WAL 일관성 보장)

PocketBase는 내부에서 일관 스냅샷 zip을 만들어주는 admin API를 제공한다. SQLite WAL이 안전하게 체크포인트된 상태로 묶이기 때문에 **수동 tar보다 안전**.

```bash
# admin 토큰 발급
TOKEN=$(curl -s -X POST https://<PB_DOMAIN>/api/admins/auth-with-password \
  -H "Content-Type: application/json" \
  -d '{"identity":"<ADMIN_EMAIL>","password":"<ADMIN_PW>"}' | jq -r .token)

# 백업 생성 (서버 측에서 zip 묶음 — pb_data 위에 'backups/' 폴더 생김)
curl -s -X POST https://<PB_DOMAIN>/api/backups \
  -H "Authorization: $TOKEN" \
  -d '{"name":"manual-'"$(date +%Y%m%d)"'"}'

# 다운로드 (또는 VM에서 직접 ${DATA_DIR}/pb_data/backups/ 복사)
curl -L -o backup.zip "https://<PB_DOMAIN>/api/backups/manual-$(date +%Y%m%d).zip?token=$TOKEN"
```

### 7.2 수동 tar (admin API 불가 시 fallback)

```bash
cd /opt/breakteau/infra/prod
docker compose -f docker-compose.prod.yml stop pocketbase

# WAL 체크포인트 — 실행 후 data.db에 변경 사항 통합되어 tar 일관성 ↑.
# 컨테이너 안 sqlite3 또는 호스트의 sqlite3 사용.
sudo apt-get install -y sqlite3
sudo sqlite3 data/pb_data/data.db "PRAGMA wal_checkpoint(TRUNCATE);"

sudo tar czf /tmp/breakteau-backup-$(date +%Y%m%d).tar.gz -C data pb_data
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

### 7.3 GCS 셋업 (자동 백업 처음 띄울 때 1회)

ADR-6 (2026-06-19 갱신) — 객체 스토리지는 **GCS Standard / us-west1** (VM과 동일 region) + S3 호환(Interoperability/HMAC).

#### 7.3.1 GCP 프로젝트 + 버킷 생성

GCP Console → Storage → Buckets → **Create**:
- **Name:** `breakteau-backups` (글로벌 유니크 — `.env`의 `GCS_BUCKET`과 일치).
- **Location type:** Region — **us-west1** (VM과 동일 → 트래픽 무료).
- **Storage class:** **Standard** (자주 변경되는 백업).
- **Access control:** Uniform (IAM only).
- **Protection tools:** Soft delete (default 7-day) 그대로 두면 추가 안전망.

#### 7.3.2 HMAC 키 발급 (S3 호환 access key)

GCS의 S3 호환은 service account-bound HMAC 키를 access key로 사용.

```bash
# 1) backup 전용 service account 생성
gcloud iam service-accounts create breakteau-backup \
  --display-name="Breakteau backup uploader"

# 2) backup bucket에 ObjectAdmin 권한 (다른 버킷엔 권한 없음)
gcloud storage buckets add-iam-policy-binding gs://breakteau-backups \
  --member=serviceAccount:breakteau-backup@<PROJECT_ID>.iam.gserviceaccount.com \
  --role=roles/storage.objectAdmin

# 3) HMAC 키 발급
gcloud storage hmac create breakteau-backup@<PROJECT_ID>.iam.gserviceaccount.com
# 출력의 accessId(=ACCESS_KEY_ID) / secret(=SECRET_ACCESS_KEY)를 1Password에 즉시 저장.
# secret은 한 번만 표시됨.
```

> **미디어용 SA는 별도 발급 권장** (S18, §7.5) — `breakteau-media` 버킷 전용 SA + HMAC. 백업 키가 새도 미디어 영향 0.

GCP Console에서도 발급 가능: **Cloud Storage → Settings → Interoperability → Service account HMAC → Create a key for a service account**.

#### 7.3.3 lifecycle 룰 (30일 자동 삭제)

```bash
cat > /tmp/lifecycle.json <<'EOF'
{
  "lifecycle": {
    "rule": [
      {
        "action": { "type": "Delete" },
        "condition": { "age": 30, "matchesPrefix": ["auto/"] }
      }
    ]
  }
}
EOF
gcloud storage buckets update gs://breakteau-backups --lifecycle-file=/tmp/lifecycle.json
```

rclone의 `--min-age 30d` cleanup이 이중 안전망(같은 `auto/` 안에서만 동작). GCS lifecycle 룰이 우선이라 GCS 측에 부담 위임.

미디어(§7.5)는 별도 버킷(`breakteau-media`) — lifecycle 룰 적용 안 함(사용자 명시적 삭제까지 영구 보관).

#### 7.3.4 `.env` 설정 + 컨테이너 재시작

```bash
cd /opt/breakteau/infra/prod
vi .env   # GCS_BUCKET, GCS_REGION=us-west1, GCS_ACCESS_KEY_ID,
          # GCS_SECRET_ACCESS_KEY, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD 채움.
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
[...Z] START backup breakteau-20260619-110000.zip → gcs://breakteau-backups/auto/
[...Z] auth admin
[...Z] create snapshot ...
[...Z] download ...
[...Z] snapshot size: 24576 bytes
[...Z] upload to gcs://breakteau-backups/auto/breakteau-...zip
[...Z] cleanup PB server-side snapshot
[...Z] cleanup GCS auto/ backups older than 30d
[...Z] OK backup completed ...
```

GCP Console → Buckets → `breakteau-backups` → `auto/` 트리에서 객체 확인. 또는:

```bash
gcloud storage ls gs://breakteau-backups/auto/
```

이후 `BACKUP_ON_START=0`(또는 미설정)로 되돌리고 재시작:

```bash
unset BACKUP_ON_START
docker compose -f docker-compose.prod.yml --env-file .env up -d backup
```

### 7.4 복원 리허설 (1회 권장, S14 acceptance)

복원 절차의 신뢰성은 **실제로 한 번 해본 다음**에만 보장됨. **별도 staging VM(또는 로컬 macOS Docker)**에서 다음을 1회 수행하고 결과를 `docs/history/phase-3.md`에 기록:

#### 7.4.1 GCS에서 백업 zip 다운로드

```bash
docker run --rm \
  -e RCLONE_CONFIG_GCS_TYPE=s3 \
  -e RCLONE_CONFIG_GCS_PROVIDER=GCS \
  -e RCLONE_CONFIG_GCS_ACCESS_KEY_ID="$GCS_ACCESS_KEY_ID" \
  -e RCLONE_CONFIG_GCS_SECRET_ACCESS_KEY="$GCS_SECRET_ACCESS_KEY" \
  -e RCLONE_CONFIG_GCS_ENDPOINT="https://storage.googleapis.com" \
  -e RCLONE_CONFIG_GCS_REGION="$GCS_REGION" \
  -v "$PWD:/data" \
  rclone/rclone:latest copy gcs:breakteau-backups/auto/<백업파일명> /data/
```

또는 `gcloud` CLI 사용 시(사용자 자격증명):

```bash
gcloud storage cp gs://breakteau-backups/auto/<백업파일명> ./
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

### 7.5 PB file storage GCS 전환 (S18-A, v1.1 미디어 준비)

세션 미디어(사진/영상)를 PB가 GCS에 저장하도록 file storage를 전환. 백업 버킷(`breakteau-backups`)과 권한·버킷·lifecycle 정책을 격리해 사고 영향 최소화.

#### 7.5.1 미디어 버킷 생성

```bash
# §7.3.1과 동일하게 us-west1, Standard storage class.
gcloud storage buckets create gs://breakteau-media \
  --location=us-west1 \
  --default-storage-class=STANDARD \
  --uniform-bucket-level-access
```

또는 GCP Console에서 동일 옵션으로 생성. **us-west1 (VM과 동일 region)**이 PB↔GCS 트래픽 무료의 핵심.

미디어는 영구 보관이라 lifecycle 룰 적용 안 함.

#### 7.5.2 미디어용 service account + HMAC 키 (백업 SA와 분리)

```bash
# 1) media 전용 SA
gcloud iam service-accounts create breakteau-media \
  --display-name="Breakteau media storage"

# 2) media bucket에만 ObjectAdmin
gcloud storage buckets add-iam-policy-binding gs://breakteau-media \
  --member=serviceAccount:breakteau-media@<PROJECT_ID>.iam.gserviceaccount.com \
  --role=roles/storage.objectAdmin

# 3) HMAC 키 발급
gcloud storage hmac create breakteau-media@<PROJECT_ID>.iam.gserviceaccount.com
# accessId / secret을 1Password에 저장 — PB Admin에 곧 입력.
```

백업 SA(`breakteau-backup`)는 `breakteau-backups`에만 권한, media SA는 `breakteau-media`에만 권한 → 한 키가 새도 다른 버킷 0 영향.

#### 7.5.3 PB Admin UI에서 S3 file storage 활성

PB Admin (`https://<PB_DOMAIN>/_/`) → 좌측 **Settings** → **Files** → **Use S3 storage** 토글:

| 필드 | 값 |
|---|---|
| Endpoint | `https://storage.googleapis.com` |
| Bucket | `breakteau-media` |
| Region | `us-west1` |
| Access key | 위 §7.5.2에서 발급한 media HMAC `accessId` |
| Secret | 위 §7.5.2 `secret` |
| Force path style | **on** (GCS S3 호환은 path-style 권장) |

**Save settings** → PB가 즉시 file 필드 업로드/다운로드를 GCS로 라우팅 시작. 기존 로컬 디스크 (`pb_data/storage/`) 파일은 그대로 두지만 새 업로드만 GCS로 감 — 신규 도입이라 마이그레이션 부담 없음.

#### 7.5.4 검증

PB Admin → 임의 컬렉션 (예: 임시 `_test` 컬렉션에 file 필드 추가) → 작은 이미지 1개 업로드 → Save:

```bash
# 컨테이너 로그에서 S3 PUT이 보이면 OK:
docker compose -f docker-compose.prod.yml logs --tail 30 pocketbase | grep -iE "s3|put|googleapis"
```

GCP Console → Buckets → `breakteau-media` → 객체 트리에서 `<collection_id>/<record_id>/<filename>` 경로로 도착했는지 확인. 또는:

```bash
gcloud storage ls gs://breakteau-media/
```

#### 7.5.5 PB → GCS 트래픽 영향

- **업로드/다운로드 (PB ↔ GCS)**: 같은 region(us-west1) — **무료**.
- **사용자(한국) → PB → GCS**: 다운로드는 PB의 GCE egress로 계산($0.085-0.12/GB, 첫 1GB/월 무료). 1인 사용 + 짧은 영상 재생이면 월 $1 이하 전망.
- 미디어 객체가 자주 access되면 PB 앞단 Caddy에 `Cache-Control` 설정 추가 검토 (별도 follow-up).

---

## 8. 프론트 배포 (S15)

프론트는 Next.js static export(`output: 'export'`, `trailingSlash: true`) 산출물(`web/out/`)을 `${DATA_DIR}/app/`에 부어넣으면 Caddy가 즉시 서빙. 빌드는 로컬/CI, 전송은 rsync.

### 8.1 로컬 배포 (수동, 첫 셋업 시)

```bash
# 로컬 (Mac)에서
cd web
NEXT_PUBLIC_PB_URL="https://${PB_DOMAIN}" pnpm install --frozen-lockfile
NEXT_PUBLIC_PB_URL="https://${PB_DOMAIN}" pnpm build

# VM으로 rsync (--delete로 옛 파일도 정리)
rsync -avz --delete out/ \
  "<vm-user>@<VM-IP>:/opt/breakteau/data/app/"
```

검증:

```bash
curl -fsS "https://${APP_DOMAIN}/" | head -c 200    # HTML 응답
curl -I "https://${APP_DOMAIN}/_next/static/css/<hash>.css"   # cache header 확인
```

브라우저 `https://${APP_DOMAIN}/`에서 로그인 화면이 보이면 OK.

### 8.2 자동 배포 (GitHub Actions)

`.github/workflows/deploy-frontend.yml`이 main 푸시 시 자동 빌드 + rsync.

#### 8.2.1 GitHub Secrets 등록

리포지토리 → Settings → Secrets and variables → Actions → New repository secret:

| Secret | 값 |
|---|---|
| `NEXT_PUBLIC_PB_URL` | `https://<PB_DOMAIN>` (예: `https://pb.your-domain.com`) |
| `DEPLOY_SSH_KEY` | VM 접속용 SSH private key (`-----BEGIN OPENSSH PRIVATE KEY-----` 포함 전문) |
| `DEPLOY_HOST` | VM 외부 IP 또는 같은 hostname |
| `DEPLOY_USER` | SSH user (예: `yoonsoochang`) |
| `DEPLOY_PATH` | `/opt/breakteau/data/app` |

#### 8.2.2 SSH key 발급 (1회)

로컬에서:

```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/breakteau-deploy -C "github-actions-deploy"
# public key를 VM의 authorized_keys에 추가
ssh-copy-id -i ~/.ssh/breakteau-deploy.pub <user>@<VM-IP>
# private key 전문을 GitHub Secret DEPLOY_SSH_KEY에 등록
cat ~/.ssh/breakteau-deploy
```

#### 8.2.3 첫 배포 확인

main 브랜치에 `web/` 하위 변경을 푸시 → Actions 탭에서 workflow 실행 → 성공 시 `https://${APP_DOMAIN}/` 새 콘텐츠 반영.

### 8.3 PB CORS Allowed Origins

PB admin UI(`https://${PB_DOMAIN}/_/`) → **Settings → Application → Allowed origins**:

```
https://${APP_DOMAIN}
```

PR preview URL을 별도 hostname으로 띄울 경우 그 hostname도 추가. 와일드카드(`*`)는 ADR-5 단일 사용자 가정과 충돌이라 사용 금지.

### 8.4 캐시 무효화

Caddy `file_server`는 ETag 자동. 새 배포의 `/_next/static/*`는 파일명에 hash가 있어 immutable cache OK. `index.html`/`sw.js`는 Caddyfile에서 `Cache-Control: no-cache`로 매번 재검증. Service Worker는 자체 update lifecycle로 새 자산 받음.

브라우저 캐시 강제 무효화는 보통 필요 없지만 사용자가 변경을 못 본다고 신고 시:

```
Chrome DevTools → Application → Service Workers → Update on reload + Unregister
```

---

## 9. 장애 대응

### 9.1 인증서 발급 실패

```bash
docker compose -f docker-compose.prod.yml logs caddy | grep -i error
```

흔한 원인:
- DNS A 레코드가 아직 전파 안 됨 → `dig +short <PB_DOMAIN> && dig +short <APP_DOMAIN>` 으로 확인.
- 방화벽 80/443 닫혀있음.
- ACME_EMAIL 미설정 또는 잘못된 형식.

> 정상 동작: 인증서는 발급됐지만 `https://<APP_DOMAIN>/` 접속 시 빈 화면/404가 보이면 **프론트 자산이 아직 배포 안 된 상태** (§8 절차로 첫 배포). HTTPS 자체는 OK 신호.

### 9.2 PocketBase가 시작 안 됨

```bash
docker compose -f docker-compose.prod.yml logs pocketbase
```

- 마이그레이션 에러: `data/pb_data` 권한 또는 새 마이그레이션 문법 검증.
- 디스크 가득 참: `df -h`. 백업 임시 파일 정리.

### 9.3 OOM (e2-micro 1GB)

`free -h`로 swap 사용 확인. swap 부족이면 1.5GB로 증설.
Caddy/PB 메모리 사용은 평상시 합쳐서 150~250MB 수준.
