# Phase 4 — History

## S16 — 분석 대시보드 ✅ (Phase 2 history에 백필 — Phase 4의 첫 v1.1 Story)

상세 내역은 docs/history/phase-2.md 참조. Recharts + 5 차트 + KST timezone offset 필터.

---

## S17 — 음성 메모 입력 ❌ Cancelled (2026-06-19)

사용자 결정 — 텍스트 메모로 충분, 우선순위 낮음.

---

## S18 — 세션 미디어 (사진/영상 첨부)

### S18-A — GCS file storage 인프라 전환 ✅ (2026-06-19)

#### 변경 파일
- `docs/ADR.md` ADR-6: R2 → GCS 결정 (3차 재변경, 이력 보존).
- `docs/RUNBOOK.md` §7.3/§7.5: GCS 버킷 + SA + HMAC + lifecycle gcloud CLI 절차.
- `docs/PRD.md` §8: 미디어 객체 스토리지 R2 → GCS, egress 추정 갱신.
- `infra/prod/.env.prod.example`: R2_* → GCS_* (+ MEDIA_GCS_*).
- `infra/prod/backup/backup.sh`: rclone provider Cloudflare → GCS.
- `infra/prod/docker-compose.prod.yml`: backup 컨테이너 env GCS_*.

#### 결정 이력
- 초기 결정 GCS (백업만, SA metadata).
- 2026-06-17: GCS → R2 (미디어 적극 사용 + egress 누적 우려).
- 2026-06-19: **R2 → GCS** (R2 콘솔 작동 불가 + 1인 운용에서 비용 trivial).

#### 검증 (사용자 위임)
- `breakteau-media` 버킷 (us-west1, Standard) 생성 + SA + HMAC ✅
- PB Admin → Settings → Files → S3 storage ON + endpoint `storage.googleapis.com` + force path style ON ✅
- 테스트 이미지 PB Admin 업로드 → GCS 도착 확인 ✅

#### 미해결 follow-up
- backup SA 생성 + 백업 컨테이너 + `.env` 채우기는 v1.1 launch 시점에 RUNBOOK §7.3 따라.

---

### S18-B — 미디어 컬렉션 + 모바일 업로드 ✅ (2026-06-19, commit a7983e3)

#### 변경 파일
- `infra/pocketbase/pb_migrations/1750000003_media.js` (신규) — media 컬렉션. client_id unique + session_id cascade + kind select + file 50MB whitelist + note 500자.
- `web/src/lib/media.ts` (신규) — useSessionMedia, useUploadMedia (XHR + upload.progress + 5분 timeout + 401/error/abort/timeout 핸들러), useDeleteMedia.
- `web/src/components/media-upload-sheet.tsx` (신규) — 모바일 file picker (accept image/video, capture=environment), preview (video controls / img object-contain), 메모, progress bar role="progressbar". 클라이언트 사전 50MB 가드.
- `web/src/lib/active-logs.ts` — TimelineKind에 "media" 추가, useSessionMedia 병렬 fetch, toMediaEntry 정규화, routeOfKind는 media에서 null.
- `web/src/app/(protected)/sessions/active/page.tsx` — "+ 미디어 첨부" outlined 보조 CTA + MediaUploadSheet 통합. TimelineRow가 route null이면 div 렌더, video일 땐 Video 아이콘.
- `web/src/lib/pb.ts` — Collections.Media 추가.

#### 주요 의사결정 / 트레이드오프
1. **XHR vs SDK**: PB JS SDK는 fetch 기반이라 upload progress 미지원 → XHR 직접 구성. 토큰 헤더 `Authorization: <token>` (Bearer 아님 — PB 관례).
2. **timeout 5분**: 모바일 셀룰러에서 50MB 영상 업로드 시간 + 마진. 더 길면 사용자가 실패를 인지 못 함.
3. **사전 50MB 가드**: PB 측 거부 직전까지 가는 UX 회피 — onChange에서 즉시 차단.
4. **오프라인 큐 미통합**: S12 queuedCreate는 JSON 가정. 미디어는 multipart라 별도 큐 구조 필요. v1.1 출시 후 사용 패턴 보고 결정.
5. **mediaFileUrl 헬퍼 제거**: 본 cycle에 호출처 없음 + viewRule auth라 토큰 없는 URL은 403. S18-C에서 토큰 포함 형태로 재설계.
6. **note 500자**: 미디어 캡션은 짧게 (장문은 세션 notes 2000자에 통합).
7. **listRule 행동**: PB 관례상 미인증 list는 200 + empty (filter처럼 동작). STORIES Acceptance 문구를 PB 관례에 맞게 갱신.

#### 검증
- `pnpm build` 16/16.
- `pnpm smoke` 정상.
- 인터랙티브: 미인증 GET media (200 + empty), 세션 + 미디어 1건 시드 (kind photo + 메모) → /sessions/active 진입 → timeline에 "미디어 · 사진 · S18-B 테스트 첨부" 표시 + 시각, "+ 미디어 첨부" → 시트 열림 + 사진/영상 선택 버튼 노출 + ESC 닫기 정상.

#### 다음 Story에 영향
- **S18-C (재생 + 라이브러리)**: 토큰 포함 PB file URL 생성 헬퍼 신규 작성. `/logs/detail`에 첨부 그리드 + video controls / image lightbox. `/library` 라우트는 5번째 탭 또는 설정 진입 결정 필요.
- **오프라인 큐**: 미디어용 별도 큐 구조 (multipart + chunked or pre-signed URL upload). follow-up.
- **삭제 mutation**: useDeleteMedia는 lib에 있지만 UI 노출은 S18-C (timeline 행 swipe-to-delete 또는 long-press).

#### 미해결 follow-up
- 토큰 포함 file URL 헬퍼.
- 미디어 삭제 UI.
- 오프라인 큐.
- HEIC → JPEG transcoding (브라우저 native 지원 미흡, Safari iOS만 가능).
- 영상 thumbnail 생성 (S18-C 라이브러리 그리드 위해).
