# PRD.md (제품 요구사항 정의서)

## 1. 제품 개요 (Overview)

* **제품명:** 🧗‍♂️ Breakteau (= break + plateau) — 개인 클라이밍 트레이닝 트래커
* **목표:** '리드 5.12, 볼더링 V7 달성'을 위한 1인 맞춤형 훈련 데이터 기록 및 퍼포먼스 추적.
* **핵심 가치:**
  * 감에 의존하는 훈련 탈피 (정확한 세트 및 휴식 시간 통제)
  * 손가락 및 어깨 부상 방지를 위한 폼(Form) 중심의 데이터 기록
  * 최소한의 입력으로 최대의 훈련 지표 도출 (1인 개발/사용 최적화)

## 2. 핵심 기능 (MVP Features)

### 2.1. 세션 관리 (Session Logger)

* 훈련 날짜, 장소(암장), 총 훈련 시간 기록.
* 세션의 메인 타깃 설정 (예: 프로젝트 볼더링, 리드 지구력, 보강 운동 등).
* 세션 시작/종료 시 어깨/손가락 통증 0–3 스케일 기록 (부상 신호 추적).

### 2.2. 행보드 모듈 (Hangboard Tracker)

* **인터벌 타이머:** 10초 매달리기 - 3분 휴식 - 5세트 자동화 타이머 내장. (사용자 설정으로 초/세트 수 조정 가능)
* **상세 기록:**
  * 그립 형태: 하프 크림프(Half Crimp), 오픈 핸드(Open Hand).
  * 부하 설정: 매달린 홀드 깊이(mm 또는 기구의 특정 위치), 보조/추가 무게(kg).
  * 성공 여부: 10초간 폼이 무너지지 않고 버틴 '완벽한 세트' 수 기록.
  * 실패 시 실제 버틴 초(actual_hang_seconds) 기록.
  * RPE(자각 강도, 1–10) 기록 — 다음 세션 부하 조절 입력값.

### 2.3. 등반 볼륨 모듈 (Climbing Tracker)

* **리드 (Lead):** 연속 등반 세트 수, 타깃 난이도(5.10D~5.11A), 펌핑 구간(크림프 등 약점 홀드) 텍스트 메모.
* **볼더링 (Bouldering):** V6/V7 프로젝트 문제 시도 횟수, 완등 여부, 세트 간 적정 휴식(3분 이상) 준수 여부.
* **프로젝트 추적:** 동일 문제를 여러 세션에 걸쳐 시도하므로 `project_name`을 통해 시도/완등 추이 추적.

### 2.4. 보조 근력 모듈 (Advanced Strength)

* **웨이트 및 보조:** 숄더 패킹(Scapular Pull-up), 중량 풀업, 바벨 운동 등의 종목, 추가 중량(kg), 세트/반복 횟수, RPE 기록.
* **캠퍼스 보드:** 래더링, 터치, 더블 다이노 등의 종목과 렁(Rung) 사이즈(Large/Medium/Small), 동작 시퀀스(예: "1-3-5") 기록.

## 3. 데이터베이스 스키마 (PocketBase Collections)

모든 컬렉션은 PocketBase 기본 `created`, `updated` 필드를 활용한다 (세트 간 간격 분석에 사용).
또한 모든 컬렉션은 **오프라인 큐 멱등 재전송**을 위해 `client_id` (text, UNIQUE)를 가진다 — 클라이언트가 쓰기 시점에 UUID를 생성·전송하여, 망 단절로 인한 재시도 시 동일 레코드 중복 생성을 방지한다. 상세 동작은 ADR 4 참조.

* **`sessions`**: `id`, `client_id` (UNIQUE), `date`, `location`, `total_time_mins`, `notes`, `target` (텍스트), `shoulder_pain_start` (0–3), `finger_pain_start` (0–3), `shoulder_pain_end` (0–3), `finger_pain_end` (0–3)
* **`hangboard_logs`**: `id`, `client_id` (UNIQUE), `session_id`, `hold_size_mm`, `grip_type`, `weight_offset_kg`, `success_sets`, `total_sets`, `target_hang_seconds`, `actual_hang_seconds` (실패 시 실제 버틴 초; 성공 시 target과 동일), `rpe` (1–10)
* **`climbing_logs`**: `id`, `client_id` (UNIQUE), `session_id`, `type` (Lead/Bouldering), `grade`, `project_name` (nullable), `attempts`, `is_send` (nullable; Lead일 때 의미 없음 → null), `notes`, `rpe` (1–10)
* **`strength_logs`**: `id`, `client_id` (UNIQUE), `session_id`, `exercise_name`, `added_weight_kg`, `reps`, `sets`, `rpe` (1–10)
* **`campus_logs`**: `id`, `client_id` (UNIQUE), `session_id`, `exercise_type`, `rung_size`, `movements` (예: "1-3-5"), `success_sets`, `total_sets`

