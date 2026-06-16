import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Collections, newClientId, pb } from "@/lib/pb";

export type PainLevel = 0 | 1 | 2 | 3;

/**
 * PocketBase record shape (subset).
 * PRD §3 sessions 필드 + PB 기본 id/created/updated.
 * total_time_mins, notes, *_pain_end는 종료 시점에 채워지므로 nullable로 취급.
 */
export type SessionRecord = {
  id: string;
  client_id: string;
  date: string;
  location: string;
  target: string;
  notes: string;
  total_time_mins: number;
  shoulder_pain_start: PainLevel;
  finger_pain_start: PainLevel;
  shoulder_pain_end: PainLevel;
  finger_pain_end: PainLevel;
  created: string;
  updated: string;
};

export type CreateSessionInput = {
  date: string;
  location: string;
  target: string;
  shoulder_pain_start: PainLevel;
  finger_pain_start: PainLevel;
};

export type EndSessionInput = {
  shoulder_pain_end: PainLevel;
  finger_pain_end: PainLevel;
  total_time_mins: number;
  notes: string;
};

// ── 활성 세션 추적 (localStorage) ──
// Cloudflare Pages 정적 호스팅 + dynamic [id] 라우트 회피용.
// 동시 활성 세션은 1개라는 단일 사용자 가정에서만 성립.
const ACTIVE_KEY = "cf:active-session-id";

export function getActiveSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_KEY);
}

export function setActiveSessionId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id == null) {
    window.localStorage.removeItem(ACTIVE_KEY);
  } else {
    window.localStorage.setItem(ACTIVE_KEY, id);
  }
}

// ── Query keys ──
export const sessionKeys = {
  all: ["sessions"] as const,
  detail: (id: string) => [...sessionKeys.all, "detail", id] as const,
};

// ── Hooks ──

export function useSession(id: string | null) {
  return useQuery({
    queryKey: [...sessionKeys.all, "detail", id] as const,
    queryFn: async () => {
      if (!id) return null;
      const rec = await pb
        .collection(Collections.Sessions)
        .getOne<SessionRecord>(id);
      return rec;
    },
    enabled: id != null,
  });
}

export function useCreateSession() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateSessionInput): Promise<SessionRecord> => {
      // 종료 필드(total_time_mins, *_pain_end)는 schema required:false.
      // 여기서 0으로 박으면 "진행 중 vs 종료된 세션"을 값으로 구분 못 함 → 미전송.
      const payload = {
        client_id: newClientId(),
        date: input.date,
        location: input.location,
        target: input.target,
        shoulder_pain_start: input.shoulder_pain_start,
        finger_pain_start: input.finger_pain_start,
      };
      return await pb
        .collection(Collections.Sessions)
        .create<SessionRecord>(payload);
    },
    onSuccess: (rec) => {
      qc.setQueryData(sessionKeys.detail(rec.id), rec);
      setActiveSessionId(rec.id);
    },
  });
}

export function useEndSession(id: string | null) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: EndSessionInput): Promise<SessionRecord> => {
      if (!id) throw new Error("no active session id");
      return await pb
        .collection(Collections.Sessions)
        .update<SessionRecord>(id, input);
    },
    onMutate: async (input) => {
      if (!id) return;
      // optimistic update: 종료 필드를 즉시 캐시에 반영
      await qc.cancelQueries({ queryKey: sessionKeys.detail(id) });
      const previous = qc.getQueryData<SessionRecord>(sessionKeys.detail(id));
      if (previous) {
        qc.setQueryData<SessionRecord>(sessionKeys.detail(id), {
          ...previous,
          ...input,
        });
      }
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (!id) return;
      if (ctx?.previous) {
        qc.setQueryData(sessionKeys.detail(id), ctx.previous);
      }
    },
    onSuccess: () => {
      setActiveSessionId(null);
    },
  });
}
