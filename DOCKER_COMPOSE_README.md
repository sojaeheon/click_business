# Docker Compose Deployment Guide

이 문서는 프로젝트를 `OLTP`, `Kafka`, `OLAP` 세 개의 Compose 스택으로 분리해 운영하는 기준을 정리합니다.

## 1. 생성된 Compose 파일

- `docker-compose.oltp.yaml`
- `docker-compose.kafka.yaml`
- `docker-compose.olap.yaml`
- `env/oltp.env`
- `env/kafka.env`
- `env/olap.env`

## 2. 서비스 배치

### OLTP 서버

다음 서비스는 `docker-compose.oltp.yaml`로 실행합니다.

- `frontend`
- `backend`
- `postgres`
- `redis`
- `order-redis-consumer`
- `order-db-consumer`
- `trade-db-consumer`
- `nginx`
- `jenkins`

이 서버는 사용자 요청을 직접 처리하는 운영계입니다.

### Kafka 서버

다음 서비스는 `docker-compose.kafka.yaml`로 실행합니다.

- `zookeeper`
- `kafka`
- `kafka-init`
- `kafka-exporter`
- `prometheus`
- `grafana`

Kafka는 OLTP와 OLAP 사이의 공용 메시지 브로커 역할을 합니다.

### OLAP 서버

다음 서비스는 `docker-compose.olap.yaml`로 실행합니다.

- `namenode`
- `datanode`
- `external-loader`
- `order-hdfs-consumer`
- `trade-hdfs-consumer`
- `hdfs-raw-sink-consumer`
- `analytics-postgres`
- `spark-master`
- `spark-worker`
- `spark-market-news`
- `spark-submit-valuation`

이 서버는 적재, 분석, 집계, 배치 처리를 담당합니다.

## 3. 디렉토리 배치

각 서버에서 Compose를 실행하려면, 해당 서버에 프로젝트 디렉토리 전체가 있어야 합니다.

이유는 다음과 같습니다.

- Compose가 상대 경로로 `build context`를 참조합니다.
- Compose가 상대 경로로 `env_file`, `volumes`, `Dockerfile`을 참조합니다.
- Spark, Kafka consumer, Nginx, Jenkins 설정 파일이 모두 프로젝트 내부 경로를 사용합니다.

즉, 서버마다 필요한 Compose 파일만 복사하는 방식보다, 프로젝트 전체 디렉토리를 동일한 경로 구조로 두는 방식이 안전합니다.

예시:

```bash
/home/eunsu/S14P21B109
```

## 4. 공통 준비

세 스택은 모두 동일한 Docker network 이름 `ecosim-network`를 사용합니다.

각 서버에서 최초 1회 실행:

```bash
docker network create ecosim-network
```

이미 존재하면 에러가 나도 무시해도 됩니다.

각 스택은 전용 env 파일과 함께 실행하는 것을 권장합니다.

- OLTP: `env/oltp.env`
- Kafka: `env/kafka.env`
- OLAP: `env/olap.env`

## 5. Kafka 외부 주소 설정

`docker-compose.kafka.yaml`의 Kafka는 이제 `localhost` 고정이 아니라 환경변수 기반으로 외부 주소를 광고합니다.

사용하는 변수:

- `KAFKA_EXTERNAL_HOST`
- `KAFKA_EXTERNAL_PORT`

기본값:

- `KAFKA_EXTERNAL_HOST=localhost`
- `KAFKA_EXTERNAL_PORT=9092`

2대 서버 기준에서는 Kafka 서버의 실제 접근 주소를 넣어야 합니다.

예시:

```bash
export KAFKA_EXTERNAL_HOST=10.0.0.25
export KAFKA_EXTERNAL_PORT=9092
```

또는 `env/kafka.env` 파일을 수정해서 사용해도 됩니다.

또는 공인 DNS가 있으면:

```bash
export KAFKA_EXTERNAL_HOST=kafka.my-domain.com
export KAFKA_EXTERNAL_PORT=9092
```

주의:

