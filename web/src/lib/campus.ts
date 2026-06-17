import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Collections, newClientId, pb } from "@/lib/pb";
import { queuedCreate } from "@/lib/mutation-queue";

export type CampusExerciseType = "ladder" | "touch" | "double_dyno";
export type RungSize = "large" | "medium" | "small";

export type CampusLogRecord = {
  id: string;
  client_id: string;
  session_id: string;
  exercise_type: CampusExerciseType;
  rung_size: RungSize;
  movements: string;
  success_sets: number;
  total_sets: number;
  created: string;
  updated: string;
};

export type CreateCampusLogInput = {
  session_id: string;
  exercise_type: CampusExerciseType;
  rung_size: RungSize;
  movements?: string;
  success_sets: number;
  total_sets: number;
};

export const campusKeys = {
  all: ["campus_logs"] as const,
  bySession: (sessionId: string) =>
    [...campusKeys.all, "session", sessionId] as const,
};

export function useCampusLogsForSession(sessionId: string | null) {
  return useQuery({
    queryKey: [...campusKeys.all, "session", sessionId] as const,
    queryFn: async (): Promise<CampusLogRecord[]> => {
      if (!sessionId) return [];
      const res = await pb
        .collection(Collections.CampusLogs)
        .getFullList<CampusLogRecord>({
          filter: pb.filter("session_id = {:sid}", { sid: sessionId }),
          sort: "-created",
        });
      return res;
    },
    enabled: sessionId != null,
  });
}

export function useDeleteCampusLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      // delete는 멱등하지 않아 큐 적용 안 함 (v1.1). 온라인 가정.
      await pb.collection(Collections.CampusLogs).delete(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: campusKeys.all });
    },
  });
}

export function useCreateCampusLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: CreateCampusLogInput,
    ): Promise<CampusLogRecord> => {
      const payload: Record<string, unknown> = {
        client_id: newClientId(),
        session_id: input.session_id,
        exercise_type: input.exercise_type,
        rung_size: input.rung_size,
        success_sets: input.success_sets,
        total_sets: input.total_sets,
      };
      if (input.movements?.trim()) payload.movements = input.movements.trim();
      return await queuedCreate<CampusLogRecord>("campus_logs", payload);
    },
    onSuccess: (rec) => {
      qc.invalidateQueries({ queryKey: campusKeys.bySession(rec.session_id) });
    },
  });
}

export const CAMPUS_EXERCISE_LABEL: Record<CampusExerciseType, string> = {
  ladder: "Ladder",
  touch: "Touch",
  double_dyno: "Double Dyno",
};

export const RUNG_LABEL: Record<RungSize, string> = {
  large: "Large",
  medium: "Medium",
  small: "Small",
};
