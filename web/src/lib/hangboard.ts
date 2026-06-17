import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Collections, newClientId, pb } from "@/lib/pb";
import { queuedCreate } from "@/lib/mutation-queue";

export type GripType = "half_crimp" | "open_hand";

/** PRD §3 hangboard_logs subset. */
export type HangboardLogRecord = {
  id: string;
  client_id: string;
  session_id: string;
  hold_size_mm: number;
  grip_type: GripType;
  weight_offset_kg: number;
  success_sets: number;
  total_sets: number;
  target_hang_seconds: number;
  actual_hang_seconds: number;
  rpe: number;
  created: string;
  updated: string;
};

export type CreateHangboardLogInput = {
  session_id: string;
  hold_size_mm: number;
  grip_type: GripType;
  weight_offset_kg: number;
  success_sets: number;
  total_sets: number;
  target_hang_seconds: number;
  actual_hang_seconds: number;
  rpe?: number;
};

export const hangboardKeys = {
  all: ["hangboard_logs"] as const,
  bySession: (sessionId: string) =>
    [...hangboardKeys.all, "session", sessionId] as const,
};

export function useHangboardLogsForSession(sessionId: string | null) {
  return useQuery({
    queryKey: [...hangboardKeys.all, "session", sessionId] as const,
    queryFn: async (): Promise<HangboardLogRecord[]> => {
      if (!sessionId) return [];
      return await pb
        .collection(Collections.HangboardLogs)
        .getFullList<HangboardLogRecord>({
          filter: pb.filter("session_id = {:sid}", { sid: sessionId }),
          sort: "-created",
        });
    },
    enabled: sessionId != null,
  });
}

export function useDeleteHangboardLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      // delete는 멱등하지 않아 큐 적용 안 함 (v1.1). 온라인 가정.
      await pb.collection(Collections.HangboardLogs).delete(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: hangboardKeys.all });
    },
  });
}

export function useCreateHangboardLog() {
  return useMutation({
    mutationFn: async (
      input: CreateHangboardLogInput,
    ): Promise<HangboardLogRecord> => {
      const payload = {
        client_id: newClientId(),
        ...input,
      };
      // 오프라인 또는 네트워크 에러 시 IndexedDB 큐에 enqueue, 자동 flush로 동기화 (S12).
      return await queuedCreate<HangboardLogRecord>("hangboard_logs", payload);
    },
  });
}
