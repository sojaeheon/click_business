아래처럼 Markdown으로 정리하면 됩니다.

````md
# Kafka 토픽 및 이벤트 스키마 정리

## 1. 목적

이 문서는 현재 MVP 범위에서 사용하기로 한 Kafka 토픽과 이벤트 스키마를 정리한 문서다.

현재 기준 우선순위는 다음과 같다.

- 랭킹 구현
- 가치 변동 계산
- 뉴스 감지 입력
- 운영 이벤트 이력 저장

운영 처리의 기준 데이터는 PostgreSQL current 상태이며, Kafka는 원인 이벤트를 적재하고 후속 분석/파생 처리에 사용한다.

---

## 2. 설계 원칙

### 2-1. 운영 경로와 데이터 경로 분리
- 운영 처리: 서버 -> PostgreSQL
- 데이터 처리: 서버 -> Kafka -> HDFS / Spark

즉, 실시간 서비스 응답을 Kafka에 의존하지 않는다.

### 2-2. 원인 이벤트 중심 설계
현재 MVP에서는 결과 이벤트를 최소화하고, 원인 이벤트 위주로 적재한다.

예:
- 창고 입고/출고
- 예금 생성/수령
- 대출 생성/상환
- 생산 완료
- 주문 생성/취소/체결

### 2-3. 도메인 기준 토픽 사용
이벤트별 토픽이 아니라 도메인별 토픽으로 운영한다.

### 2-4. 공통 Envelope 사용
모든 이벤트는 동일한 공통 필드를 가진다.

---

## 3. Kafka 토픽 목록

### 3-1. `production.events`
작업장/생산 관련 이벤트를 담는 토픽.

포함 이벤트:
- `production.started`
- `production.rate.changed`
- `production.completed`

권장 key:
- `workstation_id` 또는 `company_id`

현재 구조에서는 `production_job_id`가 없으므로 `aggregate_id`는 `workstation_id`를 사용한다.

### 3-2. `warehouse.events`
창고 입출고 이벤트를 담는 토픽.

포함 이벤트:
- `warehouse.item.stored`
- `warehouse.item.removed`

권장 key:
- `company_id`

랭킹 계산 시 재고 자산 증감의 핵심 입력이다.

### 3-3. `bank.events`
은행/금융 관련 이벤트를 담는 토픽.

포함 이벤트:
- `bank.deposit.created`
- `bank.deposit.redeemed`
- `bank.loan.created`
- `bank.loan.repaid`
- `bank.deposit.matured`
- `bank.rate.base.updated`

권장 key:
- 일반 금융 이벤트: `company_id`
- 글로벌 금리 이벤트: `global-rate`

### 3-4. `market.events`
마켓 관련 이벤트를 담는 토픽.

포함 이벤트:
- `market.order.created`
- `market.order.cancelled`
- `market.trade.executed`

권장 key:
- `item_id`

마켓은 상품 단위로 체결/가격이 형성되므로 item 기준 키가 자연스럽다.

### 3-5. `company.events`
현재 MVP에서는 필수는 아니지만, 향후 회사 상태 변화 결과 이벤트를 담는 토픽으로 확장 가능하다.

예:
- `company.valuation.updated`

현재는 결과 이벤트보다 원인 이벤트 중심으로 진행하므로 선택 사항이다.

---

## 4. 토픽별 역할

| 토픽 | 역할 | 주요 소비자 |
|---|---|---|
| `production.events` | 생산 시작/속도 변경/완료 이력 저장 | Spark raw sink, 뉴스 감지기 |
| `warehouse.events` | 재고 증감 이력 저장, 랭킹 입력 | Spark raw sink, 가치 계산기 |
| `bank.events` | 예금/대출/금리 이력 저장, 랭킹 입력 | Spark raw sink, 가치 계산기, 뉴스 감지기 |
| `market.events` | 주문/체결 이력 저장, 가격 계산 입력 | Spark raw sink, 시세 계산기 |
| `company.events` | 회사 가치 결과 이벤트 저장 | 랭킹 조회, 뉴스 감지기 |

---

## 5. 공통 이벤트 Envelope 스키마

모든 이벤트는 아래 공통 필드를 가진다.

