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
const EMAIL = process.env.CF_TEST_EMAIL;
const PASSWORD = process.env.CF_TEST_PASSWORD;

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
  if (!page.url().includes("/login")) {
    // 좋음
  } else {
    failures.push("a02: still on /login after submit (auth failed?)");
    await page.close();
    return;
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

  for (const r of AUTH_ROUTES) {
    const p = await browser.newPage();
    await p.setViewport(VIEWPORT);
    // 같은 origin이라 cookies가 필요한데 puppeteer는 페이지 간 storage 공유 안 됨.
    // → localStorage(인증 토큰) 이전: 첫 page에서 토큰 추출 후 새 페이지에 inject.
    // 단순화: 동일 BrowserContext에서 모든 페이지는 cookies/localStorage origin 공유.
    // 실제 PB SDK는 localStorage에 토큰 저장 → 같은 origin에서 새 페이지가 공유 X.
    // 우회: 첫 page의 토큰을 추출해 evaluateOnNewDocument로 미리 주입.
    await p.evaluateOnNewDocument((token) => {
      if (token) localStorage.setItem("pocketbase_auth", token);
    }, await page.evaluate(() => localStorage.getItem("pocketbase_auth")));

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

  await page.close();
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
