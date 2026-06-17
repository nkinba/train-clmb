"use client";

import { useEffect, useState } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { Collections, newClientId, pb } from "@/lib/pb";

type HealthState =
  | { kind: "loading" }
  | { kind: "ok"; ms: number; rawHealth: unknown }
  | { kind: "error"; message: string };

type ListProbe =
  | { kind: "loading" }
  | { kind: "ok"; totalItems: number }
  | { kind: "error"; message: string };

type CreateProbe =
  | { kind: "loading" }
  | { kind: "denied"; code: number; note?: string }
  | { kind: "validation"; code: number; details: unknown }
  | { kind: "unexpected"; code: number; message: string; details: unknown }
  | { kind: "ok-bypassed" }
  | { kind: "error"; message: string };

function isEmptyDetails(details: unknown): boolean {
  return (
    details !== null &&
    typeof details === "object" &&
    Object.keys(details as Record<string, unknown>).length === 0
  );
}

function extractStatus(err: unknown): number {
  if (err && typeof err === "object" && "status" in err) {
    return Number((err as { status: unknown }).status) || 0;
  }
  return 0;
}

function extractData(err: unknown): unknown {
  // pocketbase ClientResponseError: err.response.data 또는 err.data
  if (err && typeof err === "object") {
    const e = err as { response?: { data?: unknown }; data?: unknown };
    return e.response?.data ?? e.data ?? null;
  }
  return null;
}

