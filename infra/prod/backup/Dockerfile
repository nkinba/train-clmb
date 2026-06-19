# Breakteau 백업 컨테이너 (S14, ADR-6).
#
# alpine + rclone(R2 업로드) + curl(PB admin API) + bash.
# entrypoint가 매일 정해진 시각에 backup.sh를 호출하는 daily loop.

FROM alpine:3.20

RUN apk add --no-cache bash ca-certificates curl rclone tzdata jq unzip \
    && addgroup -S backup && adduser -S -G backup -h /home/backup backup

COPY --chmod=0755 backup.sh /usr/local/bin/backup.sh
COPY --chmod=0755 entrypoint.sh /usr/local/bin/entrypoint.sh

USER backup
WORKDIR /home/backup

# 환경변수 BACKUP_HOUR_UTC=19 → 19:00 UTC(= 04:00 KST). RUNBOOK §7.3 참조.
# BACKUP_ON_START 기본 0 — compose default와 일치, 첫 검증 시는 RUNBOOK §7.3.5의 명시 override.
ENV BACKUP_HOUR_UTC=19
ENV BACKUP_MINUTE_UTC=0
ENV BACKUP_ON_START=0

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
