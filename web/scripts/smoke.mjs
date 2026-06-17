// Climb-Forge — 로컬 dev 서버 스모크 검증 (Puppeteer).
//
// 실행:
//   cd web && pnpm dev              # 별도 터미널
//   pnpm smoke                       # 비인증 + (자격증명 있으면) 인증 흐름
//
// 환경변수 (.env.local — git 제외):
//   NEXT_PUBLIC_PB_URL   PocketBase 베이스 URL (smoke는 미사용, 페이지가 사용).
//   CF_BASE_URL          기본 http://localhost:3000.
//   CF_TEST_EMAIL        설정 시 인증 흐름 실행.
//   CF_TEST_PASSWORD     설정 시 인증 흐름 실행.
//
// 결과:
//   screenshots/*.png    각 단계 스크린샷.
//   stdout JSONL         각 단계 status/h1/console errors.
//   exit 1               page error or console error 발견 시.

import puppeteer from "puppeteer";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";

const BASE = process.env.CF_BASE_URL ?? "http://localhost:3000";
const PB_URL = process.env.NEXT_PUBLIC_PB_URL ?? "http://localhost:8090";
const EMAIL = process.env.CF_TEST_EMAIL;
const PASSWORD = process.env.CF_TEST_PASSWORD;

// smoke가 생성하는 세션의 target prefix — cleanup이 잔존물도 정리할 수 있도록.
const SMOKE_TAG = "[smoke-cleanup]";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS_DIR = path.resolve(__dirname, "..", "screenshots");
await fs.mkdir(SHOTS_DIR, { recursive: true });

const VIEWPORT = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true };

// ── helpers ───────────────────────────────────────────────────────────────

const failures = [];

function logStep(payload) {
  console.log(JSON.stringify(payload));
}

async function inspectPage(page, label) {
  const consoleErrs = [];
  const pageErrs = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrs.push(m.text());
  });
  page.on("pageerror", (e) => pageErrs.push(e.message));
  return { consoleErrs, pageErrs, label };
}

async function snapshot(page, label, { consoleErrs, pageErrs }, extra = {}) {
  const screenshot = path.join(SHOTS_DIR, `${label}.png`);
  await page.screenshot({ path: screenshot, fullPage: false });
  const title = await page.title();
  const h1 = await page
    .$eval("h1", (el) => el.textContent?.trim() ?? "")
    .catch(() => "<no h1>");
  const finalUrl = page.url();
  const payload = {
    label,
    finalUrl,
    title,
    h1,
    consoleErrors: consoleErrs.slice(0, 5),
    pageErrors: pageErrs.slice(0, 5),
    screenshot: path.relative(path.resolve(__dirname, ".."), screenshot),
    ...extra,
  };
  logStep(payload);
  if (pageErrs.length > 0) failures.push(`${label}: page error`);
  return payload;
}

// ── unauth flow ───────────────────────────────────────────────────────────

const ROUTES_UNAUTH = [
  { label: "u01-login", path: "/login/" },
  { label: "u02-home-redirect", path: "/" },
  { label: "u03-dev-components", path: "/dev/components" },
  { label: "u04-dev-pb-check", path: "/dev/pb-check" },
];

async function runUnauth(browser) {
  for (const r of ROUTES_UNAUTH) {
    const page = await browser.newPage();
    await page.setViewport(VIEWPORT);
    const inspect = await inspectPage(page, r.label);
    const resp = await page
      .goto(BASE + r.path, { waitUntil: "networkidle2", timeout: 15000 })
      .catch((e) => {
        failures.push(`${r.label}: goto failed — ${e.message}`);
        return null;
      });
    await new Promise((res) => setTimeout(res, 400));
    await snapshot(page, r.label, inspect, { httpStatus: resp?.status() ?? null });
    await page.close();
  }
}

// ── auth flow ─────────────────────────────────────────────────────────────

