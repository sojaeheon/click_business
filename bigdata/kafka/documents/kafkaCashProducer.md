```md
# Cash Event Producer 작업 정리 (`company.cash.changed`)

## 1. 목표
백엔드에서 회사 현금 변화 이벤트를 Kafka로 발행한다.

- `event_type`: `company.cash.changed`
- `topic`: `company.events`
- `partition_key`: 보통 `company_id` 문자열
- `aggregate_id`: 보통 `company_id` 문자열

---

## 2. 이벤트 스펙

### 2.1 Envelope
```json
{
  "event_id": "uuid",
  "event_type": "company.cash.changed",
  "event_version": 1,
  "occurred_at": "2026-03-17T10:05:00+09:00",
  "producer": "company-service",
  "partition_key": "1001",
  "aggregate_id": "1001",
  "payload": {}
}
```

### 2.2 Payload
```json
{
  "company_id": 1001,
  "cash": 1200000,
  "changed_amount": -300000,
  "reason": "MARKET_BUY",
  "reference_id": "order-20260317-0001",
  "changed_at": "2026-03-17T10:05:00+09:00"
}
```

---

## 3. 반영한 코드 구조

### 3.1 공통 발행 계층 (`global/kafka`)
- `EventEnvelope`  
  - 공통 메타 + payload 구조
- `EventPublisher` / `KafkaEventPublisher`  
  - 검증 → 토픽/키 결정 → envelope 생성 → Kafka 전송
- `TopicResolver`  
  - `company.cash.changed -> company.events` 매핑 필요
- `EventSchemaValidator`  
  - `company.cash.changed` 필수 필드 검증 필요

### 3.2 Cash 전용 발행기
- `CompanyCashEventPublisher` (interface)
- `CompanyCashEventPublisherImpl` (implementation)

역할:
- payload 조립
- partition_key/aggregate_id 결정
- 공통 `EventPublisher`로 위임 발행

---

## 4. 발행 흐름

1. 도메인 서비스에서 현금 변경 발생
2. `CompanyCashEventPublisher.publishCashChanged(...)` 호출
3. payload 생성
4. `EventPublisher.publish(...)` 호출
5. `KafkaEventPublisher`가
   - validator 체크
   - topic resolve (`company.events`)
   - partition key 설정
   - envelope 생성
   - Kafka 전송

---

## 5. 주요 이슈 및 해결

### 5.1 시그니처 불일치
- `EventEnvelope.create(...)` 인자 수 변경 시
  `KafkaEventPublisher` 호출부도 함께 수정 필요

### 5.2 `MessageKeyResolver` 메서드 불일치
- 테스트/구현에서 `resolve()`를 호출했는데
  실제 구현은 `fromCompanyId()` / `normalize()`만 있을 수 있음
- 테스트 코드와 구현 코드의 메서드명 일치 필요

### 5.3 테스트 컨테이너 환경 이슈
- `jdbc:tc:postgresql` (Testcontainers) 사용 시
  Docker-in-Docker 환경에서 DB 초기화 실패 가능
- 수동 발행 검증은
  - 테스트를 단순화(`assertDoesNotThrow`)
  - Kafka 콘솔 컨슈머로 실제 적재 확인
  방식이 안정적

### 5.4 Git Bash 도커 경로 변환 이슈
- `-w /workspace`가 `C:/Program Files/Git/workspace`로 변환되는 문제 발생
- `MSYS_NO_PATHCONV=1`로 실행 필요

---

## 6. 수동 검증 방법

### 6.1 토픽 확인
```bash
docker exec -it kafka kafka-topics --bootstrap-server kafka:9092 --list
```

### 6.2 컨슈머로 확인
```bash
docker exec -it kafka kafka-console-consumer \
  --bootstrap-server kafka:9092 \
  --topic company.events \
  --from-beginning \
  --property print.key=true \
  --property key.separator=" | "
```

### 6.3 테스트 실행 (Docker)
```bash
MSYS_NO_PATHCONV=1 docker run --rm -it \
  --network ecosim-network \
  -v /c/Users/SSAFY/Desktop/project/S14P21B109/backend:/workspace \
  -w /workspace \
  -e KAFKA_BOOTSTRAP_SERVERS=kafka:9092 \
  gradle:9.4.0-jdk25 \
  ./gradlew test --tests '*CompanyCashProducerTestRunner'
```

---

## 7. 현재 권장 운영 방식

- 자동 테스트:
  - producer 호출 성공 여부 위주 검증 (`assertDoesNotThrow`)
- 실제 적재 검증:
  - kafka-console-consumer로 수동 확인
- 백엔드 부팅 시 자동 발행이 필요하면:
  - `src/main`에 `ApplicationRunner` 추가 + `@Profile(local/dev)` 제한

---

## 8. 체크리스트

- [ ] `TopicResolver`에 `company.cash.changed` 매핑 존재
- [ ] `EventSchemaValidator`에 cash 이벤트 필수 필드 검증 존재
- [ ] `CompanyCashEventPublisherImpl`에서 payload 필드명 스펙과 일치
- [ ] `company.events` 토픽 생성됨
- [ ] 컨슈머에서 메시지 실제 수신 확인됨
```