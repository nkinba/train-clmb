import { get, set, createStore } from "idb-keyval";
import { newClientId, pb } from "@/lib/pb";

/**
 * 오프라인 입력 큐 (S12).
 *
 * - IndexedDB(`cf-mutation-queue` store) 에 FIFO 큐로 PendingMutation 리스트 저장.
 * - 자식 컬렉션(hangboard/climbing/strength/campus) create 호출만 큐 경유.
 *   세션 create/end는 server-side ID에 의존하는 흐름이 많아 온라인 가정 (v1.1 follow-up).
 * - 단일 사용자라 충돌 해결은 단순: created 순서 그대로 push.
 * - client_id 멱등 키 (ADR-4) — 재전송 시 PB가 unique index로 중복 거부, 클라이언트는
 *   PB 응답에서 "이미 있음(409 또는 unique violation)"을 success로 취급해 큐에서 제거.
 *
 * 시그널:
 * - `online` 이벤트 + `online` 폴링(5초)로 자동 flush.
 * - 큐 변경 시 BroadcastChannel("cf-queue")로 같은 origin 탭에 notify (배지 갱신).
 */

const STORE = createStore("cf-mutation-queue", "kv");
const QUEUE_KEY = "queue:v1";

export type SupportedCollection =
  | "hangboard_logs"
  | "climbing_logs"
  | "strength_logs"
  | "campus_logs";

export type PendingMutation = {
  id: string; // 큐 내부 id
  client_id: string; // PB 레코드 client_id (멱등 키)
  collection: SupportedCollection;
  payload: Record<string, unknown>;
  createdAt: number;
  retries: number;
  lastError?: string;
};

type QueueChange = { length: number };

const CH_NAME = "cf-queue";
const SAME_TAB_EVENT = "cf-queue-change";

// 모듈 단위 BroadcastChannel 1개 재사용 — enqueue마다 새로 만들지 않음.
let _channel: BroadcastChannel | null = null;
function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (typeof BroadcastChannel === "undefined") return null;
  if (!_channel) {
    try {
      _channel = new BroadcastChannel(CH_NAME);
    } catch {
      _channel = null;
    }
  }
  return _channel;
}

function notifyChange(length: number) {
  if (typeof window === "undefined") return;
  // BroadcastChannel은 *같은 탭*으로는 메시지를 보내지 않는다 (스펙).
  // → 같은 탭의 useQueueStatus도 즉시 반응할 수 있도록 CustomEvent 동시 발사.
  try {
    getChannel()?.postMessage({ length } satisfies QueueChange);
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(
      new CustomEvent<QueueChange>(SAME_TAB_EVENT, { detail: { length } }),
    );
  } catch {
    /* ignore */
  }
}

async function readQueue(): Promise<PendingMutation[]> {
  if (typeof window === "undefined") return [];
  const data = await get<PendingMutation[]>(QUEUE_KEY, STORE);
  return data ?? [];
}

async function writeQueue(next: PendingMutation[]): Promise<void> {
  await set(QUEUE_KEY, next, STORE);
  notifyChange(next.length);
}

export async function queueLength(): Promise<number> {
  return (await readQueue()).length;
}

export function subscribeQueueChange(handler: (length: number) => void): () => void {
  if (typeof window === "undefined") return () => {};

  // BroadcastChannel (다른 탭) + CustomEvent (같은 탭) 둘 다 구독.
  const ch = getChannel();
  const onBcast = (e: MessageEvent) => {
    const data = e.data as QueueChange;
    handler(data.length);
  };
  ch?.addEventListener("message", onBcast);

  const onSame = (e: Event) => {
    const ce = e as CustomEvent<QueueChange>;
    handler(ce.detail.length);
  };
  window.addEventListener(SAME_TAB_EVENT, onSame);

  return () => {
    ch?.removeEventListener("message", onBcast);
    window.removeEventListener(SAME_TAB_EVENT, onSame);
  };
}

async function enqueue(collection: SupportedCollection, client_id: string, payload: Record<string, unknown>): Promise<PendingMutation> {
  const q = await readQueue();
  const item: PendingMutation = {
    // 큐 내부 식별자 — PB record client_id와 의미가 다르지만 generator를 공유.
    id: newClientId(),
    client_id,
    collection,
    payload,
    createdAt: Date.now(),
    retries: 0,
  };
  q.push(item);
  await writeQueue(q);
  return item;
}

const MAX_RETRIES = 3;

function isClientIdConflict(err: unknown): boolean {
  // PB v0.22 ClientResponseError 구조:
  //   err.status = 400
  //   err.data = { code, message, data: { client_id: { code: "validation_not_unique", ... } } }
  // 또는 err.response.data 형태로 들어올 수 있음.
  if (!err || typeof err !== "object") return false;
  const e = err as {
    status?: number;
    response?: { data?: { data?: Record<string, unknown> } };
    data?: { data?: Record<string, unknown> } | Record<string, unknown>;
  };
  const status = e.status;
  if (status === 409) return true;
  if (status !== 400) return false;

  // 한 레벨 또는 두 레벨 안쪽에 client_id 키가 있는지 모두 확인.
  const outer = (e.response?.data ?? e.data) as Record<string, unknown> | undefined;
  if (!outer) return false;
  if ("client_id" in outer) return true;
  const inner = (outer as { data?: Record<string, unknown> }).data;
  if (inner && "client_id" in inner) return true;
  return false;
}

function isNetworkLike(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { status?: number; isAbort?: boolean; message?: string };
  // PB SDK가 자체 abort나 fetch 실패 시 status 0 또는 isAbort=true를 전달.
  if (e.isAbort) return true;
  if (e.status === 0 || e.status == null) return true;
  if (typeof e.message === "string" && /network|fetch|failed/i.test(e.message)) {
    return true;
  }
  return false;
}