async function runAuth(browser) {
  if (!EMAIL || !PASSWORD) {
    logStep({ skip: "auth", reason: "CF_TEST_EMAIL/CF_TEST_PASSWORD 미설정" });
    return;
  }

  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);
  const inspect = await inspectPage(page, "a01-login-fill");
  await page.goto(BASE + "/login/", { waitUntil: "networkidle2", timeout: 15000 });
  await page.type('input[type="email"]', EMAIL);
  await page.type('input[type="password"]', PASSWORD);
  await snapshot(page, "a01-login-fill", inspect);

  const submit = await page.$('button[type="submit"]');
  if (!submit) {
    failures.push("a01: submit button not found");
    await page.close();
    return;
  }
  await Promise.all([
    submit.click(),
    page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => null),
  ]);
  await new Promise((res) => setTimeout(res, 800));

  // 인증 성공 확인 — 홈에 도달했는지.
  const inspect2 = await inspectPage(page, "a02-home");
  await snapshot(page, "a02-home", inspect2);
  if (page.url().includes("/login")) {
    failures.push("a02: still on /login after submit (auth failed?)");
    await page.close();
    return;
  }

  // PB 토큰 추출. 이후 모든 새 페이지에 localStorage로 주입.
  const pbAuthRaw = await page.evaluate(() => localStorage.getItem("pocketbase_auth"));
  const pbToken = (() => {
    try { return JSON.parse(pbAuthRaw)?.token ?? null; } catch { return null; }
  })();

  // [smoke-cleanup] 태그 세션 1개 생성 → localStorage activeId 주입 → /sessions/active/* 캡쳐.
  const createdSessionId = await createSmokeSession(pbToken);
  if (!createdSessionId) {
    failures.push("smoke session create failed — /sessions/active/* 캡쳐 skip");
  }

  // 인증된 페이지 순회.
  const AUTH_ROUTES = [
    { label: "a03-logs", path: "/logs" },
    { label: "a04-analysis", path: "/analysis" },
    { label: "a05-settings", path: "/settings" },
    { label: "a06-sessions-new", path: "/sessions/new/" },
    { label: "a07-sessions-active", path: "/sessions/active/" },
    { label: "a08-hangboard", path: "/sessions/active/hangboard/" },
    { label: "a09-climbing", path: "/sessions/active/climbing/" },
    { label: "a10-strength", path: "/sessions/active/strength/" },
  ];

  try {
    for (const r of AUTH_ROUTES) {
      const p = await browser.newPage();
      await p.setViewport(VIEWPORT);
      // puppeteer 새 페이지에 PB 토큰 + 활성 세션 ID 주입 (LocalAuthStore는 페이지 간 공유 X).
      await p.evaluateOnNewDocument(({ token, activeId }) => {
        if (token) localStorage.setItem("pocketbase_auth", token);
        if (activeId) localStorage.setItem("cf:active-session-id", activeId);
      }, { token: pbAuthRaw, activeId: createdSessionId ?? "" });

      const inspect = await inspectPage(p, r.label);
      const resp = await p
        .goto(BASE + r.path, { waitUntil: "networkidle2", timeout: 15000 })
        .catch((e) => {
          failures.push(`${r.label}: goto failed — ${e.message}`);
          return null;
        });
      await new Promise((res) => setTimeout(res, 500));
      await snapshot(p, r.label, inspect, { httpStatus: resp?.status() ?? null });
      await p.close();
    }
  } finally {
    // cleanup: 이번 세션 + 이전 잔존 smoke 세션 모두 정리. cascade로 자식 row까지 삭제.
    await cleanupSmokeSessions(pbToken);
  }

  await page.close();
}

// ── PB 헬퍼 ───────────────────────────────────────────────────────────────

async function pbFetch(path, init = {}, token) {
  const headers = { "Content-Type": "application/json", ...(init.headers ?? {}) };
  if (token) headers.Authorization = token;
  const r = await fetch(`${PB_URL}${path}`, { ...init, headers });
  const text = await r.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: r.status, ok: r.ok, body };
}

async function createSmokeSession(token) {
  if (!token) return null;
  const payload = {
    client_id: `smoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: new Date().toISOString().slice(0, 10),
    location: "smoke-loc",
    target: `${SMOKE_TAG} 자동 검증 세션`,
    shoulder_pain_start: 0,
    finger_pain_start: 0,
  };
  const res = await pbFetch(
    "/api/collections/sessions/records",
    { method: "POST", body: JSON.stringify(payload) },
    token,
  );
  if (!res.ok) {
    logStep({ smokeSessionCreate: "fail", status: res.status, body: res.body });
    return null;
  }
  logStep({ smokeSessionCreate: "ok", id: res.body?.id });
  return res.body?.id ?? null;
}

async function cleanupSmokeSessions(token) {
  if (!token) return;
  // target prefix로 식별. PB filter 인젝션 회피: tag는 코드 상수라 OK.
  const filter = `target ~ "${SMOKE_TAG}"`;
  const list = await pbFetch(
    `/api/collections/sessions/records?perPage=200&filter=${encodeURIComponent(filter)}`,
    { method: "GET" },
    token,
  );
  if (!list.ok) {
    logStep({ cleanup: "list-fail", status: list.status });
    return;
  }
  const items = list.body?.items ?? [];
  let deleted = 0;
  for (const it of items) {
    // cascade delete 설정으로 자식 hangboard/climbing/strength/campus_logs row도 함께 삭제.
    const d = await pbFetch(
      `/api/collections/sessions/records/${it.id}`,
      { method: "DELETE" },
      token,
    );
    if (d.ok) deleted++;
  }
  logStep({ cleanup: "ok", matched: items.length, deleted });
}

// ── main ──────────────────────────────────────────────────────────────────

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox"],
});
try {
  await runUnauth(browser);
  await runAuth(browser);
} finally {
  await browser.close();
}

if (failures.length > 0) {
  console.error("\nFAIL", JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log("\nOK — 모든 단계 통과");
