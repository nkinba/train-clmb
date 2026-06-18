import { useQuery } from "@tanstack/react-query";
import { pb } from "@/lib/pb";

/**
 * 세션 타깃 카탈로그 (PB `targets` 컬렉션).
 * picker UI 가속용 read-only 카탈로그. create/update/delete는 admin 전용.
 */

export type TargetCategory = "grade" | "condition" | "technique" | "casual";

export type TargetRecord = {
  id: string;
  label: string;
  category: TargetCategory;
  sort_order: number;
};

export const TARGET_CATEGORY_LABEL: Record<TargetCategory, string> = {
  grade: "그레이드",
  condition: "컨디션·볼륨",
  technique: "기술·홀드",
  casual: "캐주얼",
};

export function useTargets() {
  return useQuery({
    queryKey: ["targets", "all"] as const,
    queryFn: async () => {
      const items = await pb.collection("targets").getFullList<TargetRecord>({
        sort: "sort_order,label",
      });
      return items;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
