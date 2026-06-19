# scripts/

로컬 dev 서버 자동 검증.

## smoke.mjs

Puppeteer 기반 모바일 뷰포트(390×844) 스모크 검증. 페이지별 HTTP 상태 / h1 / console error / 스크린샷을 수집.

### 사용법

```bash
# 1) PocketBase + Next.js dev 서버 실행 (별도 터미널)
docker compose -f ../infra/pocketbase/docker-compose.yml up -d
pnpm dev

# 2) 검증 실행
pnpm smoke
```

### 자격증명 (선택)

`web/.env.local`에 추가하면 로그인 후 보호 라우트도 자동 검증:

```bash
BT_TEST_EMAIL=test@example.com
BT_TEST_PASSWORD=...
```

미설정 시 비인증 4개 라우트(`/login`, `/`, `/dev/components`, `/dev/pb-check`)만 검증.

`.env.local`은 `.gitignore` 적용 — 자격증명은 절대 git에 들어가지 않음.

### 결과

- `web/screenshots/*.png` — 단계별 모바일 뷰포트 스크린샷.
- stdout JSONL — 단계별 status/h1/console errors.
- exit code — page error 발견 시 1.

### 한계

- Wake Lock / Vibration / Web Audio / Notification은 headless에서 검증 어려움 (사용자 제스처 / OS 권한 필요). 실제 디바이스 검증 필요.
- 행보드 타이머의 페이즈 사이클은 시뮬레이션 가능하나 현재 스크립트는 정적 페이지 진입까지만.

### Story 사이클에서

각 Story 완료 시 `pnpm smoke`로 회귀 확인. 새 라우트 추가되면 `smoke.mjs`의 `ROUTES_UNAUTH` / `AUTH_ROUTES`에 한 줄 추가.
