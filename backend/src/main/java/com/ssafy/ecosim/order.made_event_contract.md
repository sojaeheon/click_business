# Kafka Event Contract

이 문서는 Backend (Java) ↔ Data Engineering (Python) 간의 Kafka 이벤트 스트림 구조와 이벤트 스키마를 정의한다. Backend는 이벤트를 Kafka로 발행(Producer)하며, Data Engineering은 Kafka 이벤트를 소비(Consumer)하여 데이터 처리 및 적재에 활용한다.

## Event Flow
```
Client
   ↓
Backend Service API
   ↓
Kafka (market.events : order.created, order.cancelled)
   ↓
Redis
   ↓
Matching Engine
   ↓
Kafka (market.events : trade.executed)
   ↓
DB / HDFS
```

## Kafka Topic

| Topic | Description |
|------|-------------|
| market.events | 시장 도메인의 모든 이벤트 (주문 생성, 취소, 체결) |

## Partition Key

| Topic | Key | Reason |
|------|------|------|
| market.events | item_id (String) | 동일 아이템에 대한 모든 처리 순서를 보장하기 위함 |

## Event Schema (Envelope + Payload)

모든 이벤트는 공통된 Envelope 구조를 가지며, 상세 정보는 `payload` 필드 내부에 위치한다.

### 1. 주문 생성 / 취소 (Order Event Envelope)
**Topic**: `market.events`

| Field | Type | Required | Description |
|------|------|------|-------------|
| event_id | string (UUID) | Y | 이벤트 고유 ID |
| event_type | string | Y | `market.order.created` 또는 `market.order.cancelled` |
| event_version | int | Y | 이벤트 스키마 버전 (현재 1) |
| occurred_at | timestamp(ISO) | Y | 이벤트 발생 시각 (Asia/Seoul) |
| producer | string | Y | 이벤트 발행 주체 (`market-service`) |
| company_id | string | Y | 기업 ID (예: `c100`) |
| aggregate_id | string | Y | 집합체 ID (예: `order_pending` 또는 `order_123`) |
| payload | object | Y | 개별 데이터 |

#### Payload: `market.order.created`
```json
{
  "event_id": "8d7a0e32-6b4e-4a2f-8b2c-3b51a12c2d01",
  "event_type": "market.order.created",
  "event_version": 1,
  "occurred_at": "2026-03-16T10:00:00+09:00",
  "producer": "market-service",
  "company_id": "c10",
  "aggregate_id": "order_pending",
  "payload": {
    "order_id": null,
    "item_id": 1,
    "side": "BUY",
    "price": 1000,
    "quantity": 5,
    "is_virtual": false,
    "created_at": "2026-03-16T10:00:00Z"
  }
}
```
*(참고: 생성 직후 DB 저장 전이므로 매칭엔진/DE를 거치며 `order_id` 세팅)*

#### Payload: `market.order.cancelled`
```json
{
  "event_id": "d1c5a9c4-baf4-4c3c-9f72-2a1e3d7b4b10",
  "event_type": "market.order.cancelled",
  "event_version": 1,
  "occurred_at": "2026-03-16T10:05:00+09:00",
  "producer": "market-service",
  "company_id": "c10",
  "aggregate_id": "order_123",
  "payload": {
    "order_id": 123,
    "item_id": 1,
    "side": "BUY",
    "price": 1000,
    "quantity": 5,
    "is_virtual": false,
    "cancelled_at": "2026-03-16T10:05:00Z"
  }
}
```

---

### 2. 체결 이벤트 (Trade Event Envelope)
**Topic**: `market.events`

| Field | Type | Required | Description |
|------|------|------|-------------|
| event_id | string (UUID) | Y | 이벤트 고유 ID |
| event_type | string | Y | `market.trade.executed` |
| event_version | int | Y | 이벤트 스키마 버전 (현재 1) |
| occurred_at | timestamp(ISO) | Y | 이벤트 발생 시각 (Asia/Seoul) |
| producer | string | Y | 이벤트 발행 주체 (`matching-engine`) |
| company_id | string | N | 체결은 양방향이므로 `null` |
| aggregate_id | string | Y | 집합체 ID (예: `trade_maker_123`) |
| payload | object | Y | 개별 데이터 |

#### Payload: `market.trade.executed`
```json
{
  "event_id": "c928b19a-ef18-4a9b-81d2-09f1a8c9e2b1",
  "event_type": "market.trade.executed",
  "event_version": 1,
  "occurred_at": "2026-03-16T10:02:00+09:00",
  "producer": "matching-engine",
  "company_id": null,
  "aggregate_id": "trade_maker_123",
  "payload": {
    "trade_id": null,
    "item_id": 1,
    "buy_order_id": 123,
    "sell_order_id": 124,
    "price": 1000,
    "quantity": 3,
    "buy_remaining_quantity": null,
    "sell_remaining_quantity": null,
    "executed_at": "2026-03-16T10:02:00Z"
  }
}
```
*(참고: `trade_id`, `remaining_quantity` 등은 향후 고도화 시 매칭엔진이나 DB 적재 단계에서 채워짐)*

---

## 디렉토리 구조
### backend
```
/S14P21B109/backend/src/main/java/com/ssafy/ecosim/domain/market/kafka/
├─ kafka_event_contract.md             # Event Contract 파일
├─ OrderEventEnvelope.java             # 주문 Kafka Envelope
├─ OrderEventPayload.java              # 주문 이벤트 Payload DTO
├─ TradeEventEnvelope.java             # 체결 Kafka Envelope
├─ TradeEventPayload.java              # 체결 이벤트 Payload DTO
├─ OrderEventProducer.java             # 최종 Kafka 전송 (주문 토픽)
├─ TradeEventProducer.java             # 최종 Kafka 전송 (체결 토픽)
├─ OrderEventPublisher.java            # 주문 Publisher 인터페이스
├─ KafkaOrderEventPublisher.java       # 주문 Publisher 구현체 (Envelope 포장)
├─ TradeEventPublisher.java            # 체결 Publisher 인터페이스
└─ KafkaTradeEventPublisher.java       # 체결 Publisher 구현체 (Envelope 포장)
```