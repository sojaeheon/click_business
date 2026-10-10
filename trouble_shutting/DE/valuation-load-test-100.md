# 기업 가치 계산 100개 기업 부하 확인

## 목적

실제 `company`, `warehouse`, `warehouse_slot` 데이터를 가진 기업 수를 늘린 뒤,
Kafka 체결 이벤트가 Spark 가치 계산과 랭킹 갱신까지 정상적으로 전파되는지 확인한다.

## 실행 결과

- `seed_valuation_load_100.sql`로 `valuation-test-01`부터 `valuation-test-100`까지 생성했다.
- 각 기업은 현금과 품목 1, 2, 3 재고를 가진다.
- Spark 로그에서 연속적으로 `companies=100, valuations=100`이 확인됐다.
- PostgreSQL의 테스트 기업 수, `company_valuation`, `ranking_current` 행 수가 모두 100으로 일치했다.

## 발견한 문제와 보완

- 초기 확장 시드가 기업 번호와 새 사용자 순번을 직접 비교해 79개까지만 연결됐다.
  두 목록에 같은 순번을 부여해 연결하도록 수정했다.
- 수동 Kafka 이벤트에 UTF-8 BOM이 있으면 Python 소비자가 JSON을 해석하지 못했다.
  세 HDFS/DB 소비자가 `utf-8-sig`로 해석하도록 보완했다.
- 체결 이력이 아닌 가격 갱신용 이벤트에는 주문 식별자가 없을 수 있다.
  DB 체결 소비자는 필수 체결 필드가 없는 이벤트를 경고로 남기고 offset을 커밋해
  소비가 멈추지 않게 했다.

## 자원 관찰

- Spark Master가 Worker 1대의 3 CPU / 4 GiB 중 2 CPU / 2 GiB를 가치 계산 앱에 할당했다.
- 100개 기업을 계산하는 동안에도 Worker의 순간 CPU는 낮게 측정될 수 있다. 배치가 끝난 뒤
  대기하는 스트리밍 작업이기 때문이다.
- 하지만 2초 트리거가 2초를 넘기는 `falling behind` 경고가 확인됐다. 현재 구현은 매 배치에서
  Python Driver로 이벤트를 `collect()`하고 대상 기업 값을 PostgreSQL에서 계산한다. 기업 수나
  이벤트 양이 더 늘면 이 부분이 먼저 한계에 도달한다.
