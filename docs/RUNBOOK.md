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

## 3. 도메인 + DNS

### 3.1 도메인 A 레코드

DNS 관리 콘솔에서 다음 레코드 추가:

```
pb.<your-domain>.   A   <VM 외부 IP>   TTL 300
```

VM 외부 IP는 `gcloud compute instances describe climb-forge-pb --zone=us-west1-a` 의 `networkInterfaces[].accessConfigs[].natIP`.

전파 확인:

```bash
dig +short pb.<your-domain>
```

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

---

## 7. 백업 (S14 — 자동화 별도)

### 7.1 PocketBase admin API (권장 — WAL 일관성 보장)

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

자동 일일 백업(R2)은 **S14**에서 추가. 30일 보관, 복원 리허설 1회 권장.

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
