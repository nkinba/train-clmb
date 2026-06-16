import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Collections, newClientId, pb } from "@/lib/pb";
import { queuedCreate } from "@/lib/mutation-queue";

export type StrengthLogRecord = {
  id: string;
  client_id: string;
  session_id: string;
  exercise_name: string;
  added_weight_kg: number;
  reps: number;
  sets: number;
  rpe: number;
  created: string;
  updated: string;
};

export type CreateStrengthLogInput = {
  session_id: string;
  exercise_name: string;
  added_weight_kg: number;
  reps: number;
  sets: number;
  rpe?: number;
};

export const strengthKeys = {
  all: ["strength_logs"] as const,
  bySession: (sessionId: string) =>
    [...strengthKeys.all, "session", sessionId] as const,
};

export function useStrengthLogsForSession(sessionId: string | null) {
  return useQuery({
    queryKey: [...strengthKeys.all, "session", sessionId] as const,
    queryFn: async (): Promise<StrengthLogRecord[]> => {
      if (!sessionId) return [];
      const res = await pb
        .collection(Collections.StrengthLogs)
        .getFullList<StrengthLogRecord>({
          filter: pb.filter("session_id = {:sid}", { sid: sessionId }),
          sort: "-created",
        });
      return res;
    },
    enabled: sessionId != null,
  });
}

export function useCreateStrengthLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: CreateStrengthLogInput,
    ): Promise<StrengthLogRecord> => {
      const payload: Record<string, unknown> = {
        client_id: newClientId(),
        session_id: input.session_id,
        exercise_name: input.exercise_name,
        added_weight_kg: input.added_weight_kg,
        reps: input.reps,
        sets: input.sets,
      };
      if (input.rpe != null) payload.rpe = input.rpe;
      return await queuedCreate<StrengthLogRecord>("strength_logs", payload);
    },
    onSuccess: (rec) => {
      qc.invalidateQueries({ queryKey: strengthKeys.bySession(rec.session_id) });
    },
  });
}

/**
 * STORIES S11 "자주 쓰는 종목 즐겨찾기" — 사전 정의 목록.
 * 사용자가 직접 입력하는 free-form custom은 별도 입력 필드로 처리.
 * 동적 즐겨찾기 추가/삭제는 v1.1.
 */
export const STRENGTH_PRESETS = [
  "Pull-up",
  "Lock-off",
  "Hanging Leg Raise",
  "Push-up",
  "Dip",
  "Deadlift",
  "Squat",
  "Overhead Press",
  "Bent-over Row",
  "L-Sit",
] as const;
