/// <reference path="../pb_data/types.d.ts" />

// S18-B — 세션 미디어 (사진/영상) 컬렉션.
//
// 사용자가 PRD §8 폼 코칭/AI 분석용으로 본인 영상을 세션에 첨부.
// 파일은 PB file storage(GCS, ADR-6 2026-06-19)로 위임. file 필드 maxSize는
// 모바일 직접 캡처 영상(~30s) 고려해 50MB까지 허용.
//
// session_id cascade — 세션 삭제 시 첨부 미디어도 함께 삭제 (PB rule + R2 객체는 GCS lifecycle 또는 별도 cleanup).
// client_id UNIQUE — ADR-4 오프라인 큐 멱등 키.

migrate(
  (db) => {
    const dao = new Dao(db);
    const ruleAuthenticated = "@request.auth.id != ''";

    const sessionsCol = dao.findCollectionByNameOrId("sessions");

    const media = new Collection({
      name: "media",
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
        {
          name: "session_id",
          type: "relation",
          required: true,
          options: {
            collectionId: sessionsCol.id,
            cascadeDelete: true,
            minSelect: 1,
            maxSelect: 1,
          },
        },
        {
          name: "kind",
          type: "select",
          required: true,
          options: {
            maxSelect: 1,
            values: ["photo", "video"],
          },
        },
        {
          name: "file",
          type: "file",
          required: true,
          options: {
            maxSelect: 1,
            maxSize: 50 * 1024 * 1024, // 50MB
            mimeTypes: [
              "image/jpeg",
              "image/png",
              "image/webp",
              "image/heic",
              "video/mp4",
              "video/quicktime",
              "video/webm",
            ],
            // thumbs는 S18-C 라이브러리 그리드에서 필요해지면 추가.
          },
        },
        { name: "note", type: "text", options: { max: 500 } },
      ],
      indexes: [
        "CREATE UNIQUE INDEX `idx_media_client_id` ON `media` (`client_id`)",
        "CREATE INDEX `idx_media_session_id` ON `media` (`session_id`)",
      ],
    });
    dao.saveCollection(media);
  },

  (db) => {
    const dao = new Dao(db);
    try {
      const c = dao.findCollectionByNameOrId("media");
      dao.deleteCollection(c);
    } catch (_) {
      // 미존재 — 무시.
    }
  },
);
