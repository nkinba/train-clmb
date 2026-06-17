/**
 * Most-Recently-Used 입력값 캐시 (localStorage).
 *
 * 새 세션 폼의 장소/타깃 picker가 prebuilt 위에 사용자 직접 입력값을 누적해서
 * 다음 진입 시 최상단에 보여주는 용도. record 자체는 PB에 저장되지만 picker
 * 가속용 캐시는 PB까지 갈 필요 없어 localStorage로 충분.
 *
 * SSR/static export 환경 대응: window 미정의 시 빈 배열 반환.
 */

const MAX_ITEMS = 6;

export type MruKey = "cf:mru-locations" | "cf:mru-targets";

function safeRead(key: MruKey): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

function safeWrite(key: MruKey, list: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // QuotaExceeded 등은 무시 — MRU는 부차 기능.
  }
}

export function getMru(key: MruKey): string[] {
  return safeRead(key);
}

/**
 * 값을 MRU 맨 앞에 push. 동일 값이 이미 있으면 위로 끌어올리고,
 * 길이가 MAX_ITEMS 초과면 뒤에서 잘라냄. 빈 문자열은 무시.
 */
export function pushMru(key: MruKey, value: string) {
  const trimmed = value.trim();
  if (!trimmed) return;
  const cur = safeRead(key);
  const filtered = cur.filter((v) => v !== trimmed);
  filtered.unshift(trimmed);
  if (filtered.length > MAX_ITEMS) filtered.length = MAX_ITEMS;
  safeWrite(key, filtered);
}
