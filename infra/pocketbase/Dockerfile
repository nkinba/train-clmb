# Climb-Forge PocketBase image — ADR-1 (단일 바이너리) + ADR-2 (IaC 동일성)
#
# 빌드:   docker compose build
# 실행:   docker compose up
#
# 빌드시 호스트 아키텍처(amd64/arm64)에 맞는 바이너리를 GitHub에서 다운로드.
# 로컬 mac (arm64) ↔ GCP e2-micro (amd64) 모두 동일한 Dockerfile로 빌드 가능.

FROM alpine:3.20 AS download
ARG PB_VERSION=0.22.21
ARG TARGETARCH

RUN apk add --no-cache ca-certificates unzip wget

RUN case "${TARGETARCH}" in \
      "amd64") PB_ARCH="linux_amd64" ;; \
      "arm64") PB_ARCH="linux_arm64" ;; \
      *)       echo "unsupported arch: ${TARGETARCH}" >&2; exit 1 ;; \
    esac \
    && wget -O /tmp/pb.zip \
        "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_${PB_ARCH}.zip" \
    && unzip /tmp/pb.zip -d /pb \
    && rm /tmp/pb.zip

FROM alpine:3.20

RUN apk add --no-cache ca-certificates

COPY --from=download /pb/pocketbase /pocketbase

EXPOSE 8090

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --spider http://127.0.0.1:8090/api/health || exit 1

# pb_data: SQLite + uploads (영속)
# pb_migrations: JS 마이그레이션 (코드로 관리)
CMD ["/pocketbase", "serve", \
     "--http=0.0.0.0:8090", \
     "--dir=/pb_data", \
     "--migrationsDir=/pb_migrations"]
