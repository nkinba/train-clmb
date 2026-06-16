# PRD.md (제품 요구사항 정의서)

## 1. 제품 개요 (Overview)

* **제품명:** 🧗‍♂️ 개인 클라이밍 트레이닝 트래커 (가칭: Climb-Forge)
* **목표:** '리드 5.12, 볼더링 V7 달성'을 위한 1인 맞춤형 훈련 데이터 기록 및 퍼포먼스 추적.
* **핵심 가치:** * 감에 의존하는 훈련 탈피 (정확한 세트 및 휴식 시간 통제)
* 손가락 및 어깨 부상 방지를 위한 폼(Form) 중심의 데이터 기록
* 최소한의 입력으로 최대의 훈련 지표 도출 (1인 개발/사용 최적화)



## 2. 핵심 기능 (MVP Features)

### 2.1. 세션 관리 (Session Logger)

* 훈련 날짜, 장소(암장), 총 훈련 시간 기록.
* 세션의 메인 타깃 설정 (예: 프로젝트 볼더링, 리드 지구력, 보강 운동 등).

### 2.2. 행보드 모듈 (Hangboard Tracker)

* **인터벌 타이머:** 10초 매달리기 - 3분 휴식 - 5세트 자동화 타이머 내장.
* **상세 기록:**
* 그립 형태: 하프 크림프(Half Crimp), 오픈 핸드(Open Hand).
* 부하 설정: 매달린 홀드 깊이(mm 또는 기구의 특정 위치), 보조/추가 무게(kg).
* 성공 여부: 10초간 폼이 무너지지 않고 버틴 '완벽한 세트' 수 기록. (실패 시 즉각 실패 기록).



### 2.3. 등반 볼륨 모듈 (Climbing Tracker)

* **리드 (Lead):** 연속 등반 세트 수, 타깃 난이도(5.10D~5.11A), 펌핑 구간(크림프 등 약점 홀드) 텍스트 메모.
* **볼더링 (Bouldering):** V6/V7 프로젝트 문제 시도 횟수, 완등 여부, 세트 간 적정 휴식(3분 이상) 준수 여부.

### 2.4. 보조 근력 모듈 (Advanced Strength)

* **웨이트 및 보조:** 숄더 패킹(Scapular Pull-up), 중량 풀업, 바벨 운동 등의 종목, 추가 중량(kg), 세트/반복 횟수 기록.
* **캠퍼스 보드:** 래더링, 터치, 더블 다이노 등의 종목과 렁(Rung) 사이즈(Large/Medium/Small) 기록 (향후 어깨 안정화 이후 본격 사용을 위해 선제적 추가).

## 3. 데이터베이스 스키마 (PocketBase Collections)

* **`sessions`**: `id`, `date`, `location`, `total_time_mins`, `notes`
* **`hangboard_logs`**: `id`, `session_id`, `hold_size_mm`, `grip_type`, `weight_offset_kg`, `success_sets`, `total_sets`
* **`climbing_logs`**: `id`, `session_id`, `type`(Lead/Bouldering), `grade`, `attempts`, `is_send`, `notes`
* **`strength_logs`**: `id`, `session_id`, `exercise_name`, `added_weight_kg`, `reps`, `sets`
* **`campus_logs`**: `id`, `session_id`, `exercise_type`, `rung_size`, `success_sets`