/**
 * 자식 컬렉션 create의 queue-경유 wrapper.
 *
 * - payload에 client_id가 없으면 발급.
 * - 온라인 + PB 응답 성공: server record 리턴.
 * - 오프라인(`navigator.onLine === false`) 또는 네트워크 에러(`isNetworkLike`):
 *   큐에 enqueue + fake record 리턴 (`id` 비어있음).
 *   주의: `navigator.onLine`은 false negative가 흔함(iOS Safari, Captive Portal 등).
 *   `try/catch + isNetworkLike` 안전망으로 우회.
 *   호출 측은 onSuccess에서 `rec.id`를 사용하지 않아야 함 — hangboard/climbing/strength/campus의
 *   onSuccess는 `invalidateQueries({ queryKey: bySession(rec.session_id) })`만 호출하며,
 *   session_id는 payload에서 fake record로 그대로 보존되므로 정상 동작.
 * - 그 외 에러(스키마 위반 등): 그대로 throw.
 */
export async function queuedCreate<T extends { client_id: string; id?: string }>(
  collection: SupportedCollection,
  payload: Record<string, unknown>,
): Promise<T> {
  const client_id = (payload.client_id as string | undefined) ?? newClientId();
  const enriched = { ...payload, client_id };

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    const item = await enqueue(collection, client_id, enriched);
    return makeFakeRecord<T>(item);
  }

  try {
    return await pb.collection(collection).create<T>(enriched);
  } catch (err) {
    if (isNetworkLike(err)) {
      const item = await enqueue(collection, client_id, enriched);
      return makeFakeRecord<T>(item);
    }
    throw err;
  }
}

/**
 * 큐에 들어간 mutation의 "임시" 레코드.
 * `id`는 빈 문자열 — 서버 ID는 flush 후에 알 수 있어 호출 측이 의존하면 안 됨.
 * payload 전체를 spread해 client_id/session_id 등은 보존.
 */
function makeFakeRecord<T extends { client_id: string; id?: string }>(item: PendingMutation): T {
  return {
    ...item.payload,
    id: "",
    client_id: item.client_id,
    created: new Date(item.createdAt).toISOString(),
    updated: new Date(item.createdAt).toISOString(),
  } as unknown as T;
}

/**
 * 큐를 한 번 flush. 성공/실패/dead-letter 결과를 리턴.
 * - FIFO 순서로 시도.
 * - 네트워크 에러는 중단 (다음 시도까지 큐에 보존).
 * - client_id 충돌(이미 있음)은 success로 취급해 큐에서 제거 (멱등).
 * - 그 외 에러는 retries 증가, MAX_RETRIES 도달 시 dead-letter로 분리 (자동 재시도 중지).
 *   dead-letter는 `getDeadLetters()`로 조회 가능, 사용자가 수동 재시도 또는 폐기.
 *
 * onSuccess collections set은 호출 측이 query invalidation에 사용.
 */
export async function flushQueue(): Promise<{
  attempted: number;
  succeeded: number;
  remaining: number;
  deadLetters: number;
  succeededCollections: SupportedCollection[];
}> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    const q = await readQueue();
    return {
      attempted: 0,
      succeeded: 0,
      remaining: q.length,
      deadLetters: (await readDeadLetters()).length,
      succeededCollections: [],
    };
  }

  let q = await readQueue();
  let succeeded = 0;
  let attempted = 0;
  const succeededCollections = new Set<SupportedCollection>();

  while (q.length > 0) {
    const head = q[0];
    // 안전망: dead-letter 임계 도달 항목이 큐에 섞여있으면 skip (이중 방어).
    if (head.retries >= MAX_RETRIES) {
      await moveToDeadLetters(head);
      q = q.slice(1);
      await writeQueue(q);
      continue;
    }
    attempted++;
    try {
      await pb.collection(head.collection).create(head.payload);
      succeeded++;
      succeededCollections.add(head.collection);
      q = q.slice(1);
      await writeQueue(q);
    } catch (err) {
      if (isClientIdConflict(err)) {
        succeeded++;
        succeededCollections.add(head.collection);
        q = q.slice(1);
        await writeQueue(q);
        continue;
      }
      if (isNetworkLike(err)) {
        break;
      }
      // 기타 에러(스키마/권한 등) — retries 증가.
      const retries = head.retries + 1;
      const updated: PendingMutation = {
        ...head,
        retries,
        lastError: err instanceof Error ? err.message : String(err),
      };
      if (retries >= MAX_RETRIES) {
        // dead-letter 키로 이동 → 큐에서 완전히 제거.
        await moveToDeadLetters(updated);
        q = q.slice(1);
        await writeQueue(q);
      } else {
        q = [updated, ...q.slice(1)];
        await writeQueue(q);
        // 같은 항목 한 라운드 내 무한 재시도 방지.
        break;
      }
    }
  }

  return {
    attempted,
    succeeded,
    remaining: q.length,
    deadLetters: (await readDeadLetters()).length,
    succeededCollections: Array.from(succeededCollections),
  };
}

// ── Dead-letter store ──
const DEAD_KEY = "dead:v1";

async function readDeadLetters(): Promise<PendingMutation[]> {
  if (typeof window === "undefined") return [];
  const data = await get<PendingMutation[]>(DEAD_KEY, STORE);
  return data ?? [];
}

async function moveToDeadLetters(item: PendingMutation): Promise<void> {
  const dead = await readDeadLetters();
  dead.push(item);
  await set(DEAD_KEY, dead, STORE);
}

export async function getDeadLetters(): Promise<PendingMutation[]> {
  return readDeadLetters();
}

export async function getPendingItems(): Promise<PendingMutation[]> {
  return readQueue();
}
