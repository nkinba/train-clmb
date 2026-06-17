#!/bin/bash
# Climb-Forge backup container entrypoint.
#
# 매일 BACKUP_HOUR_UTC:BACKUP_MINUTE_UTC에 backup.sh 호출.
# dcron/supercronic 없이 단순 sleep-loop — 환경변수 상속 + 로그를 docker logs로 직접.
#
# 첫 실행 시점:
#   - 컨테이너 시작 직후는 BACKUP_ON_START=1일 때만 1회 즉시 실행 (기본 0 — compose와 동일).
#   - 운영 첫 검증 시: `BACKUP_ON_START=1 docker compose ... up backup` (RUNBOOK §7.3.5).
#   - 이후 매일 지정 시각.

set -euo pipefail

BACKUP_ON_START="${BACKUP_ON_START:-0}"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] [entrypoint] $*"; }

run_backup() {
  if /usr/local/bin/backup.sh; then
    log "backup succeeded"
  else
    log "backup FAILED with exit $?"
  fi
}

if [ "$BACKUP_ON_START" = "1" ]; then
  log "BACKUP_ON_START=1 → 초기 1회 실행"
  run_backup
fi

while true; do
  # 다음 BACKUP_HOUR_UTC:BACKUP_MINUTE_UTC 시점 계산.
  NOW_EPOCH=$(date -u +%s)
  TODAY_TARGET="$(date -u +%Y-%m-%d) ${BACKUP_HOUR_UTC}:${BACKUP_MINUTE_UTC}:00"
  TARGET_EPOCH=$(date -u -d "${TODAY_TARGET}" +%s)
  if [ "$TARGET_EPOCH" -le "$NOW_EPOCH" ]; then
    TARGET_EPOCH=$((TARGET_EPOCH + 86400))
  fi
  SLEEP_SEC=$((TARGET_EPOCH - NOW_EPOCH))
  log "다음 실행: $(date -u -d "@${TARGET_EPOCH}" '+%Y-%m-%d %H:%M:%S')Z (sleep ${SLEEP_SEC}s)"
  sleep "$SLEEP_SEC"
  run_backup
done
