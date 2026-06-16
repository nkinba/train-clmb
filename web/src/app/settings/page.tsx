import { BottomNav } from "@/components/bottom-nav";

export default function SettingsPage() {
  return (
    <>
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12 pb-[calc(var(--spacing-tab-bar)+1rem)] text-center">
        <h1 className="text-h1 font-bold text-fg-primary">설정</h1>
        <p className="mt-3 text-fg-muted">v1.0 (S07 인증 이후) 확장 예정</p>
      </main>
      <BottomNav activeId="settings" />
    </>
  );
}
