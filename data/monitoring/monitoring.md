```md
# Kafka 모니터링 진행 정리

## 1) 목적
- `warehouse.events`, `market.events`, `company.events` 토픽의 발행/적재 상태를 한눈에 확인
- Producer 동작 여부와 Kafka 적재 흐름을 시각화

---

## 2) 구성한 모니터링 스택
- `kafka-exporter` (Kafka 메트릭 수집)
- `prometheus` (메트릭 수집/쿼리)
- `grafana` (대시보드 시각화)

### 확인 포인트
- `http://localhost:9308/metrics` (exporter)
- `http://localhost:9090/targets` (prometheus target 상태)
- `http://localhost:3001` (grafana)

---

## 3) Grafana 기본 설정
1. Grafana 접속 (`admin / admin`)
2. Data Source 추가
   - Type: Prometheus
   - URL: `http://prometheus:9090`
3. 대시보드 생성 후 PromQL 패널 추가

---

## 4) Producer 대시보드 구성
대상 토픽:
- `warehouse.events`
- `market.events`
- `company.events`

### 패널 쿼리

#### (A) 토픽별 발행량 (msg/s)
```promql
sum(rate(kafka_topic_partition_current_offset{topic="warehouse.events"}[1m]))
```

```promql
sum(rate(kafka_topic_partition_current_offset{topic="market.events"}[1m]))
```

```promql
sum(rate(kafka_topic_partition_current_offset{topic="company.events"}[1m]))
```

#### (B) 토픽별 발행량 비교
```promql
sum by (topic) (rate(kafka_topic_partition_current_offset{topic=~"warehouse.events|market.events|company.events"}[1m]))
```

#### (C) 토픽별 누적 오프셋
```promql
sum(kafka_topic_partition_current_offset{topic="warehouse.events"})
```

```promql
sum(kafka_topic_partition_current_offset{topic="market.events"})
```

```promql
sum(kafka_topic_partition_current_offset{topic="company.events"})
```

#### (D) 토픽별 누적 오프셋 비교
```promql
sum by (topic) (kafka_topic_partition_current_offset{topic=~"warehouse.events|market.events|company.events"})
```

---

## 5) 패널 제목(권장)
1. `Warehouse 이벤트 발행량`
2. `Market 이벤트 발행량`
3. `Company 이벤트 발행량`
4. `토픽별 발행량 비교`
5. `Warehouse 누적 오프셋`
6. `Market 누적 오프셋`
7. `Company 누적 오프셋`
8. `토픽별 누적 오프셋 비교`

---

## 6) 동작 검증 방법
1. 백엔드에서 이벤트 발행
2. Kafka 콘솔 컨슈머로 적재 확인
```bash
docker exec -it kafka kafka-console-consumer \
  --bootstrap-server kafka:9092 \
  --topic company.events \
  --from-beginning \
  --property print.key=true
```
3. Grafana 패널에서 발행량/오프셋 변화 확인

---

## 7) 이슈 및 주의사항
- Git Bash + Docker 경로 변환 이슈가 있어 `MSYS_NO_PATHCONV=1` 필요했던 케이스 존재
- `src/test` 수동 테스트는 백엔드 컨테이너 부팅 시 자동 실행되지 않음
- 수동 테스트에서 내부 consumer assert는 타이밍 이슈가 생길 수 있어
  - 자동 테스트: publish 호출 성공 검증
  - 실제 적재: 콘솔 consumer 확인
  방식으로 분리하는 것이 안정적

---

## 8) 다음 권장 작업
- Consumer Lag 대시보드 추가 (`kafka_consumergroup_lag`)
- Lag/유입량 기반 알람 룰 추가
  - `company.events` 유입량 0 지속
  - `company.events` lag 임계치 초과
```