| Field | Type | Required | 설명 |
|---|---|---:|---|
| `event_id` | string | Y | 이벤트 고유 ID |
| `event_type` | string | Y | 이벤트 타입 |
| `event_version` | int | Y | 이벤트 스키마 버전 |
| `occurred_at` | timestamp | Y | 실제 이벤트 발생 시각 |
| `producer` | string | Y | 이벤트 발행 서비스 |
| `company_id` | bigint | Y | 기업 ID |
| `aggregate_id` | string | Y | 도메인 엔티티 ID |
| `payload` | object | Y | 이벤트 상세 데이터 |

예시:

```json
{
  "event_id": "8d7a0e32-6b4e-4a2f-8b2c-3b51a12c2d01",
  "event_type": "warehouse.item.stored",
  "event_version": 1,
  "occurred_at": "2026-03-13T11:10:00+09:00",
  "producer": "warehouse-service",
  "company_id": 1001,
  "aggregate_id": "1001",
  "payload": {}
}
````

---

## 6. `production.events` 스키마

### 6-1. `production.started`

설명:

* 작업장 기준 생산 시작 이벤트
* 현재 구조에서는 `production_job_id` 없이 `workstation_id` 기준으로 관리

payload:

| Field                    | Type      | Required | 설명            |
| ------------------------ | --------- | -------: | ------------- |
| `workstation_id`         | bigint    |        Y | 작업장 ID        |
| `company_id`             | bigint    |        Y | 관련 기업 ID      |
| `item_id`                | bigint    |        Y | 생산 대상 아이템 ID  |
| `planned_quantity`       | bigint    |        Y | 생산 예정 수량      |
| `input_item_id`          | bigint    |        Y | 필요한 재료 아이템 ID |
| `used_material_quantity` | bigint    |        Y | 사용된 재료 수량     |
| `started_at`             | timestamp |        Y | 생산 시작 시각      |
| `expected_completed_at`  | timestamp |        Y | 예상 완료 시각      |

예시:

```json
{
  "event_id": "evt-production-001",
  "event_type": "production.started",
  "event_version": 1,
  "occurred_at": "2026-03-13T11:00:00+09:00",
  "producer": "work-service",
  "company_id": 1001,
  "aggregate_id": "1001",
  "payload": {
    "workstation_id": 1001,
    "company_id": 1001,
    "item_id": 3001,
    "planned_quantity": 100,
    "input_item_id": 2001,
    "used_material_quantity": 100,
    "started_at": "2026-03-13T11:00:00+09:00",
    "expected_completed_at": "2026-03-13T12:00:00+09:00"
  }
}
```

### 6-2. `production.rate.changed`

payload:

| Field            | Type      | Required | 설명           |
| ---------------- | --------- | -------: | ------------ |
| `workstation_id` | bigint    |        Y | 작업장 ID       |
| `company_id`     | bigint    |        Y | 기업 ID        |
| `worker_id`      | bigint    |        Y | 장착/교체한 인부 ID |
| `before_rate`    | bigint    |        Y | 변경 전 생산량     |
| `after_rate`     | bigint    |        Y | 변경 후 생산량     |
| `reason`         | enum      |        Y | 생산량 변경 사유    |
| `changed_at`     | timestamp |        Y | 변경 시각        |

reason 예시:

* `WORKER_ASSIGNED`
* `WORKER_REMOVED`
* `WORKER_UPGRADED`

### 6-3. `production.completed`

설명:

* 뉴스 감지 입력
* 알림 생성 후보

payload:

| Field                | Type      | Required | 설명        |
| -------------------- | --------- | -------: | --------- |
| `workstation_id`     | bigint    |        Y | 작업장 ID    |
| `company_id`         | bigint    |        Y | 기업 ID     |
| `item_id`            | bigint    |        Y | 완료 아이템 ID |
| `completed_quantity` | bigint    |        Y | 완료 수량     |
| `started_at`         | timestamp |        Y | 시작 시각     |
| `completed_at`       | timestamp |        Y | 완료 시각     |

예시:

```json
{
  "event_id": "evt-production-003",
  "event_type": "production.completed",
  "event_version": 1,
  "occurred_at": "2026-03-13T12:00:00+09:00",
  "producer": "work-service",
  "company_id": 1001,
  "aggregate_id": "1001",
  "payload": {
    "workstation_id": 1001,
    "company_id": 1001,
    "item_id": 3001,
    "completed_quantity": 100,
    "started_at": "2026-03-13T11:00:00+09:00",
    "completed_at": "2026-03-13T12:00:00+09:00"
  }
}
```

### 6-4. `production.collected`

현재 MVP에서는 생략 가능하다.

이유:

* 수집 결과는 `warehouse.item.stored`로 대표 가능
* 별도 `production_job_id`도 없고, 수집 = 창고 적재로 보면 충분함

---

## 7. `warehouse.events` 스키마

### 7-1. `warehouse.item.stored`

설명:

* 랭킹 계산 시 재고 자산 증가 입력

payload:

| Field                    | Type      | Required | 설명          |
| ------------------------ | --------- | -------: | ----------- |
| `warehouse_id`           | bigint    |        Y | 창고 ID       |
| `company_id`             | bigint    |        Y | 기업 ID       |
| `item_id`                | int       |        Y | 아이템 코드      |
| `quantity_delta`         | bigint    |        Y | 이번 입고 수량    |
| `current_quantity_after` | bigint    |        Y | 입고 후 현재 보유량 |
| `reason`                 | enum      |        Y | 입고 사유       |
| `stored_at`              | timestamp |        Y | 입고 시각       |


reason 예시:

* `PRODUCTION_COLLECTION`
* `MARKET_BUY`
* `ADMIN_GRANT`

예시:

```json
{
  "event_id": "evt-warehouse-001",
  "event_type": "warehouse.item.stored",
  "event_version": 1,
  "occurred_at": "2026-03-13T11:10:00+09:00",
  "producer": "warehouse-service",
  "company_id": 1001,
  "aggregate_id": "1001",
  "payload": {
    "warehouse_txn_id": 1001,
    "warehouse_id": 10,
    "company_id": 1001,
    "item_id": 2001,
    "quantity": 40,
    "reason": "PRODUCTION_COLLECTION",
    "stored_at": "2026-03-13T11:10:00+09:00"
  }
}
```

### 7-2. `warehouse.item.removed`

설명:

* 랭킹 계산 시 재고 자산 감소 입력

payload:

| Field                    | Type      | Required | 설명          |
| ------------------------ | --------- | -------: | ----------- |
| `warehouse_id`           | bigint    |        Y | 창고 ID       |
| `company_id`             | bigint    |        Y | 기업 ID       |
| `item_id`                | int       |        Y | 아이템 코드      |
| `quantity_delta`         | bigint    |        Y | 이번 출고 수량    |
| `current_quantity_after` | bigint    |        Y | 출고 후 현재 보유량 |
| `reason`                 | enum      |        Y | 출고 사유       |
| `removed_at`             | timestamp |        Y | 출고 시각       |


reason 예시:

* `PRODUCTION_INPUT`
* `MARKET_SELL`
* `ADMIN_ADJUSTMENT`

---

## 8. `bank.events` 스키마

### 8-1. `bank.deposit.created`

payload:

| Field           | Type      | Required | 설명       |
| --------------- | --------- | -------: | -------- |
| `deposit_id`    | string    |        Y | 예금 계약 ID |
| `principal`     | bigint    |        Y | 원금       |
| `interest_rate` | decimal   |        Y | 적용 금리    |
| `maturity_at`   | timestamp |        Y | 만기 시각    |
| `created_at`    | timestamp |        Y | 생성 시각    |

### 8-2. `bank.deposit.redeemed`

payload:

| Field             | Type      | Required | 설명       |
| ----------------- | --------- | -------: | -------- |
| `deposit_id`      | string    |        Y | 예금 계약 ID |
| `principal`       | bigint    |        Y | 원금       |
| `interest_amount` | bigint    |        Y | 이자       |
| `redeemed_amount` | bigint    |        Y | 실제 수령액   |
| `redeemed_at`     | timestamp |        Y | 수령 시각    |

### 8-3. `bank.loan.created`

payload:

| Field           | Type      | Required | 설명       |
| --------------- | --------- | -------: | -------- |
| `loan_id`       | string    |        Y | 대출 계약 ID |
| `principal`     | bigint    |        Y | 대출 원금    |
| `interest_rate` | decimal   |        Y | 적용 금리    |
| `created_at`    | timestamp |        Y | 생성 시각    |

### 8-4. `bank.loan.repaid`

payload:

| Field              | Type      | Required | 설명       |
| ------------------ | --------- | -------: | -------- |
| `loan_id`          | string    |        Y | 대출 계약 ID |
| `principal_repaid` | bigint    |        Y | 상환 원금    |
| `interest_paid`    | bigint    |        Y | 납부 이자    |
| `repaid_at`        | timestamp |        Y | 상환 시각    |

### 8-5. `bank.deposit.matured`

payload:

| Field           | Type      | Required | 설명       |
| --------------- | --------- | -------: | -------- |
| `deposit_id`    | string    |        Y | 예금 계약 ID |
| `principal`     | bigint    |        Y | 원금       |
| `interest_rate` | decimal   |        Y | 적용 금리    |
| `matured_at`    | timestamp |        Y | 만기 도달 시각 |

### 8-6. `bank.rate.base.updated`

payload:

| Field            | Type      | Required | 설명     |
| ---------------- | --------- | -------: | ------ |
| `effective_date` | date      |        Y | 적용 기준일 |
| `base_rate`      | decimal   |        Y | 기준 금리  |
| `updated_at`     | timestamp |        Y | 갱신 시각  |

---

## 9. `market.events` 스키마

### 9-1. `market.order.created`

payload:

| Field        | Type      | Required | 설명      |
| ------------ | --------- | -------: | ------- |
| `order_id`   | bigint    |        Y | 주문 ID   |
| `item_id`    | enum      |        Y | 아이템 ID  |
| `side`       | enum      |        Y | 매수/매도   |
| `price`      | bigint    |        Y | 주문 가격   |
| `quantity`   | bigint    |        Y | 총 주문 수량 |
| `is_virtual` | boolean   |        Y | 봇 여부    |
| `created_at` | timestamp |        Y | 주문 시간   |

### 9-2. `market.order.cancelled`

payload:

| Field                | Type      | Required | 설명       |
| -------------------- | --------- | -------: | -------- |
| `order_id`           | bigint    |        Y | 주문 ID    |
| `item_id`            | enum      |        Y | 아이템 ID   |
| `side`               | enum      |        Y | 매수/매도    |
| `price`              | bigint    |        Y | 주문 가격    |
| `cancelled_quantity` | bigint    |        Y | 취소 수량    |
| `remaining_quantity` | bigint    |        Y | 취소 시점 잔량 |
| `cancelled_at`       | timestamp |        Y | 취소 시간    |

### 9-3. `market.trade.executed`

설명:

* 상품 시세 계산의 핵심 입력
* 랭킹 계산 시 재고 자산 평가 가격 기준으로 사용 가능

payload:

| Field             | Type      | Required | 설명        |
| ----------------- | --------- | -------: | --------- |
| `trade_id`        | bigint    |        Y | 체결 ID     |
| `item_id`         | enum      |        Y | 체결 아이템    |
| `buy_order_id`    | bigint    |        Y | 매수 주문 ID  |
| `sell_order_id`   | bigint    |        Y | 매도 주문 ID  |
| `buy_company_id`  | bigint    |        Y | 매수 기업 ID  |
| `sell_company_id` | bigint    |        Y | 매도 기업 ID  |
| `trade_price`     | bigint    |        Y | 체결 가격     |
| `trade_quantity`  | bigint    |        Y | 체결 수량     |
| `buy_is_virtual`  | boolean   |        Y | 매수 측 봇 여부 |
| `sell_is_virtual` | boolean   |        Y | 매도 측 봇 여부 |
| `executed_at`     | timestamp |        Y | 체결 시간     |

---

## 10. 랭킹 구현에 필요한 최소 이벤트

랭킹 먼저 구현할 경우, 최소한 아래 이벤트를 입력으로 보면 된다.

### 직접 입력 이벤트

* `warehouse.item.stored`
* `warehouse.item.removed`
* `bank.deposit.created`
* `bank.deposit.redeemed`
* `bank.loan.created`
* `bank.loan.repaid`
* `market.trade.executed`

### 보조 입력

* PostgreSQL current cash
* PostgreSQL current deposit / loan 상태
* PostgreSQL current warehouse balance

### 랭킹 계산식

`valuation = cash + inventory_asset_value + deposit_asset_value - debt`

여기서:

* `cash`: current table
* `inventory_asset_value`: 재고 수량 × 시장가
* `deposit_asset_value`: 활성 예금 자산
* `debt`: 미상환 대출 잔액

---

## 11. 현재 추천 사항

### 유지 추천 이벤트

* `production.started`
* `production.rate.changed`
* `production.completed`
* `warehouse.item.stored`
* `warehouse.item.removed`
* `bank.deposit.created`
* `bank.deposit.redeemed`
* `bank.loan.created`
* `bank.loan.repaid`
* `market.trade.executed`

### MVP에서 제거 가능

* `production.collected`

