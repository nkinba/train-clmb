import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Collections, newClientId, pb } from "@/lib/pb";

/** PRD §8 + S18-B media subset. */
export type MediaKind = "photo" | "video";

export type MediaRecord = {
  id: string;
  collectionId: string;
  collectionName: string;
  client_id: string;
  session_id: string;
  kind: MediaKind;
  file: string;
  note: string;
  created: string;
  updated: string;
};

export type UploadMediaInput = {
  session_id: string;
  kind: MediaKind;
  file: File;
  note?: string;
  /** 진행률 콜백 (0–1). XHR upload progress 이벤트가 발생할 때마다. */
  onProgress?: (ratio: number) => void;
};

export const mediaKeys = {
  all: ["media"] as const,
  bySession: (sessionId: string) =>
    [...mediaKeys.all, "session", sessionId] as const,
  library: () => [...mediaKeys.all, "library"] as const,
  fileToken: () => ["pb-file-token"] as const,
};

/**
 * PB의 file URL은 viewRule auth 필요 — `pb.files.getToken()`로 발급한 단명 토큰을
 * 쿼리 파라미터로 부착. TTL은 PB 기본 약 5분이라 4분 staleTime + refetchInterval.
 */
export function useFileToken() {
  // 인증 가드는 AuthGuard가 라우트 레벨에서 처리 — 본 hook은 보호 라우트 안에서만 호출됨.
  // `pb.authStore.isValid`는 getter라 React가 변화 감지 못 함 → enabled 제거.
  return useQuery({
    queryKey: mediaKeys.fileToken(),
    queryFn: () => pb.files.getToken(),
    staleTime: 4 * 60 * 1000,
    refetchInterval: 4 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

/**
 * `<img src>` / `<video src>`에 직접 사용 가능한 file URL.
 * token이 없으면 인증 사용자도 403 — useFileToken().data를 받아서 전달.
 */
export function mediaFileUrl(
  rec: Pick<MediaRecord, "collectionId" | "id" | "file">,
  token?: string,
): string {
  if (!rec.file) return "";
  return pb.files.getUrl(
    { collectionId: rec.collectionId, id: rec.id },
    rec.file,
    token ? { token } : undefined,
  );
}

/** 전체 미디어 일람 — /library 페이지. 세션 필터 없이 created desc. */
export function useAllMedia() {
  return useQuery({
    queryKey: mediaKeys.library(),
    queryFn: async (): Promise<MediaRecord[]> => {
      return await pb.collection(Collections.Media).getFullList<MediaRecord>({
        sort: "-created",
      });
    },
    staleTime: 60 * 1000,
  });
}

export function useSessionMedia(sessionId: string | null) {
  return useQuery({
    queryKey: sessionId ? mediaKeys.bySession(sessionId) : mediaKeys.all,
    queryFn: async (): Promise<MediaRecord[]> => {
      if (!sessionId) return [];
      return await pb
        .collection(Collections.Media)
        .getFullList<MediaRecord>({
          filter: pb.filter("session_id = {:sid}", { sid: sessionId }),
          sort: "-created",
        });
    },
    enabled: sessionId != null,
  });
}

/**
 * 파일 업로드 (XHR + multipart/form-data).
 *
 * PB JS SDK는 fetch 기반이라 업로드 진행률 이벤트를 받을 수 없어 XHR을 직접 사용.
 * 토큰은 SDK의 LocalAuthStore에서 가져와 `Authorization` 헤더로 주입 (PB 관례 — Bearer 아님).
 *
 * 오프라인 큐(S12)는 JSON mutation 가정이라 파일 업로드는 별도 follow-up.
 * 우선 v1.1은 온라인 가정 + 실패 시 즉시 에러.
 */
export function useUploadMedia() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: UploadMediaInput): Promise<MediaRecord> => {
      const fd = new FormData();
      fd.append("client_id", newClientId());
      fd.append("session_id", input.session_id);
      fd.append("kind", input.kind);
      fd.append("file", input.file, input.file.name);
      if (input.note) fd.append("note", input.note);

      const baseUrl = pb.baseUrl.replace(/\/+$/, "");
      const url = `${baseUrl}/api/collections/${Collections.Media}/records`;
      const token = pb.authStore.token;

      if (!token) {
        // afterSend가 못 잡는 경로 — XHR 직접 호출이라 SDK 가드 우회.
        // 빈 토큰으로 진행하면 헤더 누락 → 403, race 회피.
        pb.authStore.clear();
        throw new Error("not authenticated");
      }

      return await new Promise<MediaRecord>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // 모바일 셀룰러에서 50MB 영상이 길어질 수 있어 넉넉히 5분.
        xhr.timeout = 5 * 60 * 1000;

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable && input.onProgress) {
            input.onProgress(e.loaded / e.total);
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText) as MediaRecord);
            } catch {
              reject(new Error("invalid response from PB"));
            }
          } else {
            // PB 4xx 응답은 JSON {message, data}. 401은 afterSend가 XHR을 못 잡으므로 명시 reject.
            let detail = `HTTP ${xhr.status}`;
            try {
              const body = JSON.parse(xhr.responseText) as { message?: string };
              if (body.message) detail = body.message;
            } catch {
              // raw text 그대로
              if (xhr.responseText) detail = xhr.responseText.slice(0, 200);
            }
            if (xhr.status === 401) pb.authStore.clear();
            reject(new Error(detail));
          }
        });

        xhr.addEventListener("error", () => reject(new Error("network error")));
        xhr.addEventListener("abort", () => reject(new Error("upload aborted")));
        xhr.addEventListener("timeout", () =>
          reject(new Error("upload timeout (5분 초과)")),
        );

        xhr.open("POST", url);
        xhr.setRequestHeader("Authorization", token);
        xhr.send(fd);
      });
    },
    onSuccess: (rec) => {
      qc.invalidateQueries({ queryKey: mediaKeys.bySession(rec.session_id) });
    },
  });
}

export function useDeleteMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await pb.collection(Collections.Media).delete(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: mediaKeys.all });
    },
  });
}
