# Breakteau PocketBase image — ADR-1 (단일 바이너리) + ADR-2 (IaC 동일성)
#
# 빌드:   docker compose build
# 실행:   docker compose up
#
# 빌드시 호스트 아키텍처(amd64/arm64)에 맞는 바이너리를 GitHub에서 다운로드.
# 로컬 mac (arm64) ↔ GCP e2-micro (amd64) 모두 동일한 Dockerfile로 빌드 가능.
#
# 강화 사항 (S13):
# - PocketBase 바이너리 SHA256 검증 — 공급망 공격 / 전송 중 손상 방지.
# - 비-root 사용자(pb)로 실행 — 컨테이너 권한 최소화.

FROM alpine:3.20 AS download
ARG PB_VERSION=0.22.21
ARG TARGETARCH

RUN apk add --no-cache ca-certificates unzip wget

# SHA256은 PocketBase 0.22.21 GitHub release checksums.txt 기준 (S13 작성 시점 fix).
# PB_VERSION 변경 시 https://github.com/pocketbase/pocketbase/releases/download/v<X>/checksums.txt에서 갱신.
RUN case "${TARGETARCH}" in \
      "amd64") PB_ARCH="linux_amd64"; \
               PB_SHA256="b63271053a2ea2c703f3438a8fc7db89775d6f5667765b72a5157bfaa35414e6" ;; \
      "arm64") PB_ARCH="linux_arm64"; \
               PB_SHA256="280e9e62c29e26fda1f5fc0f6870a780766532fcbd2c301013866c7457363ed9" ;; \
      *)       echo "unsupported arch: ${TARGETARCH}" >&2; exit 1 ;; \
    esac \
    && wget -O /tmp/pb.zip \
        "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_${PB_ARCH}.zip" \
    && echo "${PB_SHA256}  /tmp/pb.zip" | sha256sum -c - \
    && unzip /tmp/pb.zip -d /pb \
    && rm /tmp/pb.zip

FROM alpine:3.20

# wget — healthcheck용. ca-certificates — TLS.
RUN apk add --no-cache ca-certificates wget \
    && addgroup -S pb && adduser -S -G pb -h /home/pb pb \
    && mkdir -p /pb_data /pb_migrations \
    && chown -R pb:pb /pb_data /pb_migrations

COPY --from=download --chown=pb:pb /pb/pocketbase /pocketbase

EXPOSE 8090

USER pb

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --spider http://127.0.0.1:8090/api/health || exit 1

# pb_data: SQLite + uploads (영속)
# pb_migrations: JS 마이그레이션 (코드로 관리)
CMD ["/pocketbase", "serve", \
     "--http=0.0.0.0:8090", \
     "--dir=/pb_data", \
     "--migrationsDir=/pb_migrations"]
