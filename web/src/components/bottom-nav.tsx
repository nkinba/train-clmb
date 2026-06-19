"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ChartLine, Images, ListChecks, Settings as SettingsIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type TabId = "today" | "logs" | "analysis" | "library" | "settings";

const TABS: { id: TabId; label: string; href: string; Icon: typeof CalendarDays }[] = [
  { id: "today", label: "오늘", href: "/", Icon: CalendarDays },
  { id: "logs", label: "기록", href: "/logs", Icon: ListChecks },
  { id: "analysis", label: "분석", href: "/analysis", Icon: ChartLine },
  { id: "library", label: "미디어", href: "/library", Icon: Images },
  { id: "settings", label: "설정", href: "/settings", Icon: SettingsIcon },
];

/**
 * 자동 active 탭 매칭:
 * - `/logs` 계열 → logs, `/analysis` 계열 → analysis, `/settings` 계열 → settings
 * - 그 외(`/`, `/sessions/*` 포함) → today (세션은 "오늘" 워크플로우의 일부)
 */
function activeIdFor(pathname: string | null): TabId {
  if (!pathname) return "today";
  if (pathname.startsWith("/logs")) return "logs";
  if (pathname.startsWith("/analysis")) return "analysis";
  if (pathname.startsWith("/library")) return "library";
  if (pathname.startsWith("/settings")) return "settings";
  return "today";
}

export function BottomNav() {
  const pathname = usePathname();
  const activeId = activeIdFor(pathname);

  return (
    <nav
      aria-label="주 탐색"
      className="fixed inset-x-0 bottom-0 z-[40] h-tab-bar border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid h-tab-bar grid-cols-5">
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
                <span className="whitespace-nowrap">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
