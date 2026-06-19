/// <reference path="../pb_data/types.d.ts" />

// Breakteau initial schema (PRD §3 반영).
// 모든 컬렉션에 client_id UNIQUE 인덱스 (ADR-4 오프라인 큐 멱등 재전송).
// 자식 컬렉션 4종은 sessions에 cascade-delete relation.
//
// PocketBase v0.22.x Dao API 사용. v0.23+ 마이그레이션 시 syntax 변경 필요.
//
// Rule 정책 (ADR-5): 인증된 단일 사용자만 read/write.
// `@request.auth.id != ''` 는 admin/auth user 모두 통과 (admin은 별도 super-user).

migrate(
  (db) => {
    const dao = new Dao(db);

    // ── auth 유저 컬렉션의 인증 토큰을 검증하는 데 사용할 rule 패턴 ──
    // 단일 사용자이므로 본인이 인증되어 있으면 모든 row CRUD 가능.
    const ruleAuthenticated = "@request.auth.id != ''";

    // ─────────────────────────────────────────────────────
    // 1) sessions
    // ─────────────────────────────────────────────────────
    const sessions = new Collection({
      name: "sessions",
      type: "base",
      listRule: ruleAuthenticated,
      viewRule: ruleAuthenticated,
      createRule: ruleAuthenticated,
      updateRule: ruleAuthenticated,
      deleteRule: ruleAuthenticated,
      schema: [
        {
          name: "client_id",
          type: "text",
          required: true,
          options: { min: 1, max: 64 },
        },
        { name: "date", type: "date", required: true, options: {} },
        { name: "location", type: "text", options: { max: 120 } },
        { name: "total_time_mins", type: "number", options: { min: 0, max: 1440, noDecimal: true } },
        { name: "target", type: "text", options: { max: 200 } },
        { name: "notes", type: "text", options: { max: 2000 } },
        { name: "shoulder_pain_start", type: "number", options: { min: 0, max: 3, noDecimal: true } },
        { name: "finger_pain_start", type: "number", options: { min: 0, max: 3, noDecimal: true } },
        { name: "shoulder_pain_end", type: "number", options: { min: 0, max: 3, noDecimal: true } },
        { name: "finger_pain_end", type: "number", options: { min: 0, max: 3, noDecimal: true } },
      ],
      indexes: [
        "CREATE UNIQUE INDEX `idx_sessions_client_id` ON `sessions` (`client_id`)",
        "CREATE INDEX `idx_sessions_date` ON `sessions` (`date`)",
      ],
    });
    dao.saveCollection(sessions);

    // 자식 컬렉션에서 참조할 sessions.id 확보
    const sessionsCol = dao.findCollectionByNameOrId("sessions");
    const sessionRelation = {
      name: "session_id",
      type: "relation",
      required: true,
      options: {
        collectionId: sessionsCol.id,
        cascadeDelete: true,
        minSelect: 1,
        maxSelect: 1,
      },
    };

    // ─────────────────────────────────────────────────────
    // 2) hangboard_logs
    // ─────────────────────────────────────────────────────
    const hangboard = new Collection({
      name: "hangboard_logs",
      type: "base",
      listRule: ruleAuthenticated,
      viewRule: ruleAuthenticated,
      createRule: ruleAuthenticated,
      updateRule: ruleAuthenticated,
      deleteRule: ruleAuthenticated,
      schema: [
        {
          name: "client_id",
          type: "text",
          required: true,
          options: { min: 1, max: 64 },
        },
        sessionRelation,
        { name: "hold_size_mm", type: "number", options: { min: 1, max: 100, noDecimal: true } },
        {
          name: "grip_type",
          type: "select",
          required: true,
          options: {
            maxSelect: 1,
            values: ["half_crimp", "open_hand"],
          },
        },
        { name: "weight_offset_kg", type: "number", options: { min: -100, max: 100 } },
        { name: "success_sets", type: "number", required: true, options: { min: 0, max: 50, noDecimal: true } },
        { name: "total_sets", type: "number", required: true, options: { min: 0, max: 50, noDecimal: true } },
        { name: "target_hang_seconds", type: "number", options: { min: 1, max: 600, noDecimal: true } },
        { name: "actual_hang_seconds", type: "number", options: { min: 0, max: 600, noDecimal: true } },
        { name: "rpe", type: "number", options: { min: 1, max: 10, noDecimal: true } },
      ],
      indexes: [
        "CREATE UNIQUE INDEX `idx_hangboard_client_id` ON `hangboard_logs` (`client_id`)",
        "CREATE INDEX `idx_hangboard_session_id` ON `hangboard_logs` (`session_id`)",
      ],
    });
    dao.saveCollection(hangboard);

    // ─────────────────────────────────────────────────────
    // 3) climbing_logs
    // ─────────────────────────────────────────────────────
    const climbing = new Collection({
      name: "climbing_logs",
      type: "base",
      listRule: ruleAuthenticated,
      viewRule: ruleAuthenticated,
      createRule: ruleAuthenticated,
      updateRule: ruleAuthenticated,
      deleteRule: ruleAuthenticated,
      schema: [
        {
          name: "client_id",
          type: "text",
          required: true,
          options: { min: 1, max: 64 },
        },
        sessionRelation,
        {
          name: "type",
          type: "select",
          required: true,
          options: {
            maxSelect: 1,
            values: ["Lead", "Bouldering"],
          },
        },
        { name: "grade", type: "text", required: true, options: { max: 20 } },
        // project_name: PRD §3은 nullable이지만 PocketBase text는 미설정 시 빈 문자열을 반환.
        // → 클라이언트는 `project_name !== ""`로 "프로젝트로 추적 중" 판별.
        { name: "project_name", type: "text", options: { max: 100 } },
        { name: "attempts", type: "number", required: true, options: { min: 0, max: 100, noDecimal: true } },
        // is_send: PRD §3은 Lead일 때 "null"을 명시하지만 PocketBase bool은 false/true만 표현 가능.
        // → 클라이언트는 `type === "Lead"`일 때 is_send를 무시한다. (S09/S10에서 처리)
        { name: "is_send", type: "bool", options: {} },
        { name: "notes", type: "text", options: { max: 2000 } },
        { name: "rpe", type: "number", options: { min: 1, max: 10, noDecimal: true } },
      ],
      indexes: [
        "CREATE UNIQUE INDEX `idx_climbing_client_id` ON `climbing_logs` (`client_id`)",
        "CREATE INDEX `idx_climbing_session_id` ON `climbing_logs` (`session_id`)",
        "CREATE INDEX `idx_climbing_project` ON `climbing_logs` (`project_name`)",
      ],
    });
    dao.saveCollection(climbing);

    // ─────────────────────────────────────────────────────
    // 4) strength_logs
    // ─────────────────────────────────────────────────────
    const strength = new Collection({
      name: "strength_logs",
      type: "base",
      listRule: ruleAuthenticated,
      viewRule: ruleAuthenticated,
      createRule: ruleAuthenticated,
      updateRule: ruleAuthenticated,
      deleteRule: ruleAuthenticated,
      schema: [
        {
          name: "client_id",
          type: "text",
          required: true,
          options: { min: 1, max: 64 },
        },
        sessionRelation,
        { name: "exercise_name", type: "text", required: true, options: { max: 120 } },
        { name: "added_weight_kg", type: "number", options: { min: -100, max: 300 } },
        { name: "reps", type: "number", required: true, options: { min: 0, max: 100, noDecimal: true } },
        { name: "sets", type: "number", required: true, options: { min: 0, max: 50, noDecimal: true } },
        { name: "rpe", type: "number", options: { min: 1, max: 10, noDecimal: true } },
      ],
      indexes: [
        "CREATE UNIQUE INDEX `idx_strength_client_id` ON `strength_logs` (`client_id`)",
        "CREATE INDEX `idx_strength_session_id` ON `strength_logs` (`session_id`)",
      ],
    });
    dao.saveCollection(strength);

    // ─────────────────────────────────────────────────────
    // 5) campus_logs
    // ─────────────────────────────────────────────────────
    const campus = new Collection({
      name: "campus_logs",
      type: "base",
      listRule: ruleAuthenticated,
      viewRule: ruleAuthenticated,
      createRule: ruleAuthenticated,
      updateRule: ruleAuthenticated,
      deleteRule: ruleAuthenticated,
      schema: [
        {
          name: "client_id",
          type: "text",
          required: true,
          options: { min: 1, max: 64 },
        },
        sessionRelation,
        {
          name: "exercise_type",
          type: "select",
          required: true,
          options: {
            maxSelect: 1,
            values: ["ladder", "touch", "double_dyno"],
          },
        },
        {
          name: "rung_size",
          type: "select",
          required: true,
          options: {
            maxSelect: 1,
            values: ["large", "medium", "small"],
          },
        },
        { name: "movements", type: "text", options: { max: 60 } },
        { name: "success_sets", type: "number", required: true, options: { min: 0, max: 50, noDecimal: true } },
        { name: "total_sets", type: "number", required: true, options: { min: 0, max: 50, noDecimal: true } },
      ],
      indexes: [
        "CREATE UNIQUE INDEX `idx_campus_client_id` ON `campus_logs` (`client_id`)",
        "CREATE INDEX `idx_campus_session_id` ON `campus_logs` (`session_id`)",
      ],
    });
    dao.saveCollection(campus);
  },

  // down: 자식 → 부모 순서로 삭제 (relation cascade가 있어 부모만 삭제해도 OK이지만, 명시적으로)
  (db) => {
    const dao = new Dao(db);
    const names = [
      "campus_logs",
      "strength_logs",
      "climbing_logs",
      "hangboard_logs",
      "sessions",
    ];
    for (const name of names) {
      const c = dao.findCollectionByNameOrId(name);
      if (c) dao.deleteCollection(c);
    }
  },
);