> Note: `client_id`는 클라이언트가 발급한 UUID. 서버 측 `id`와 별개이며, 멱등 키 역할만 한다.
> Note: `climbing_logs.type`이 Lead/Bouldering에 따라 `attempts`의 의미가 다름 (Lead = 연속 등반 세트 수, Bouldering = 시도 횟수). 향후 사용량 증가 시 별도 컬렉션으로 분리 검토.

## 4. 비기능 요구사항 (NFR)

* **오프라인 입력:** 암장 Wi-Fi/셀룰러 불안정 환경에서도 모든 입력 가능. 네트워크 복귀 시 자동 동기화 (큐 기반).
* **타이머 정확성:** 인터벌 타이머는 화면 잠금/앱 백그라운드 시에도 의도된 시점에 알림. 상세 동작은 ADR 7 참조.
* **응답성:** 입력 폼은 200ms 내 첫 응답, 마지막 값 자동 채움으로 탭 수 최소화.
* **단일 사용자:** 인증은 1인 계정 기준 (ADR 5 참조).

## 5. 성공 지표 (Success Metrics)

진척을 정량 측정하기 위한 최소 지표 셋. 모두 분석 화면에 시각화된다.

1. **그립별 최대 행보드 부하 (+kg) 월간 추이** — 하프 크림프/오픈 핸드 각각의 +kg 최대치를 월 단위로 추적. 손가락 강도 진척의 핵심.
2. **주간 등반 볼륨** — 시도 횟수 + 완등 수, 난이도 가중치 적용 (예: V6=6, V7=7).
3. **주간 행보드 세션 수 및 총 매달리기 초** — 훈련 일관성 지표.
4. **통증 빈도** — 통증 ≥ 1 회수 / 세션 수 (월간). 0.3 초과 시 deload 권고.
5. **5.12/V7 마일스톤 진척** — 프로젝트별 시도/완등 누적 (`project_name` 기반).

## 6. 사용 시나리오 (Usage Scenarios)

| 시나리오 | 컨텍스트 | UI 요구 |
|----------|----------|---------|
| (a) 행보드 인터벌 | 행보드 룸, 한 손, 폰 거치, 화면 꺼지면 안 됨 | 풀스크린 타이머, 큰 숫자, 비프/진동, Wake Lock |
| (b) 암장 프로젝트 시도 | 분필 손, 매 시도 후 빠른 입력, 3분 휴식 중 | 마지막 값 자동 채움, 큰 +/− 스테퍼, 성공/실패 2버튼 |
| (c) 사후 분석 | 집에서 양손 사용 | 분석 화면 (차트), 노트 편집, 데이터 보정 |

상세 UI 결정은 `docs/UI.md` 참조.

## 7. 분석 화면 요구사항 (Analysis View)

* 그립별 최대 +kg 라인 차트 (X: 월, Y: kg).
* 주간 등반 볼륨 막대 차트.
* 통증 빈도 히트맵 (월간 캘린더 뷰).
* 프로젝트별 시도/완등 타임라인.
* PR(최고 기록) 마커 — 차트에 점으로 표시.

## 8. v1.1 후보 — 세션 미디어 (사진/영상 첨부)

* **궁극적 목적과의 연결:** 본인 폼을 영상으로 기록 → 반복 재생하며 분석 / 향후 AI 폼 코칭 입력으로 활용. 단순 기록을 넘는 **훈련 피드백 루프**의 핵심.
* **데이터 모델 후보:**
  * `media` 컬렉션: `id`, `client_id`, `session_id`, `kind`(photo/video), `file`(PB file 필드, GCS 위임), `notes`, `created`.
  * 또는 `climbing_logs`/`hangboard_logs`에 `media[]` 다중 파일 필드 직접 추가.
* **객체 스토리지:** ADR-6 결정대로 **GCS (us-west1, Standard)** + S3 호환(Interoperability/HMAC). 백업(`breakteau-backups`)과 미디어(`breakteau-media`)는 별도 버킷 + 별도 SA로 격리.
* **UX 고려:**
  * 세션 종료 후 영상 첨부 시점 (즉시 / 나중에 라이브러리에서 첨부).
  * 본인만 보는 비공개 가정 (PB auth-gated).
  * 모바일 카메라 직접 캡처 + 업로드 (PWA file input).
  * 영상 압축/transcoding은 v1.2+ (현재는 원본 그대로 업로드).
* **트래픽 추정:** 세션당 사진 5장(~5MB) + 영상 1개(~30MB) = ~35MB 업로드. 폼 분석 반복 재생 시 월 다운로드 1–3GB 예상. GCS 동일 region(PB↔GCS) 무료, 사용자 외부 egress는 첫 1GB/월 무료 + 이후 $0.085-0.12/GB → 월 $1 미만 전망.
* **연관 Story:** STORIES.md S18.
