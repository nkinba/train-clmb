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

---

### S18-C — 재생 + 라이브러리 ✅ (2026-06-19, commit 430f978)

#### 변경 파일
- `web/src/lib/media.ts` — `useFileToken()` (`pb.files.getToken()` 4분 stale/refetch), `mediaFileUrl(rec, token)` (PB SDK `pb.files.getUrl`로 `?token=...` 부착), `useAllMedia()` (라이브러리), `useSessionMedia`가 `mediaKeys.bySession` helper 일관 사용.
- `web/src/components/media-lightbox.tsx` (신규) — backdrop + 영상/이미지 + window.confirm 삭제 + ESC/외부 클릭 닫기 + body scroll lock + 메모 footer.
- `web/src/components/media-grid.tsx` (신규) — 3열 그리드, 영상은 `<video preload="metadata" muted playsInline>` 첫 프레임 + Play 오버레이, 이미지는 `<img loading="lazy">`. 클릭 → lightbox.
- `web/src/app/(protected)/logs/detail/page.tsx` — `useSessionMedia` + `MediaGrid` 섹션 (세션 삭제 버튼 위에).
- `web/src/app/(protected)/library/page.tsx` (신규) — `useAllMedia` + 일자별 그룹 + 빈 상태 hint.
- `web/src/components/bottom-nav.tsx` — 4탭 → 5탭 (Images, "미디어", `/library`), `grid-cols-4` → `grid-cols-5`, label에 whitespace-nowrap.
- `web/scripts/smoke.mjs` — `a05b-library` 라우트 추가.
- `docs/STORIES.md` — S18 ✅ (A/B/C 모두), 진행 순서 권장 갱신.
- `docs/review/phase-4.md` — S18-C self-review.

#### 주요 의사결정 / 트레이드오프
1. **PB file token via `?token=` 쿼리**: PB file은 viewRule auth라 헤더 인증이 불가능한 `<img>`/`<video src>`에 토큰을 URL 쿼리로 부착. PB SDK가 `pb.files.getUrl(rec, file, { token })`로 지원.
2. **토큰 갱신 주기 4분**: PB 기본 file-token TTL 약 5분 (auth-token과 별개의 짧은 TTL). 4분 `refetchInterval`로 캐시 갱신. 단 mid-stream <video> range request의 token은 갱신 안 됨 — follow-up.
3. **썸네일 없음 (원본 그대로)**: PB 마이그레이션의 file 필드에 `thumbs` 옵션 미설정. v1.0 1인 사용 가정에서 그리드 셀당 작은 이미지/영상 첫 프레임 다운로드는 허용. 누적 50개+ 시 thumb 도입 follow-up.
4. **BottomNav 5탭**: 폼 분석이 PRD의 궁극적 가치 → 미디어를 자주 접근하는 1차 탭으로 승격. 390px 뷰포트에서 5칸 cell당 78px + 56dp 터치 타겟 OK.
5. **삭제 `window.confirm`**: /logs/detail의 세션/하위 row 삭제 패턴과 일관. self-review에서 2-step 제안했다가 통일이 더 안전하다고 결정.
6. **video preload="metadata" + muted + playsInline**: 모바일 자동 metadata 받기 + iOS Safari 자동재생 호환.
7. **autoPlay**: 사용자 lightbox 진입 클릭 직후라 iOS Safari가 user-gesture로 인정 → 무음 없이도 재생 허용.

#### 검증
- `pnpm build` 17/17 (신규 /library).
- `pnpm smoke` 모든 단계 통과 (a05b-library 추가).
- 인터랙티브 (puppeteer ad-hoc):
  - 세션 + 미디어 2건 시드 → /logs/detail에 "미디어 · 2건" + 그리드 셀 2개 노출.
  - 그리드 첫 셀 클릭 → lightbox 열림 + ESC 닫힘.
  - /library 진입 → 일자 그룹 1개 + 그리드 셀 2개.

