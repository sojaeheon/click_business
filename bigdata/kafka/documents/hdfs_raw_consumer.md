### 작업 요약 (HDFS Raw 이벤트 Consumer)

1. 목적
- Kafka 이벤트(`warehouse.events`, `company.events`, `market.order.events`, `market.trade.events`)를
- HDFS에 **Raw 레이어**로 적재하도록 구성

2. 구현 파일
- `bigdata/kafka/consumers/hdfs_raw_sink_consumer.py`

3. 핵심 동작
- Kafka 구독 후 메시지 poll
- `(topic, event_type)` 단위 버퍼링
- 조건 충족 시 HDFS에 JSONL 파일로 flush
- HDFS write 성공 후 Kafka offset 수동 commit
- 종료 시(final flush) 잔여 버퍼 저장

4. 저장 스키마 방향
- Raw는 일관성 있게 `event_raw`(문자열 원문) 중심 저장
- 함께 저장하는 메타:
  - `kafka_topic`, `kafka_partition`, `kafka_offset`
  - `kafka_timestamp`, `kafka_key`
  - `ingested_at`, `event_type`

5. HDFS 경로 전략
- 시간/토픽/이벤트 타입 파티셔닝
- 예:
  - `/raw/kafka/topic=company.events/event_type=company.cash.changed/dt=YYYY-MM-DD/hour=HH/part-...jsonl`

6. 환경변수 분리
- `.env`로 외부화:
  - `KAFKA_BOOTSTRAP_SERVERS`
  - `KAFKA_TOPICS`
  - `KAFKA_GROUP_ID`
  - `KAFKA_AUTO_OFFSET_RESET`
  - `HDFS_URL`, `HDFS_USER`, `HDFS_BASE_PATH`
  - `BATCH_SIZE`, `FLUSH_INTERVAL_SEC`

7. 실행/운영 관련 정리
- `env_file`는 compose 서비스 내부에 선언
- `COPY ../../data/.env` 같은 Dockerfile 경로는 제거(컨텍스트 밖 접근 불가)
- compose로 env 주입하는 방식으로 통일

8. 트러블슈팅 포인트
- HDFS 경로가 안 생기면:
  - consumer 실행 로그(`start`, `wrote`, `offset committed`) 확인
  - Kafka에 “consumer 시작 이후” 새 메시지 유입 확인
  - `auto_offset_reset=latest`면 과거 메시지는 안 읽음
- 컨테이너 안에서는 `docker` 명령 못 쓰므로
  - 컨테이너 내부: `hdfs dfs -ls ...`
  - 호스트: `docker exec ... hdfs dfs -ls ...`

9. 확인 방법
- consumer 로그: `docker compose logs -f hdfs-raw-sink-consumer`
- HDFS UI: `http://localhost:9870` -> Browse file system
- CLI: `hdfs dfs -ls /raw/kafka/...`, `hdfs dfs -cat ... | head`

필요하면 이 내용을 바로 `monitoring.md`처럼 `raw_consumer.md` 문서 템플릿으로 만들어서 붙여드릴게요.