import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Collections, newClientId, pb } from "@/lib/pb";
import { queuedCreate } from "@/lib/mutation-queue";

export type ClimbingType = "Lead" | "Bouldering";

/** PRD §3 climbing_logs subset. */
export type ClimbingLogRecord = {
  id: string;
  client_id: string;
  session_id: string;
  type: ClimbingType;
  grade: string;
  project_name: string;
  attempts: number;
  is_send: boolean;
  notes: string;
  rpe: number;
  created: string;
  updated: string;
};

export type CreateClimbingLogInput = {
  session_id: string;
  type: ClimbingType;
  grade: string;
  project_name?: string;
  attempts: number;
  // PRD §3: Lead일 때는 의미 없음(클라이언트에서 무시). PB bool은 null 미지원.
  is_send: boolean;
  notes?: string;
  rpe?: number;
};

export const climbingKeys = {
  all: ["climbing_logs"] as const,
  bySession: (sessionId: string) =>
    [...climbingKeys.all, "session", sessionId] as const,
};

export function useClimbingLogsForSession(sessionId: string | null) {
  return useQuery({
    queryKey: [...climbingKeys.all, "session", sessionId] as const,
    queryFn: async (): Promise<ClimbingLogRecord[]> => {
      if (!sessionId) return [];
      // pb.filter() 파라미터 바인딩 — raw template literal 인터폴레이션은 인젝션 위험.
      const res = await pb
        .collection(Collections.ClimbingLogs)
        .getFullList<ClimbingLogRecord>({
          filter: pb.filter("session_id = {:sid}", { sid: sessionId }),
          sort: "-created",
        });
      return res;
    },
    enabled: sessionId != null,
  });
}

export function useDeleteClimbingLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      // delete는 멱등하지 않아 큐 적용 안 함 (v1.1). 온라인 가정.
      await pb.collection(Collections.ClimbingLogs).delete(id);
    },
    onSuccess: (_void, _id) => {
      qc.invalidateQueries({ queryKey: climbingKeys.all });
    },
  });
}

export function useCreateClimbingLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: CreateClimbingLogInput,
    ): Promise<ClimbingLogRecord> => {
      // notes/rpe/project_name 미설정 시 키 제거 → PB가 schema default 적용.
      const payload: Record<string, unknown> = {
        client_id: newClientId(),
        session_id: input.session_id,
        type: input.type,
        grade: input.grade,
        attempts: input.attempts,
        is_send: input.is_send,
      };
      if (input.project_name?.trim()) payload.project_name = input.project_name.trim();
      if (input.notes?.trim()) payload.notes = input.notes.trim();
      if (input.rpe != null) payload.rpe = input.rpe;
      return await queuedCreate<ClimbingLogRecord>("climbing_logs", payload);
    },
    onSuccess: (rec) => {
      qc.invalidateQueries({ queryKey: climbingKeys.bySession(rec.session_id) });
    },
  });
}

// ── 그레이드 선택지 (PRD/STORIES S10 — 5.10D~5.12A / V4~V8 세그먼트) ──
export const LEAD_GRADES = [
  "5.10a",
  "5.10b",
  "5.10c",
  "5.10d",
  "5.11a",
  "5.11b",
  "5.11c",
  "5.11d",
  "5.12a",
] as const;

export const BOULDER_GRADES = ["V4", "V5", "V6", "V7", "V8"] as const;

export function gradesFor(type: ClimbingType): readonly string[] {
  return type === "Lead" ? LEAD_GRADES : BOULDER_GRADES;
}