#### 다음 Story에 영향
- **삭제 mutation 통합**: /sessions/active timeline에서도 미디어 row tap → lightbox + 삭제 가능 (현재는 라우트 null이라 클릭 불가). 통합 시 timeline UX 일관 ↑.
- **검색 + 페이지네이션**: /library에서 미디어 수가 50개+ 누적 시 검색 input + 페이지네이션 필요. 도메인상 1~2년 후 follow-up.
- **모바일 디바이스 실측**: 실제 iPhone에서 카메라 캡처 + GCS upload + 재생 흐름 검증 필요 — Wake Lock / camera capture는 모바일 OS 권한 흐름 미반영.

#### 미해결 follow-up
- **V2 토큰 mid-stream**: 5분+ 영상 재생 시 chunk 401. PB token TTL 늘리거나 video element가 새 토큰으로 재구성하는 패턴.
- **V3 영상/이미지 thumb**: PB 마이그레이션에 thumbs 옵션 추가 + grid에서 thumb URL 사용. 누적 시 도입.
- **미디어 검색** (제목/메모 텍스트).
- **오프라인 큐 통합** (S18-B에서 follow-up으로 명시했고 여전히 valid).
- **HEIC → JPEG transcoding** (브라우저 native 지원 미흡).
- 실제 디바이스 카메라 캡처 검증.

---

### S25 — timeline 미디어 row UX 보강 ✅ (2026-06-20, commit b49e925)

#### 변경 파일
- `web/src/app/(protected)/sessions/active/page.tsx` — `lightboxMedia` state + `useFileToken` + `MediaLightbox` 마운트. `Timeline` / `TimelineRow`에 `fileToken` / `onMediaClick` prop 추가. `isMedia` 분기로 button vs Link 결정. `MediaThumb` 신규 inline 컴포넌트 (36×36, video는 첫 프레임 + 작은 Video 오버레이, img는 lazy).

#### 주요 의사결정 / 트레이드오프
1. **클릭 시 router navigation 대신 modal**: 미디어 진입에 페이지 전환 부담 없음. /sessions/active에 머무르면서 lightbox로 재생 후 닫기 → 다음 운동 추가 자연스러움.
2. **MediaLightbox 컴포넌트 재사용**: /logs/detail와 동일 — 새 컴포넌트 만들지 않음 (YAGNI).
3. **fileToken을 page-level에서 한 번 호출 후 prop drilling**: TimelineRow 마다 useFileToken 호출하지 않고 위에서 받음. 같은 queryKey라 cache 공유라 차이는 작지만 hook 호출 횟수 ↓ + 명시적 데이터 흐름.
4. **운동 row 편집/삭제는 본 Story 외**: PRD 일관 — timeline에서는 진입만, 편집은 모듈 페이지에서. 별도 Story로 분리 시 필요할 때 작업.
5. **MediaThumb 36×36**: 다른 KIND_ICON과 같은 크기. 시각적 정렬 일관.

#### 검증
- `pnpm build` 17/17.
- `pnpm smoke` 모든 단계 통과 (회귀 없음).
- 인터랙티브 (puppeteer ad-hoc): 등반 + 미디어 row 2건 시드 → /sessions/active에서 row 2개, 미디어 row가 `<button aria-label*="보기">` + 내부에 `<img>` 썸네일, 등반 row는 `<a href="/sessions/active/climbing/">` Link 유지. 미디어 클릭 → MediaLightbox 열림 → ESC 닫힘.

#### 다음 Story에 영향
- /logs/detail의 미디어 그리드와 /sessions/active timeline에서 동일 lightbox UX — 사용자 mental model 일관.
- 운동 row 편집/삭제 신규 Story 시 본 timeline에 swipe-to-delete 또는 long-press menu 추가 가능 (현재 button/Link 구조에 manipulation 추가).

#### 미해결 follow-up
- 운동 row 편집/삭제 (별도 Story).
- timeline에서 미디어 row의 thumbnail이 실제 영상 첫 프레임 받는 부담 — S18-C V3 follow-up과 동일 (썸네일 컬렉션).
- 더 많은 미디어 row 누적 시 timeline 길이 — 일자/시간대 그룹 옵션.
