"use client";

import { useRouter } from "next/navigation";
import { pb } from "@/lib/pb";

export function LogoutButton() {
  const router = useRouter();
  const onClick = () => {
    pb.authStore.clear();
    router.replace("/login/");
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-tap-default w-full rounded-lg bg-elevated text-fg-primary text-bodyLg font-semibold transition-colors hover:bg-subtle"
    >
      로그아웃
    </button>
  );
}
