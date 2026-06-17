#!/bin/bash
# Climb-Forge 일일 백업 (S14, ADR-6 — GCS).
#
# 흐름:
#   1) PB admin 토큰 발급 (PB API)
#   2) PB 측에서 일관 zip 생성 (`POST /api/backups`) — WAL 일관성 보장
#   3) zip 다운로드 → 무결성 검증 → GCS 업로드 (rclone, Service Account 인증)
#   4) PB 서버 측 zip 정리 (디스크 절약)
#   5) GCS 30일 이전 객체 cleanup
#
# 인증:
#   - VM 운영: VM에 첨부된 Service Account의 metadata token 자동 사용 (key 파일 불필요).
#   - 로컬 테스트: GOOGLE_APPLICATION_CREDENTIALS=/secrets/sa.json 또는
#     RCLONE_CONFIG_GCS_SERVICE_ACCOUNT_FILE=/secrets/sa.json.
#
# 단발 실행 — 스케줄링은 entrypoint.sh의 daily loop가 담당.

set -euo pipefail

# 환경변수 검증
: "${PB_INTERNAL_URL:?PB_INTERNAL_URL required}"
: "${PB_ADMIN_EMAIL:?PB_ADMIN_EMAIL required}"
: "${PB_ADMIN_PASSWORD:?PB_ADMIN_PASSWORD required}"
: "${GCS_BUCKET:?GCS_BUCKET required}"

# 자동 백업이 GCS에 격리될 sub-prefix. 동일 버킷의 다른 객체와 cleanup 영향 분리.
GCS_PREFIX="${GCS_PREFIX:-auto}"

TS=$(date -u +%Y%m%d-%H%M%S)
BACKUP_NAME="climb-forge-${TS}.zip"
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }

# 실패 시 옵션 webhook 알림. BACKUP_ALERT_WEBHOOK이 비어있으면 silent.
notify_failure() {
  local stage="$1"
  local detail="$2"
  if [ -n "${BACKUP_ALERT_WEBHOOK:-}" ]; then
    local payload
    payload=$(jq -nc --arg text "Climb-Forge backup FAILED at ${stage}: ${detail}" '{text:$text}')
    curl -fsS -X POST -H "Content-Type: application/json" \
      -d "$payload" "$BACKUP_ALERT_WEBHOOK" >/dev/null 2>&1 || true
  fi
}

log "START backup ${BACKUP_NAME} → gcs://${GCS_BUCKET}/${GCS_PREFIX}/"

# ── 1) admin 토큰
log "auth admin"
AUTH_RESPONSE=$(curl -sS -X POST "${PB_INTERNAL_URL}/api/admins/auth-with-password" \
  -H "Content-Type: application/json" \
  -d "{\"identity\":\"${PB_ADMIN_EMAIL}\",\"password\":\"${PB_ADMIN_PASSWORD}\"}")

TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.token // empty')
if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  log "ERROR: admin auth failed — response: $(echo "$AUTH_RESPONSE" | jq -c 'del(.token)' 2>/dev/null || echo "$(echo "$AUTH_RESPONSE" | head -c 200) <not-json>")"
  notify_failure "admin-auth" "see logs"
  exit 1
fi

# ── 2) PB 측 zip 생성
log "create snapshot ${BACKUP_NAME}"
CREATE_RESPONSE_FILE="${TMP_DIR}/create-resp.txt"
if ! curl -fsS -X POST "${PB_INTERNAL_URL}/api/backups" \
  -H "Authorization: ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"${BACKUP_NAME}\"}" -o "${CREATE_RESPONSE_FILE}"; then
  log "ERROR: create snapshot failed — response: $(head -c 200 "${CREATE_RESPONSE_FILE}" 2>/dev/null || echo n/a)"
  notify_failure "create-snapshot" "see logs"
  exit 1
fi

# ── 3) 다운로드
log "download ${BACKUP_NAME}"
curl -fsSL -o "${TMP_DIR}/${BACKUP_NAME}" \
  -H "Authorization: ${TOKEN}" \
  "${PB_INTERNAL_URL}/api/backups/${BACKUP_NAME}"

if [ ! -s "${TMP_DIR}/${BACKUP_NAME}" ]; then
  log "ERROR: empty backup zip"
  notify_failure "download" "empty zip"
  exit 1
fi

SIZE_BYTES=$(stat -c%s "${TMP_DIR}/${BACKUP_NAME}")
log "snapshot size: ${SIZE_BYTES} bytes"

# zip 무결성 검증 — 부분 다운로드/finalize 전 race로 깨진 zip이 GCS로 가지 않게.
if ! unzip -t -q "${TMP_DIR}/${BACKUP_NAME}" >/dev/null 2>&1; then
  log "ERROR: zip integrity check failed"
  notify_failure "integrity" "unzip -t failed"
  exit 1
fi

# ── 4) GCS 업로드 (sub-prefix auto/로 격리 — 다른 객체와 cleanup 영향 분리)
log "upload to gcs://${GCS_BUCKET}/${GCS_PREFIX}/${BACKUP_NAME}"
if ! rclone copy "${TMP_DIR}/${BACKUP_NAME}" "gcs:${GCS_BUCKET}/${GCS_PREFIX}/" \
  --stats-one-line; then
  log "ERROR: GCS upload failed"
  notify_failure "gcs-upload" "see rclone logs"
  exit 1
fi

# ── 5) PB 서버 측 zip 정리
log "cleanup PB server-side snapshot"
curl -fsS -X DELETE "${PB_INTERNAL_URL}/api/backups/${BACKUP_NAME}" \
  -H "Authorization: ${TOKEN}" >/dev/null || \
  log "WARN: PB snapshot delete failed (non-fatal)"

# 잔여 zip 카운트 — 누적 모니터링 (디스크 가득 차기 전 신호).
PB_BACKUPS_LEFT=$(curl -fsS -H "Authorization: ${TOKEN}" \
  "${PB_INTERNAL_URL}/api/backups" | jq -r '. | length' 2>/dev/null || echo "?")
log "PB server-side backups remaining: ${PB_BACKUPS_LEFT}"

# ── 6) GCS 30일 이전 cleanup (sub-prefix 안에서만)
# 30일 보관 정책 (ADR-6). GCS bucket lifecycle 룰이 우선, 이건 이중 안전망.
log "cleanup GCS ${GCS_PREFIX}/ backups older than 30d"
rclone delete "gcs:${GCS_BUCKET}/${GCS_PREFIX}/" \
  --min-age 30d \
  --stats-one-line \
  --quiet || log "WARN: GCS cleanup failed (non-fatal)"

log "OK backup completed ${BACKUP_NAME}"
