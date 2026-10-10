# 기업 가치 계산 스트림 작업 기록

작성일: 2026-09-23

## 목표

기업 가치와 랭킹을 빠르게 반영하면서 `spark-worker`의 불필요한 CPU 사용을 줄인다. 별도 분석 PostgreSQL은 제거하고 운영 PostgreSQL을 최신 가치의 단일 저장소로 사용한다.

## 변경한 내용

### 1. 분석 DB 의존성 제거

- `data/compose.yaml`에서 `analytics-postgres` 서비스를 제거했다.
- `data/.env`에서 분석 DB와 중복 운영 DB 접속 환경변수를 제거했다.
- `bigdata/compose.yaml`의 가치 계산 컨테이너에서 분석 DB 대기 조건을 제거했다.

Spark는 이제 `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`로 운영 PostgreSQL에만 연결한다.

### 2. 운영 DB에 가치 계산 상태 테이블 추가

[V21__create_company_valuation_state.sql](../../backend/src/main/resources/db/migration/V21__create_company_valuation_state.sql)를 추가했다.

| 테이블 | 용도 |
| --- | --- |
| `company_cash_state` | 기업별 최신 현금 |
| `company_item_qty_state` | 기업·상품별 재고 수량 |
| `item_price_state` | 상품별 최신 체결가 |
| `company_valuation` | 기업별 최신 현금, 재고 가치, 기업 가치 |
| `valuation_processed_event` | Kafka 재전달·배치 재시도 시 중복 재고 반영 방지 |

`company_valuation (market_cap DESC, company_id ASC)` 인덱스로 가치 순 정렬을 지원한다. 기존 `ranking_current`도 같은 트랜잭션에서 갱신하므로 현재 백엔드 랭킹 API를 그대로 사용할 수 있다.

### 3. Spark 스트림을 하나로 통합

[company_valutation_stream.py](../../bigdata/spark/jobs/company_valutation_stream.py)를 다음처럼 변경했다.

- 기존 현금·재고·가격용 세 `writeStream`을 하나의 Kafka 스트림과 하나의 `foreachBatch`로 통합했다.
- 한 배치에서 `company.cash.changed`, `warehouse.item.stored`, `warehouse.item.removed`, `market.trade.executed` 이벤트를 분류한다.
- 현금·재고·가격 상태를 갱신한 뒤, 그 배치에서 영향을 받은 기업만 재평가한다.
- 가치 결과와 `ranking_current`을 하나의 PostgreSQL 트랜잭션에서 갱신한다.
- 이벤트 ID를 먼저 기록해 Kafka의 적어도 한 번 전달 방식에서 재고 수량이 중복 증가·감소하지 않게 했다.

### 4. 실시간성 및 과부하 제어

기본 설정은 아래와 같다.

```text
VALUATION_TRIGGER_INTERVAL=2 seconds
VALUATION_MAX_OFFSETS_PER_TRIGGER=1000
```

가치 반영은 최대 약 2초 지연된다. 한 배치가 1,000건을 넘지 않아 체결 급증이 Worker CPU와 DB를 장시간 점유하는 것을 제한한다. 실제 부하 측정 후 Kafka lag가 계속 쌓이면 상한을 조정한다.

## 재기동 절차

현재 확인 시점에는 Docker 컨테이너가 모두 중지되어 있었다. 다음 순서로 실행한다.

```powershell
docker compose -f data/compose.yaml --env-file data/.env up -d
docker compose -f backend/compose.yaml up --build -d
docker compose -f bigdata/compose.yaml up -d --force-recreate spark-submit-valuation
```

백엔드를 빌드해 재기동하면 Flyway가 V21 마이그레이션을 적용한다. 기존에 중지된 `analytics-postgres` 컨테이너와 볼륨은 자동으로 삭제되지 않는다. 데이터가 더 이상 필요 없다는 확인 후 별도로 정리한다.

## 확인 항목

1. 백엔드 로그에서 V21 Flyway 마이그레이션 성공을 확인한다.
2. `spark-submit-valuation` 로그에 다음과 같은 배치 로그가 출력되는지 확인한다.

   ```text
   [VALUATION] batch=..., events=..., companies=..., valuations=...
   ```

3. 체결 또는 재고 이벤트 발생 후 약 1초 안에 `company_valuation.updated_at`이 바뀌는지 확인한다.
4. 랭킹 API의 다음 조회에서 가치와 순위가 바뀌는지 확인한다.
5. Spark Worker CPU, Micro-batch 처리 시간, Kafka consumer lag를 함께 기록한다.

## 검증 결과

- Python 문법 검사: 통과 (`python -m py_compile`)
- `data/compose.yaml` Compose 검증: 통과
- `bigdata/compose.yaml` Compose 검증: 통과
- Spark 런타임 검증: 통과. `CompanyValuationStream`이 Worker Executor 1코어·1GiB를 할당받았고, 재시작 없이 batch 1~5를 처리했다.

### 런타임 중 발견·수정한 호환성 문제

Spark 이미지의 Python은 3.8이다. Python 3.10 이상에서만 지원하는 `int | None` 표기 때문에 처음 기동 시 종료됐다. 모든 해당 표기를 `Optional[...]`로 바꿨다.

기존 Kafka 이력에는 `1.58190336E9`처럼 과학적 표기의 Unix 초 시각도 있다. 이를 PostgreSQL timestamp에 그대로 전달하면 오류가 발생한다. 이제 ISO-8601, Unix 초·밀리초, 과학적 표기 Epoch 초를 UTC `datetime`으로 변환해 저장한다.

### 후속 조정 필요

1초 trigger는 2코어 확장 뒤에도 실제 batch 시간이 약 1.2~2.6초로 밀렸다. 기본 trigger를 2초로 조정했다. 다음 부하 측정에서 Kafka lag와 가치 반영 지연을 함께 확인해 `maxOffsetsPerTrigger` 또는 trigger 주기를 조정해야 한다.