- 컨테이너 내부 통신은 계속 `kafka:29092`를 사용합니다.
- 서버 밖에서 접속하는 클라이언트만 `KAFKA_EXTERNAL_HOST:KAFKA_EXTERNAL_PORT`를 사용합니다.
- Spring Boot, Spark, consumer가 서로 다른 서버에 있어도 같은 Docker network를 공유하는 것은 아닙니다. 실제 2대 서버 배포에서는 서버 간 통신이므로, 각 애플리케이션 설정에서 Kafka 서버의 실제 IP 또는 DNS를 바라보게 해야 합니다.

## 6. 2대 서버 배포 시 권장 배치

### 서버 1: OLTP

실행:

```bash
docker compose --env-file env/oltp.env -f docker-compose.oltp.yaml up -d
```

### 서버 2: Kafka + OLAP

실행 순서:

```bash
docker compose --env-file env/kafka.env -f docker-compose.kafka.yaml up -d
docker compose --env-file env/olap.env -f docker-compose.olap.yaml up -d
```

현재 구성상 Kafka 서버와 OLAP 서버를 같은 머신에 두는 것이 가장 단순합니다.

## 7. 실행 순서

권장 순서:

```bash
docker compose --env-file env/kafka.env -f docker-compose.kafka.yaml up -d
docker compose --env-file env/oltp.env -f docker-compose.oltp.yaml up -d
docker compose --env-file env/olap.env -f docker-compose.olap.yaml up -d
```

이 순서를 권장하는 이유:

- Kafka topic 초기화가 먼저 끝나야 producer/consumer가 안정적으로 붙습니다.
- OLTP는 DB/Redis 준비 후 API를 띄우는 구조입니다.
- OLAP는 Kafka, HDFS, analytics DB를 참조합니다.

## 8. 서버 간 설정에서 꼭 바꿔야 하는 값

2대 서버로 실제 분리하면, Compose만 나누는 것으로 끝나지 않고 애플리케이션 연결 주소도 서버 기준으로 바뀌어야 합니다.

대표적으로 점검할 항목:

- `env/oltp.env`
- `env/kafka.env`
- `env/olap.env`
- Spark job 환경변수
- consumer 내부의 DB/Kafka host

특히 다음 값들은 실제 서버 주소 기준으로 다시 설정해야 합니다.

- `env/oltp.env`의 `KAFKA_BOOTSTRAP_SERVERS`
- `env/kafka.env`의 `KAFKA_EXTERNAL_HOST`
- `env/olap.env`의 `DB_HOST`
- `env/olap.env`의 `OP_DB_HOST`
- `env/olap.env`의 `KAFKA_BOOTSTRAP_SERVERS`
- `env/olap.env`의 `OLAP_OP_DB_WAIT_HOST`
- `env/olap.env`의 `OLAP_KAFKA_WAIT_HOST`

## 9. 현재 Compose 파일의 의미상 주의점

`order-db-consumer`, `trade-db-consumer`는 운영 DB `postgres-db`에 쓰는 consumer입니다.

그래서 현재는 분석계가 아니라 운영계 보조 프로세스로 보고 `OLTP`에 배치했습니다.

반대로 다음 서비스는 분석계로 분리했습니다.

- HDFS 적재 consumer
- Spark 집계 job
- analytics DB
- external data loader

## 10. 자주 쓰는 명령어

전체 상태 확인:

```bash
docker compose --env-file env/oltp.env -f docker-compose.oltp.yaml ps
docker compose --env-file env/kafka.env -f docker-compose.kafka.yaml ps
docker compose --env-file env/olap.env -f docker-compose.olap.yaml ps
```

로그 확인:

```bash
docker compose --env-file env/oltp.env -f docker-compose.oltp.yaml logs -f backend
docker compose --env-file env/kafka.env -f docker-compose.kafka.yaml logs -f kafka
docker compose --env-file env/olap.env -f docker-compose.olap.yaml logs -f spark-submit-valuation
```

중지:

```bash
docker compose --env-file env/oltp.env -f docker-compose.oltp.yaml down
docker compose --env-file env/kafka.env -f docker-compose.kafka.yaml down
docker compose --env-file env/olap.env -f docker-compose.olap.yaml down
```

## 11. 다음으로 추천하는 작업

실제 2대 서버에 배포하기 전에 아래를 추가로 정리하는 것을 권장합니다.

- Kafka/DB host를 환경변수 기반으로 통일
- `localhost` 의존 제거
- `depends_on`에 기대지 않는 헬스체크 및 재시도 정책 강화
