/// <reference path="../pb_data/types.d.ts" />

// S22 — 클라이밍 짐 / 타깃 카탈로그를 데이터테이블로 관리.
//
// 두 컬렉션 모두 인증 사용자 read-only — create/update/delete는 admin (super-user)만.
// 사용자가 picker에서 항목을 추가하려면 PB Admin UI로 추가하면 픽커에 즉시 노출됨.
//
// 시드 데이터는 S20 단계의 lib/picker-presets.ts와 동일 라벨·카테고리.
// sort_order는 배열 인덱스 그대로 — 클라이언트에서 ORDER BY sort_order, name.

migrate(
  (db) => {
    const dao = new Dao(db);
    const ruleAuthenticatedRead = "@request.auth.id != ''";

    // ── gyms ─────────────────────────────────────────────
    const gyms = new Collection({
      name: "gyms",
      type: "base",
      listRule: ruleAuthenticatedRead,
      viewRule: ruleAuthenticatedRead,
      // create/update/delete는 null → admin (super-user) 전용
      createRule: null,
      updateRule: null,
      deleteRule: null,
      schema: [
        { name: "name", type: "text", required: true, options: { min: 1, max: 120 } },
        {
          name: "category",
          type: "select",
          required: true,
          options: {
            maxSelect: 1,
            values: ["gym-seoul", "gym-suburb", "outdoor", "home"],
          },
        },
        { name: "sort_order", type: "number", required: true, options: { min: 0, noDecimal: true } },
      ],
      indexes: [
        "CREATE UNIQUE INDEX `idx_gyms_name` ON `gyms` (`name`)",
        "CREATE INDEX `idx_gyms_category` ON `gyms` (`category`)",
      ],
    });
    dao.saveCollection(gyms);

    // ── targets ──────────────────────────────────────────
    const targets = new Collection({
      name: "targets",
      type: "base",
      listRule: ruleAuthenticatedRead,
      viewRule: ruleAuthenticatedRead,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      schema: [
        { name: "label", type: "text", required: true, options: { min: 1, max: 200 } },
        {
          name: "category",
          type: "select",
          required: true,
          options: {
            maxSelect: 1,
            values: ["grade", "condition", "technique", "casual"],
          },
        },
        { name: "sort_order", type: "number", required: true, options: { min: 0, noDecimal: true } },
      ],
      indexes: [
        "CREATE UNIQUE INDEX `idx_targets_label` ON `targets` (`label`)",
        "CREATE INDEX `idx_targets_category` ON `targets` (`category`)",
      ],
    });
    dao.saveCollection(targets);

    // ── 시드 데이터 ──────────────────────────────────────
    const gymSeeds = [
      // 서울 주요 짐
      { name: "더 클라임 강남", category: "gym-seoul" },
      { name: "더 클라임 사당", category: "gym-seoul" },
      { name: "더 클라임 홍대", category: "gym-seoul" },
      { name: "더 클라임 양재", category: "gym-seoul" },
      { name: "더 클라임 신촌", category: "gym-seoul" },
      { name: "클라이밍파크 강남", category: "gym-seoul" },
      { name: "클라이밍파크 종로", category: "gym-seoul" },
      { name: "비레이클라이밍", category: "gym-seoul" },
      { name: "락트리", category: "gym-seoul" },
      { name: "피커스 클라이밍", category: "gym-seoul" },
      // 수도권/지방 짐
      { name: "더 클라임 분당", category: "gym-suburb" },
      { name: "더 클라임 일산", category: "gym-suburb" },
      { name: "클라이밍파크 판교", category: "gym-suburb" },
      { name: "버티고 클라이밍", category: "gym-suburb" },
      { name: "클라임존", category: "gym-suburb" },
      // 야외 암장
      { name: "북한산 인수봉", category: "outdoor" },
      { name: "북한산 백운대", category: "outdoor" },
      { name: "도봉산 선인봉", category: "outdoor" },
      { name: "관악산", category: "outdoor" },
      { name: "설악산 울산바위", category: "outdoor" },
      // 집/홈월
      { name: "홈월", category: "home" },
      { name: "행보드 (집)", category: "home" },
    ];

    const targetSeeds = [
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

    const gymsCol = dao.findCollectionByNameOrId("gyms");
    for (let i = 0; i < gymSeeds.length; i++) {
      const r = new Record(gymsCol, { ...gymSeeds[i], sort_order: i });
      dao.saveRecord(r);
    }

    const targetsCol = dao.findCollectionByNameOrId("targets");
    for (let i = 0; i < targetSeeds.length; i++) {
      const r = new Record(targetsCol, { ...targetSeeds[i], sort_order: i });
      dao.saveRecord(r);
    }
  },

  (db) => {
    const dao = new Dao(db);
    // findCollectionByNameOrId는 not found 시 throw — 부분 적용 상태 rollback 위해 try/catch.
    for (const name of ["gyms", "targets"]) {
      try {
        const c = dao.findCollectionByNameOrId(name);
        dao.deleteCollection(c);
      } catch (_) {
        // 미존재 — 무시.
      }
    }
  },
);
