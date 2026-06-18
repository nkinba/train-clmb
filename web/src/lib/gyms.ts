import { useQuery } from "@tanstack/react-query";
import { pb } from "@/lib/pb";

/**
 * 클라이밍 짐 카탈로그 (PB `gyms` 컬렉션).
 * picker UI 가속용 read-only 카탈로그. create/update/delete는 admin 전용.
 */

export type GymCategory = "gym-seoul" | "gym-suburb" | "outdoor" | "home";

export type GymRecord = {
  id: string;
  name: string;
  category: GymCategory;
  sort_order: number;
};

export const GYM_CATEGORY_LABEL: Record<GymCategory, string> = {
  "gym-seoul": "서울 짐",
  "gym-suburb": "수도권·지방",
  outdoor: "야외",
  home: "홈/행보드",
};

export function useGyms() {
  return useQuery({
    queryKey: ["gyms", "all"] as const,
    queryFn: async () => {
      const items = await pb.collection("gyms").getFullList<GymRecord>({
        sort: "sort_order,name",
      });
      return items;
    },
    // 카탈로그는 좀처럼 안 바뀜 — staleTime 길게.
    staleTime: 5 * 60 * 1000,
    // 401 시 lib/pb.ts afterSend가 authStore.clear → AuthGuard redirect.
    // retry 3회면 그 사이 fallback UI가 3번 깜빡임 — 1회로 제한.
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
