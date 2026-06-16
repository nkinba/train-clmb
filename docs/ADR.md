# ADR.md (아키텍처 결정 기록)

## ADR 1: 백엔드 및 데이터베이스 기술 선정

* **상태:** 확정
* **컨텍스트:** 1인 개발 및 사용 환경에서 유지보수 비용(시간 및 금전)을 최소화하면서도, 관계형 데이터(세션-훈련기록)를 안정적으로 저장할 API 서버가 필요함.
* **결정:** **PocketBase** 도입.
* **근거:** * Go 언어 기반의 단일 바이너리(Single Binary)로 실행되어 메모리 자원을 매우 적게 소모함.
* 내장 SQLite를 사용하여 별도의 DB 인프라(PostgreSQL 등) 세팅이 불필요함.
* 기본 제공되는 어드민 UI와 JavaScript SDK를 통해 프론트엔드 연동 속도를 극대화할 수 있음.



## ADR 2: 인프라 및 배포 환경 구성

* **상태:** 확정
* **컨텍스트:** 엔지니어로서의 인프라 경험을 위해 외부 호스팅(SaaS) 대신 직접 서버를 구축하되, 운영 비용을 0원으로 통제해야 함.
* **결정:** **GCP Compute Engine (e2-micro) + Docker Compose + Caddy**
* **근거:**
* GCP Always Free 티어인 e2-micro(1 vCPU, 1GB RAM)를 활용하여 비용 0원 달성.
* Docker Compose를 통해 로컬 맥미니/맥북 환경과 GCP 운영 환경을 100% 동일하게 구성(IaC 기초).
* Caddy 웹 서버를 앞단(Reverse Proxy)에 배치하여 Nginx 대비 적은 설정(Caddyfile)으로 Let's Encrypt 자동 SSL(HTTPS) 발급 처리.



## ADR 3: 프론트엔드 프레임워크 및 호스팅

* **상태:** 확정
* **컨텍스트:** 현업 표준 기술(Next.js, Tailwind CSS)을 사용하여 빠른 UI 컴포넌트 조립이 필요함. 단, e2-micro 서버의 1GB 메모리 환경에서 Node.js SSR 서버를 가동할 경우 OOM(Out of Memory) 발생 위험이 큼.
* **결정:** **Next.js (App Router) Static Export + Cloudflare Pages 배포**
* **근거:**
* Next.js의 파일 기반 라우팅 및 React 생태계 이점을 그대로 취함.
* `output: 'export'` 설정을 통해 순수 HTML/CSS/JS 정적 파일로 빌드하여 SSR 서버 실행에 따른 리소스 부담 제거.
* 빌드된 결과물을 이미 사이드 프로젝트에 사용 중인 Cloudflare 인프라(Pages)에 배포하여 프론트엔드 호스팅 비용 분리 및 글로벌 엣지 네트워크 활용. (데이터 통신은 PocketBase API와 직접 수행)