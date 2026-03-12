# Kafka Event Contract

이 문서는 Backend (Java) ↔ Data Engineering (Python) 간의 Kafka 이벤트 스트림 구조와 이벤트 스키마를 정의한다. Backend는 이벤트를 Kafka로 발행(Producer)하며, Data Engineering은 Kafka 이벤트를 소비(Consumer)하여 데이터 처리 및 적재에 활용한다.

## Event Flow
```
Client
   ↓
Backend API
   ↓
Kafka (order.made)
   ↓
Redis
   ↓
Matching Engine
   ↓
Kafka (order.matched)
   ↓
DB / HDFS
```

## Kafka Topic

| Topic | Description |
|------|-------------|
| order.made | 주문 생성 및 취소 이벤트 |
| order.matched | 주문 체결 이벤트 |

## Partition Key

| Topic | Key |
|------|-----|
| order.made | item |
| order.matched | item |

## Event Schema
### Topic <order.made>
| Field | Type | Required | Description |
|------|------|------|-------------|
| event_type | enum | Y | ORDER_CREATED / ORDER_CANCELLED |
| market_order_id | long | Y | 주문 ID |
| item | string | Y | 거래 아이템 |
| company_id | long | Y | 기업 ID |
| order_type | enum | Y | BUY / SELL |
| price | int | Y | 주문 가격 |
| total_quantity | int | Y | 주문 총 수량 |
| remaining_quantity | int | Y | 미체결 수량 |
| status | enum | Y | OPEN / PARTIALLY_FILLED / FILLED / CANCELLED |
| is_virtual | boolean | Y | 봇 주문 여부 |
| created_at | timestamp | Y | 주문 생성 시각 |
| updated_at | timestamp | Y | 주문 수정 시각 |

#### Event <ORDER_CREATED> : 주문 생성 시 발생하는 이벤트
```json
{
  "event_type": "ORDER_CREATED",
  "market_order_id": 123,
  "item": "GOLD_ORE",
  "company_id": 10,
  "order_type": "BUY",
  "price": 1000,
  "total_quantity": 5,
  "remaining_quantity": 5,
  "status": "OPEN",
  "is_virtual": false,
  "created_at": "2026-03-06T10:00:00Z",
  "updated_at": "2026-03-06T10:00:00Z"
}
```

#### Event <ORDER_CANCELLED> : 주문 취소 시 발생하는 이벤트
```json
{
  "event_type": "ORDER_CANCELLED",
  "market_order_id": 123,
  "item": "GOLD_ORE",
  "company_id": 10,
  "order_type": "BUY",
  "price": 1000,
  "total_quantity": 5,
  "remaining_quantity": 5,
  "status": "CANCELLED",
  "is_virtual": false,
  "created_at": "2026-03-06T10:00:00Z",
  "updated_at": "2026-03-06T10:05:00Z"
}
```


## 디렉토리 구조
### backend
```
/S14P21B109/backend/src/main/java/com/ssafy/ecosim/
├─ kafka_event_contract.md                  # Event Contract 파일
├─ domain
│  └─ market
│     └─ kafka
│        ├─ MarketEventPublisher.java       # Kafka Producer
│        ├─ OrderMadeEvent.java             # 주문 생성 이벤트
│        └─ OrderMatchedEvent.java          # 주문 체결 이벤트
│
└─ global
   └─ config
      ├─ KafkaProducerConfig.java           # Kafka Producer 설정
      └─ RedisConfig.java                   # Redis 설정
```
### bigdata
```
/S14P21B109/bigdata/kafka/
├── configs                                 # Kafka 설정
├── consumers                               # Kafka Consumer
├── producers                               # Kafka Producer
├── scripts
└── kafkaReadme.md
```