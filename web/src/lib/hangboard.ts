import { useMutation } from "@tanstack/react-query";
import { Collections, newClientId, pb } from "@/lib/pb";

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

export function useCreateHangboardLog() {
  return useMutation({
    mutationFn: async (
      input: CreateHangboardLogInput,
    ): Promise<HangboardLogRecord> => {
      const payload = {
        client_id: newClientId(),
        ...input,
      };
      return await pb
        .collection(Collections.HangboardLogs)
        .create<HangboardLogRecord>(payload);
    },
  });
}
