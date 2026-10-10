# Kafka 3 Broker와 Spark 처리 용량 확장

## 변경 목적

Kafka Broker 한 대와 Spark Worker 2코어 구성은 장애 대응이 없고, 가치 계산과 뉴스 작업이 동일한 Worker 자원을 경쟁한다. Kafka는 3 Broker 복제로, Spark는 가치 계산에 2코어를 할당하는 구성으로 바꾼다.

## Kafka 변경

- Broker 3대: `kafka`, `kafka-2`, `kafka-3`
- 내부 bootstrap: `kafka:29092,kafka-2:29092,kafka-3:29092`
- 외부 포트: Broker 1은 `9092`, Broker 2는 `9093`, Broker 3은 `9094`
- Broker별 데이터 볼륨: `data/kafka_data/broker-{1,2,3}`
- 주요 토픽: 3 파티션, 복제 계수 3
- `min.insync.replicas=2`, offsets와 transaction 로그의 복제 계수 3
- 토픽 자동 생성 비활성화

Broker 하나가 중단돼도 ISR에 Broker 두 대가 남아 있으면 생산과 소비를 계속할 수 있다. ZooKeeper는 현재 한 대이므로 완전한 제어면 고가용성은 아니다. 운영 환경에서는 ZooKeeper도 3대 또는 KRaft Controller quorum으로 바꾼다.

## 기존 토픽 마이그레이션

이미 생성된 토픽은 `--create --if-not-exists`로 복제 계수가 바뀌지 않는다. Broker 3대가 실행된 뒤 아래를 실행한다.

```powershell
docker compose -f docker-compose.yaml up -d kafka kafka-2 kafka-3
docker compose -f docker-compose.yaml up -d --force-recreate kafka-init
docker exec kafka bash /usr/local/bin/reassign_topic_replicas.sh
docker exec kafka bash /usr/local/bin/reassign_offsets_replicas.sh
docker exec kafka bash /usr/local/bin/verify_topic_replication.sh
```

재할당 스크립트는 기존 데이터를 삭제하지 않는다. 기존에 1 파티션으로 생성된 토픽은 먼저 3 파티션으로 확장한 뒤 replica를 Broker 2·3으로 복사한다. `__consumer_offsets`도 3중 복제로 올린다. `verify_topic_replication.sh`를 다시 실행해 각 파티션의 `Replicas`가 `1,2,3`인지 확인한다.

## Spark 변경

- Worker 총량: 2코어에서 3코어·4GiB로 증가
- 뉴스 스트림: 1코어 유지
- 기업 가치 스트림: 1코어에서 2코어로 증가
- checkpoint: 컨테이너의 `/tmp`가 아닌 `bigdata/spark/checkpoints` 영속 경로 사용

가치 계산은 Kafka의 3 파티션을 읽을 수 있어도 Executor 1코어에서는 병렬 처리할 수 없다. 2개의 1코어 Executor를 사용하면 Kafka 수신·파싱 작업을 병렬화할 여지가 생긴다. PostgreSQL UPSERT는 여전히 Driver 트랜잭션 중심이므로, 다음 측정에서 batch 시간이 계속 길면 DB 반영 구조를 추가로 최적화해야 한다.

가치 계산의 기본 trigger는 2초다. 2코어 구성에서도 1초 trigger는 실제 batch 시간이 1.2~2.6초여서 적체가 발생했다. 먼저 2초 지연을 안정화하고, DB 반영 최적화 뒤 1초 재도입 여부를 판단한다.

## 검증 명령

```powershell
docker compose -f docker-compose.yaml config --quiet
docker compose -f docker-compose.yaml ps
docker exec kafka kafka-topics --bootstrap-server kafka:29092 --describe
docker compose -f docker-compose.yaml logs --tail 100 spark-submit-valuation
docker stats --no-stream kafka kafka-2 kafka-3 spark-worker spark-submit-valuation
```

## 완료 기준

- Broker 3대가 실행되고 주요 토픽의 복제 계수가 3이다.
- 각 토픽 파티션의 ISR에 Broker 3대가 모두 표시된다.
- 가치 계산 Spark 작업이 2코어를 할당받는다.
- checkpoint가 컨테이너 재생성 후에도 유지된다.
- Spark batch 처리 시간과 Kafka lag가 지속적으로 증가하지 않는다.

## 적용 및 관측 결과

- Broker 1·2·3이 모두 실행됐다.
- 업무 토픽 4개와 `__consumer_offsets`는 모두 복제 계수 3이며, 확인 시점의 ISR에는 Broker 1·2·3이 모두 포함됐다.
- `CompanyValuationStream`은 Executor 2개를 받아 총 2코어·2GiB를 사용했고, Worker는 총 3코어·4GiB 중 2코어·2GiB를 할당했다.
- checkpoint는 `bigdata/spark/checkpoints/company-valuation`에 생성됐다.
- 2코어 확장과 2초 trigger 뒤에도 checkpoint에 남은 batch를 처리하는 시점에 약 19초가 걸렸다. 따라서 다음 개선 대상은 Broker나 Executor 수가 아니라 `foreachBatch`의 Driver `collect()`와 PostgreSQL 반영 구조다.
