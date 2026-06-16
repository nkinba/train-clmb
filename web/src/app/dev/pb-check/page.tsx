"use client";

import { useEffect, useState } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { Collections, pb } from "@/lib/pb";

type Status =
  | { kind: "loading" }
  | { kind: "ok"; ms: number; rawHealth: unknown; rulesNote: string };

type CollectionProbe =
  | { kind: "loading" }
  | { kind: "denied"; code: number; message: string }
  | { kind: "ok"; count: number }
  | { kind: "error"; message: string };

export default function PbCheckPage() {
  const [status, setStatus] = useState<Status | { kind: "error"; message: string }>(
    { kind: "loading" },
  );
  const [probe, setProbe] = useState<CollectionProbe>({ kind: "loading" });

  useEffect(() => {
    const start = performance.now();
    pb.health
      .check()
      .then((health) => {
        const ms = Math.round(performance.now() - start);
        setStatus({
          kind: "ok",
          ms,
          rawHealth: health,
          rulesNote:
            "health는 인증 불필요. 아래 collection probe로 rule 작동 확인.",
        });
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "unknown error (콘솔 확인)";
        setStatus({ kind: "error", message });
      });

    // Rule이 실제 작동하는지 확인: 비인증 상태에서 sessions 1건 조회 시도.
    // 기대값 = 401/403 → "rule 정상 작동" 신호.
    pb.collection(Collections.Sessions)
      .getList(1, 1)
      .then((res) => setProbe({ kind: "ok", count: res.totalItems }))
      .catch((err: unknown) => {
        const status =
          err && typeof err === "object" && "status" in err
            ? Number((err as { status: unknown }).status)
            : 0;
        if (status === 401 || status === 403) {
          setProbe({
            kind: "denied",
            code: status,
            message: "auth required (rule 정상 작동)",
          });
        } else {
          const message =
            err instanceof Error ? err.message : "unknown error";
          setProbe({ kind: "error", message });
        }
      });
  }, []);

  return (
    <>
      <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-6 pb-[calc(var(--spacing-tab-bar)+2rem)]">
        <header>
          <h1 className="text-h1 font-bold text-fg-primary">PocketBase 연결 확인</h1>
          <p className="mt-1 text-caption text-fg-muted">
            S06 sample fetch. `NEXT_PUBLIC_PB_URL`로 health 호출.
          </p>
        </header>

        <section className="rounded-lg bg-surface p-4">
          <h2 className="text-h3 font-semibold text-fg-primary">Health</h2>
          {status.kind === "loading" && (
            <p className="mt-2 text-fg-secondary">확인 중…</p>
          )}
          {status.kind === "ok" && (
            <div className="mt-2 space-y-2">
              <p className="text-status-success font-semibold">✓ 연결 성공 ({status.ms}ms)</p>
              <pre className="overflow-auto rounded bg-elevated p-3 text-micro text-fg-secondary">
                {JSON.stringify(status.rawHealth, null, 2)}
              </pre>
            </div>
          )}
          {status.kind === "error" && (
            <div className="mt-2 space-y-2">
              <p className="text-status-danger font-semibold">✗ 연결 실패</p>
              <p className="text-caption text-fg-secondary">{status.message}</p>
              <p className="text-micro text-fg-muted">
                docker compose가 실행 중인지, `.env.local`의 `NEXT_PUBLIC_PB_URL`이
                맞는지 확인.
              </p>
            </div>
          )}
        </section>

        <section className="rounded-lg bg-surface p-4">
          <h2 className="text-h3 font-semibold text-fg-primary">Rule probe (sessions)</h2>
          <p className="mt-1 text-micro text-fg-muted">
            비인증 상태에서 sessions 조회 시도. 401/403이 정상.
          </p>
          {probe.kind === "loading" && (
            <p className="mt-2 text-fg-secondary">확인 중…</p>
          )}
          {probe.kind === "denied" && (
            <p className="mt-2 text-status-success font-semibold">
              ✓ {probe.code} {probe.message}
            </p>
          )}
          {probe.kind === "ok" && (
            <p className="mt-2 text-status-warning font-semibold">
              ⚠ rule 우회됨 (totalItems={probe.count}) — 인증 없이 읽힘. rule 점검 필요.
            </p>
          )}
          {probe.kind === "error" && (
            <p className="mt-2 text-status-danger font-semibold">
              ✗ {probe.message}
            </p>
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
      <BottomNav activeId="today" />
    </>
  );
}
