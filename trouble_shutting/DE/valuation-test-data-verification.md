# 기업 가치 계산용 임시 기업 데이터 검증

## 원인

가치 계산 스트림은 동작했지만 `companies=0`으로 기록됐다. 운영 PostgreSQL에
실제 `company`, `warehouse`, `warehouse_slot` 데이터가 없었기 때문이다.

봇 스케줄러는 `is_virtual=true` 주문을 만들고 임의 회사 ID를 붙인다. 이는 시장
체결가를 만들기 위한 데이터이며, 실제 기업의 현금이나 창고 재고를 만들지 않는다.

## 적용

`data/seed/seed_valuation_test_data.sql`을 추가하고 실행했다.

- `valuation-test-01`부터 `valuation-test-20`까지 기업 20개 생성
- 기업별 현금과 창고 20칸 생성
- 각 기업에 품목 1, 2, 3 재고 배정
- 같은 이름의 기업이 있으면 다시 만들지 않는 멱등 시드

품목 1 체결 이벤트를 Kafka에 발행해 가치 계산을 트리거했다.

## 검증 결과

- `company`: 시드 기업 20개
- `company_valuation`: 20개 행 생성
- `ranking_current`: 20개 행 생성
- 기업 가치 범위: 24,902,500 ~ 32,057,800
- Spark 로그: `companies=20, valuations=20`

이후 봇의 품목 1 체결가가 바뀔 때마다 해당 품목을 보유한 20개 시드 기업의
가치와 랭킹이 다시 계산된다.
