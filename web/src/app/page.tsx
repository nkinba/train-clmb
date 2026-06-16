import Link from "next/link";
import { BottomNav } from "@/components/bottom-nav";

export default function Home() {
  return (
    <>
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12 pb-[calc(var(--spacing-tab-bar)+1rem)] text-center">
        <h1 className="text-h1 font-bold text-fg-primary">Climb-Forge</h1>
        <p className="mt-3 text-fg-secondary">디자인 시스템 시연 · Phase 1</p>
        <p className="mt-8 text-caption text-fg-muted">
          UI 컴포넌트 카탈로그는{" "}
          <Link href="/dev/components" className="text-brand underline">
            /dev/components
          </Link>
          {" "}참조.
        </p>
      </main>
      <BottomNav activeId="today" />
    </>
  );
}
