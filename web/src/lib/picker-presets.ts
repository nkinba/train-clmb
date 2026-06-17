/**
 * Picker presets — 새 세션 폼의 장소/타깃 입력 가속용 prebuilt 리스트.
 *
 * 모든 라벨은 사용자가 그대로 record.location / record.target 필드에 들어감.
 * 카테고리는 picker UI grouping/icon 매핑용이지 DB에는 저장하지 않음.
 */

export type LocationCategory = "gym-seoul" | "gym-suburb" | "outdoor" | "home";
export type TargetCategory = "grade" | "condition" | "technique" | "casual";

export type LocationPreset = {
  label: string;
  category: LocationCategory;
};

export type TargetPreset = {
  label: string;
  category: TargetCategory;
};

export const LOCATION_PRESETS: LocationPreset[] = [
  // 서울 주요 짐
  { label: "더 클라임 강남", category: "gym-seoul" },
  { label: "더 클라임 사당", category: "gym-seoul" },
  { label: "더 클라임 홍대", category: "gym-seoul" },
  { label: "더 클라임 양재", category: "gym-seoul" },
  { label: "더 클라임 신촌", category: "gym-seoul" },
  { label: "클라이밍파크 강남", category: "gym-seoul" },
  { label: "클라이밍파크 종로", category: "gym-seoul" },
  { label: "비레이클라이밍", category: "gym-seoul" },
  { label: "락트리", category: "gym-seoul" },
  { label: "피커스 클라이밍", category: "gym-seoul" },
  // 수도권/지방 짐
  { label: "더 클라임 분당", category: "gym-suburb" },
  { label: "더 클라임 일산", category: "gym-suburb" },
  { label: "클라이밍파크 판교", category: "gym-suburb" },
  { label: "버티고 클라이밍", category: "gym-suburb" },
  { label: "클라임존", category: "gym-suburb" },
  // 야외 암장
  { label: "북한산 인수봉", category: "outdoor" },
  { label: "북한산 백운대", category: "outdoor" },
  { label: "도봉산 선인봉", category: "outdoor" },
  { label: "관악산", category: "outdoor" },
  { label: "설악산 울산바위", category: "outdoor" },
  // 집/홈월
  { label: "홈월", category: "home" },
  { label: "행보드 (집)", category: "home" },
];

export const TARGET_PRESETS: TargetPreset[] = [
  // 그레이드 프로젝트
  { label: "V3 온사이트", category: "grade" },
  { label: "V4 온사이트", category: "grade" },
  { label: "V5 프로젝트", category: "grade" },
  { label: "V6 프로젝트", category: "grade" },
  { label: "V7 프로젝트", category: "grade" },
  { label: "5.10 리드", category: "grade" },
  { label: "5.11 리드", category: "grade" },
  { label: "5.12 프로젝트", category: "grade" },
  // 컨디션/볼륨
  { label: "지구력 볼륨", category: "condition" },
  { label: "파워 엔듀런스", category: "condition" },
  { label: "회복 세션", category: "condition" },
  { label: "워밍업", category: "condition" },
  // 기술/홀드 타입
  { label: "하프 크림프", category: "technique" },
  { label: "오픈 크림프", category: "technique" },
  { label: "슬로퍼", category: "technique" },
  { label: "핀치", category: "technique" },
  { label: "포켓", category: "technique" },
  { label: "다이노/런지", category: "technique" },
  { label: "힐훅·토훅", category: "technique" },
  { label: "슬랩", category: "technique" },
  { label: "오버행", category: "technique" },
  // 캐주얼
  { label: "친구와 가볍게", category: "casual" },
  { label: "재미 위주", category: "casual" },
];

export const LOCATION_CATEGORY_LABEL: Record<LocationCategory, string> = {
  "gym-seoul": "서울 짐",
  "gym-suburb": "수도권·지방",
  outdoor: "야외",
  home: "홈/행보드",
};

export const TARGET_CATEGORY_LABEL: Record<TargetCategory, string> = {
  grade: "그레이드",
  condition: "컨디션·볼륨",
  technique: "기술·홀드",
  casual: "캐주얼",
};