export default function PbCheckPage() {
  const [health, setHealth] = useState<HealthState>({ kind: "loading" });
  const [listProbe, setListProbe] = useState<ListProbe>({ kind: "loading" });
  const [createProbe, setCreateProbe] = useState<CreateProbe>({ kind: "loading" });

  useEffect(() => {
    // 1) Health
    const start = performance.now();
    pb.health
      .check()
      .then((raw) => {
        setHealth({
          kind: "ok",
          ms: Math.round(performance.now() - start),
          rawHealth: raw,
        });
      })
      .catch((err: unknown) => {
        setHealth({
          kind: "error",
          message: err instanceof Error ? err.message : "unknown error",
        });
      });

    // 2) List probe (정보용 — PB list rule은 filter라 gate가 아님)
    //    listRule이 set이고 비인증이면 totalItems=0이 정상.
    //    listRule이 ""이면 모든 record 노출 → totalItems > 0 (단 record 있어야).
    pb.collection(Collections.Sessions)
      .getList(1, 1)
      .then((res) => setListProbe({ kind: "ok", totalItems: res.totalItems }))
      .catch((err: unknown) => {
        setListProbe({
          kind: "error",
          message: err instanceof Error ? err.message : "unknown error",
        });
      });

    // 3) Create probe (실제 gate 테스트)
    //    PocketBase는 보통 schema validation → rule 순서로 평가.
    //    그러므로 validation 통과할 정도의 완전한 payload를 보내야 rule 작동 여부 확인 가능.
    //    createRule이 `@request.auth.id != ""`이면 → 403
    //    createRule이 ""(public)이면 → 201 ("ok-bypassed")
    pb.collection(Collections.Sessions)
      .create({
        client_id: `probe-${newClientId()}`,
        date: new Date().toISOString(), // full ISO datetime
        location: "probe",
        total_time_mins: 0,
        target: "probe",
        notes: "automated probe — safe to delete",
        shoulder_pain_start: 0,
        finger_pain_start: 0,
        shoulder_pain_end: 0,
        finger_pain_end: 0,
      })
      .then(() => setCreateProbe({ kind: "ok-bypassed" }))
      .catch((err: unknown) => {
        const code = extractStatus(err);
        const details = extractData(err);
        if (code === 401 || code === 403) {
          setCreateProbe({ kind: "denied", code });
        } else if (code === 400 && isEmptyDetails(details)) {
          // PB v0.22 quirk: createRule 거부 시 403 대신 400 + 빈 data로 응답.
          // 서버 로그에 "DrySubmit create rule failure: sql: no rows in result set"가 동반.
          setCreateProbe({
            kind: "denied",
            code,
            note: "PB v0.22 quirk: rule 거부를 400 + empty data로 표현 (서버 로그 \"DrySubmit create rule failure\" 동반)",
          });
        } else if (code === 400) {
          setCreateProbe({ kind: "validation", code, details });
        } else if (code > 0) {
          setCreateProbe({
            kind: "unexpected",
            code,
            message: err instanceof Error ? err.message : "unknown",
            details,
          });
        } else {
          setCreateProbe({
            kind: "error",
            message: err instanceof Error ? err.message : "unknown",
          });
        }
      });
  }, []);

  return (
    <>
      <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-6 pb-[calc(var(--spacing-tab-bar)+2rem)]">
        <header>
          <h1 className="text-h1 font-bold text-fg-primary">PocketBase 연결 확인</h1>
          <p className="mt-1 text-caption text-fg-muted">
            S06: health + 2가지 probe. 인증 없이 호출되므로 createRule이 gate처럼 작동.
          </p>
        </header>

        <section className="rounded-lg bg-surface p-4">
          <h2 className="text-h3 font-semibold text-fg-primary">Health</h2>
          {health.kind === "loading" && (
            <p className="mt-2 text-fg-secondary">확인 중…</p>
          )}
          {health.kind === "ok" && (
            <div className="mt-2 space-y-2">
              <p className="text-status-success font-semibold">✓ 연결 성공 ({health.ms}ms)</p>
              <pre className="overflow-auto rounded bg-elevated p-3 text-micro text-fg-secondary">
                {JSON.stringify(health.rawHealth, null, 2)}
              </pre>
            </div>
          )}
          {health.kind === "error" && (
            <div className="mt-2 space-y-2">
              <p className="text-status-danger font-semibold">✗ 연결 실패</p>
              <p className="text-caption text-fg-secondary">{health.message}</p>
              <p className="text-micro text-fg-muted">
                docker compose가 실행 중인지, `.env.local`의 `NEXT_PUBLIC_PB_URL`이
                맞는지 확인.
              </p>
            </div>
          )}
        </section>

        <section className="rounded-lg bg-surface p-4">
          <h2 className="text-h3 font-semibold text-fg-primary">List probe — 정보용</h2>
          <p className="mt-1 text-micro text-fg-muted">
            PocketBase list rule은 SQL WHERE 절에 추가되는 <em>필터</em>지 gate가 아님.
            비인증 + `@request.auth.id != ""` → 매칭 0개 → 200 + totalItems=0이 정상.
          </p>
          {listProbe.kind === "loading" && (
            <p className="mt-2 text-fg-secondary">확인 중…</p>
          )}
          {listProbe.kind === "ok" && (
            <p className="mt-2 text-status-info">
              totalItems = {listProbe.totalItems} (해석은 createRule probe로)
            </p>
          )}
          {listProbe.kind === "error" && (
            <p className="mt-2 text-status-danger font-semibold">✗ {listProbe.message}</p>
          )}
        </section>

        <section className="rounded-lg bg-surface p-4">
          <h2 className="text-h3 font-semibold text-fg-primary">Create probe — 실제 gate</h2>
          <p className="mt-1 text-micro text-fg-muted">
            비인증 상태에서 sessions create 시도. createRule이 `@request.auth.id != ""`면 403.
          </p>
          {createProbe.kind === "loading" && (
            <p className="mt-2 text-fg-secondary">확인 중…</p>
          )}
          {createProbe.kind === "denied" && (
            <div className="mt-2 space-y-1">
              <p className="text-status-success font-semibold">
                ✓ {createProbe.code} — rule 정상 작동
              </p>
              {createProbe.note && (
                <p className="text-micro text-fg-muted">{createProbe.note}</p>
              )}
            </div>
          )}
          {createProbe.kind === "ok-bypassed" && (
            <p className="mt-2 text-status-warning font-semibold">
              ⚠ 201 Created — createRule이 비어있을 가능성. admin UI에서 점검.
              테스트 record는 sessions 컬렉션에 "probe" 라벨로 남아있음, 삭제 요망.
            </p>
          )}
          {createProbe.kind === "validation" && (
            <div className="mt-2 space-y-2">
              <p className="text-status-warning font-semibold">
                ⚠ {createProbe.code} validation 실패 — rule 평가 전 schema 검증에서 거절.
                상세를 보고 어느 필드 문제인지 확인:
              </p>
              <pre className="overflow-auto rounded bg-elevated p-3 text-micro text-fg-secondary">
                {JSON.stringify(createProbe.details, null, 2)}
              </pre>
              <p className="text-micro text-fg-muted">
                만약 PB가 rule 전에 validation을 거는 동작이면, 200/401/403이 아닌
                "특정 필드 invalid"가 떠도 rule 자체는 정상일 수 있음.
              </p>
            </div>
          )}
          {createProbe.kind === "unexpected" && (
            <div className="mt-2 space-y-2">
              <p className="text-status-warning font-semibold">
                ⚠ {createProbe.code} {createProbe.message}
              </p>
              <pre className="overflow-auto rounded bg-elevated p-3 text-micro text-fg-secondary">
                {JSON.stringify(createProbe.details, null, 2)}
              </pre>
            </div>
          )}
          {createProbe.kind === "error" && (
            <p className="mt-2 text-status-danger font-semibold">✗ {createProbe.message}</p>
          )}
        </section>

        <section className="rounded-lg bg-surface p-4">
          <h2 className="text-h3 font-semibold text-fg-primary">설정된 컬렉션</h2>
          <ul className="mt-2 space-y-1">
            {Object.entries(Collections).map(([k, v]) => (
              <li key={v} className="text-caption text-fg-secondary">
                <span className="text-fg-muted">{k} →</span>{" "}
                <code className="text-fg-primary">{v}</code>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <BottomNav />
    </>
  );
}
