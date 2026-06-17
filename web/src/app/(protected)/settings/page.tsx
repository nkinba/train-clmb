import { LogoutButton } from "@/components/logout-button";

export default function SettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6 pb-[calc(var(--spacing-tab-bar)+2rem)]">
        <header>
          <h1 className="text-h1 font-bold text-fg-primary">설정</h1>
          <p className="mt-1 text-caption text-fg-muted">
            확장은 v1.0 (S08 이후).
          </p>
        </header>

        <section className="rounded-lg bg-surface p-4">
          <h2 className="text-h3 font-semibold text-fg-primary">계정</h2>
          <p className="mt-1 text-caption text-fg-muted">
            로그아웃 시 토큰을 즉시 제거하고 로그인 페이지로 이동.
          </p>
          <div className="mt-4">
            <LogoutButton />
          </div>
        </section>
    </main>
  );
}
