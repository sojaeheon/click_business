# EcoSim 포팅 매뉴얼

## 1. GitLab 소스 클론 이후 빌드 및 배포할 수 있도록 정리한 문서

### 1-1. 사용 JVM, 웹서버, WAS, 제품 종류/설정값/버전
- JVM: OpenJDK 25 (Temurin, `eclipse-temurin:25-jdk-alpine`)
- Backend WAS: Spring Boot 내장 서버(Tomcat), 포트 `8000`
- Frontend Web Server: Nginx (`nginx:stable-alpine`), 포트 `80`
- DBMS:
- OLTP DB: PostgreSQL 17 (`postgres:17`), 포트 `5432`
- OLAP DB: PostgreSQL 17 (`postgres:17`, analytics), 포트 `5433 -> 5432`
- Cache: Redis (`redis:alpine`), 포트 `6379`
- Message Broker: Kafka (`confluentinc/cp-kafka:7.6.0`), Zookeeper (`confluentinc/cp-zookeeper:7.6.0`)
- Data Lake: HDFS NameNode/DataNode (`bde2020/hadoop-*`)
- Streaming/Batch: Spark Master/Worker (프로젝트 Dockerfile 기반)
- Monitoring: Prometheus, Grafana
- CI/CD: Jenkins

핵심 설정 파일:
- 루트 오케스트레이션: `docker-compose.yaml` (include 기반)
- 백엔드: `backend/compose.yaml`, `backend/src/main/resources/application.yml`
- 데이터/카프카/HDFS: `data/compose.yaml`
- 스파크: `bigdata/compose.yaml`
- 인프라: `infra/compose.yaml`
- 프론트: `frontend/compose.yaml`

### 1-2. 빌드 시 사용되는 환경 변수 상세
주요 `.env` 파일:
- `backend/.env`
- `data/.env`
- `infra/.env`


