import Link from "next/link";
import { CalendarDays, ChartLine, ListChecks, Settings as SettingsIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type TabId = "today" | "logs" | "analysis" | "settings";

const TABS: { id: TabId; label: string; href: string; Icon: typeof CalendarDays }[] = [
  { id: "today", label: "오늘", href: "/", Icon: CalendarDays },
  { id: "logs", label: "기록", href: "/logs", Icon: ListChecks },
  { id: "analysis", label: "분석", href: "/analysis", Icon: ChartLine },
  { id: "settings", label: "설정", href: "/settings", Icon: SettingsIcon },
];

export function BottomNav({ activeId }: { activeId: TabId }) {
  return (
    <nav
      aria-label="주 탐색"
      className="fixed inset-x-0 bottom-0 z-[40] h-tab-bar border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid h-tab-bar grid-cols-4">
        {TABS.map(({ id, label, href, Icon }) => {
          const isActive = id === activeId;
          return (
            <li key={id} className="flex">
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-1 text-micro transition-colors duration-150",
                  isActive ? "text-brand" : "text-fg-muted hover:text-fg-secondary",
                )}
              >
                <Icon
                  aria-hidden
                  size={24}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
