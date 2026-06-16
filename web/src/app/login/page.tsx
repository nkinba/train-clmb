"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { pb } from "@/lib/pb";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  // checkedAuth=false 동안은 폼 자체를 렌더 안 함 (이미 로그인된 사용자 진입 시 form flash 방지)
  const [checkedAuth, setCheckedAuth] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (pb.authStore.isValid) {
      router.replace("/");
    } else {
      setCheckedAuth(true);
    }
  }, [router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsPending(true);
    try {
      await pb.collection("users").authWithPassword(email, password);
      if (!mountedRef.current) return;
      router.replace("/");
    } catch (err) {
      if (!mountedRef.current) return;
      const message =
        err instanceof Error ? err.message : "로그인 실패 — 자격 증명 확인";
      setError(message);
      setIsPending(false);
    }
  };

  if (!checkedAuth) {
    return (
      <main
        role="status"
        aria-live="polite"
        className="flex flex-1 items-center justify-center"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-subtle border-t-fg-primary" />
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-5"
        aria-label="로그인 폼"
      >
        <header className="space-y-1">
          <h1 className="text-h1 font-bold text-fg-primary">로그인</h1>
          <p className="text-caption text-fg-muted">
            Climb-Forge · 1인 사용자 인증 (ADR-5)
          </p>
        </header>

        <label className="block">
          <span className="text-caption text-fg-secondary">이메일</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            inputMode="email"
            required
            className="mt-1 h-tap-default w-full rounded-md bg-surface px-3 text-fg-primary outline-none"
          />
        </label>

        <label className="block">
          <span className="text-caption text-fg-secondary">비밀번호</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="mt-1 h-tap-default w-full rounded-md bg-surface px-3 text-fg-primary outline-none"
          />
        </label>

        {error && (
          <p
            role="alert"
            className="rounded-md bg-elevated px-3 py-2 text-caption text-status-danger"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending || !email || !password}
          className="h-tap-default w-full rounded-lg bg-brand text-on-brand text-bodyLg font-semibold transition-colors hover:bg-brand-hover active:bg-brand-active disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "로그인 중…" : "로그인"}
        </button>
      </form>
    </main>
  );
}