핵심 변수 그룹:
1. Backend
- `SPRING_PROFILES_ACTIVE`
- `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`
- `SPRING_DATA_REDIS_HOST`
- `KAFKA_BOOTSTRAP_SERVERS`
- `JWT_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `CORS_ALLOWED_ORIGINS`

2. Data/Kafka/HDFS
- `KAFKA_BOOTSTRAP_SERVERS`, `KAFKA_TOPICS`, `KAFKA_GROUP_ID`
- `HDFS_URL`, `HDFS_USER`, `HDFS_BASE_PATH`
- `FLUSH_INTERVAL_SEC`, `BATCH_SIZE`

3. Analytics/Spark
- `ANALYTICS_DB_HOST`, `ANALYTICS_DB_PORT`, `ANALYTICS_DB_NAME`, `ANALYTICS_DB_USER`, `ANALYTICS_DB_PASSWORD`
- `OP_DB_HOST`, `OP_DB_PORT`, `OP_DB_NAME`, `OP_DB_USER`, `OP_DB_PASSWORD`
- `STREAM_TRIGGER`, `MAX_OFFSETS_PER_TRIGGER`, `UPSERT_CHUNK_SIZE`
- `VALUATION_*_CHECKPOINT`

4. Infra/Jenkins
- `JENKINS_ADMIN_ID`, `JENKINS_ADMIN_PASSWORD`
- `GITLAB_USERNAME`, `GITLAB_TOKEN`, `GITLAB_WEBHOOK_TOKEN`
- `DOCKER_HUB_ID`, `DOCKER_HUB_PASSWORD`
- `MM_WEBHOOK_URL`, `KUBECONFIG_CONTENT`

### 1-3. 배포 시 특이사항
1. 외부 Docker 네트워크 사전 생성 필수
```bash
docker network create ecosim-network
```

2. 기본 실행 명령(루트 경로)
```bash
docker compose -f docker-compose.yaml up -d --build
```

3. Kafka 외부 연동 시 `KAFKA_ADVERTISED_LISTENERS`를 실제 서버 IP/도메인으로 맞춰야 함

4. HDFS 초기 기동 시 NameNode safe mode 상태에서 쓰기 실패 가능
- 증상: `Name node is in safe mode`
- 조치:
```bash
docker exec -it namenode hdfs dfsadmin -safemode leave
```


### 1-4. DB 접속 정보 및 주요 계정/프로퍼티 정의 파일 목록
DB/계정 정보 정의 위치:
- `backend/.env`
- `data/.env`
- `env/oltp.env`
- `env/olap.env`
- `backend/src/main/resources/application.yml`

ERD/스키마 관련 파일:
- Backend 마이그레이션: `backend/src/main/resources/db/migration/*.sql`
- Analytics 스키마: `bigdata/sql/analytics_schema.sql`
- 기타 SQL: `data/create_candle_table.sql`

주의:
- 실서버 배포 전 계정/비밀번호/토큰/JWT/OAuth 키는 반드시 신규 발급값으로 교체해야 함

## 2. 프로젝트에서 사용하는 외부 서비스 정보를 정리한 문서

### 2-1. 외부 서비스 목록
1. Google OAuth
- 용도: 소셜 로그인
- 필요 정보: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

2. GitLab
- 용도: 소스 저장소, Webhook 트리거
- 필요 정보: `GITLAB_USERNAME`, `GITLAB_TOKEN`, `GITLAB_WEBHOOK_TOKEN`

3. Docker Hub
- 용도: 이미지 Push/Pull
- 필요 정보: `DOCKER_HUB_ID`, `DOCKER_HUB_PASSWORD`

4. Mattermost Webhook
- 용도: CI/CD 알림
- 필요 정보: `MM_WEBHOOK_URL`

5. Kubernetes(선택 운영)
- 용도: 배포 대상 클러스터 접근
- 필요 정보: `KUBECONFIG_CONTENT`

6. (프로젝트 내 AI/뉴스 처리)
- 용도: 데이터 처리 키
- 필요 정보: `GMS_KEY`

### 2-2. 외부 서비스 정보 관리 파일
- `infra/.env`
- `backend/.env`
- `data/.env`
- `env/oltp.env`, `env/olap.env`, `env/kafka.env`

## 3. DB 덤프 파일 최신본

현재 레포 기준 상태:
- 정식 전체 덤프(`*.dump`, `pg_dump` 결과물)는 레포에 포함되어 있지 않음
- 대신 스키마/초기 데이터는 Flyway 및 SQL 파일로 관리됨

스키마 기준 파일:
- `backend/src/main/resources/db/migration/*.sql`
- `bigdata/sql/analytics_schema.sql`

최신 덤프 생성 권장 명령(운영 반출용):
```bash
# OLTP
pg_dump -h <OLTP_DB_HOST> -p 5432 -U <USER> -d ecosim -Fc -f ecosim_oltp_latest.dump

# OLAP
pg_dump -h <OLAP_DB_HOST> -p 5433 -U <USER> -d ecosim_analytics -Fc -f ecosim_olap_latest.dump
```

권장 저장 위치:
- `exec/db-dump/` (버전/날짜 포함 파일명 관리)

## 4. 시연 시나리오

### 4-1. 시연 순서
1. 인프라 기동 확인
- 화면: Docker Desktop/CLI
- 확인: `docker compose -f docker-compose.yaml ps`

2. 프론트 접속
- 화면: `http://<서버IP>`
- 클릭: 로그인 화면 진입

3. 로그인(일반 또는 Google OAuth)
- 화면: 메인 대시보드
- 확인: 백엔드 API 응답 정상

4. 시장 주문/체결 발생
- 화면: 마켓 UI
- 클릭: 매수/매도 주문 실행
- 확인: Kafka `market.order.events`, `market.trade.events` 이벤트 발생

5. 창고/회사 이벤트 반영
- 화면: 인벤토리/회사 현황
- 클릭: 재료 이동/생산/판매
- 확인: `warehouse.events`, `company.events` 이벤트 발생

6. Spark 집계 반영 확인
- 화면: Spark 로그(`spark-submit-valuation`)
- 확인: `company_valuation`, `ranking_outbox` 갱신

7. 랭킹 화면 확인
- 화면: 랭킹 모달/랭킹 페이지
- 확인: `ranking_current` 값이 이벤트 이후 변경되었는지 확인

8. 모니터링 확인
- 화면: Grafana(`:3001`), Prometheus(`:9090`)
- 확인: Kafka/Spark/DB 지표 정상

### 4-2. 시연 체크 포인트
- 주문/체결 후 랭킹 값이 지연 없이 갱신되는지
- HDFS raw 적재가 정상인지
- 컨테이너 재시작 후에도 체크포인트/상태가 유지되는지

---

## 부록: 빠른 실행/검증 명령
```bash
# 기동
docker network create ecosim-network

docker compose -f docker-compose.yaml up -d --build

docker compose -f docker-compose.yaml run --rm external-loader

python bigdata/external_data/loader/processed_news_loader.py

# 상태
docker compose -f docker-compose.yaml ps

# 중지
docker compose -f docker-compose.yaml down
```
