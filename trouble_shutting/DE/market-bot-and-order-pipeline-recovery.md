# 봇 주문 부하 및 주문 파이프라인 복구

## 증상

- `bot-order-producer`가 CPU를 약 70~82% 사용했다.
- 사용자 주문을 접수했지만 대기 주문과 체결 내역에 표시되지 않았다.
- 실시간 캔들 차트가 빈 화면처럼 표시됐다.

## 원인

1. 기존 봇은 품목 3개에 각각 초당 30~50개의 주문을 생성했다.
2. 봇 주문의 20%는 목표 가격 방향으로 기존 호가를 직접 체결했다.
3. 주문 생성마다 Kafka 이벤트와 상세 로그가 발생했고, Redis 호가 물량을 반복 조회했다.
4. `order-db-consumer`, `order-redis-consumer`, `trade-db-consumer`가 `Created` 상태로 실행되지 않았다.
5. 주문 토픽에 약 21만 건의 lag가 쌓여 사용자 주문이 Kafka 이후 단계로 전달되지 않았다.
6. 최근 캔들이 모두 OHLC가 같은 보합 캔들이어서 높이가 0인 막대가 화면에서 보이지 않았다.

## 적용한 변경

- 봇을 메이커 전용 유동성 공급자로 변경했다.
- 현재가 양쪽에 최소 주문 수가 부족할 때만 주문을 보충한다.
- 품목별 한 주기 최대 생성량을 2건으로 제한했다.
- 초기 1,000건 주문과 목표가 방향 테이커 주문을 제거했다.
- 봇 주문 한 건의 기본 수량은 600으로 설정했다.
- 주문별 Kafka 성공 로그와 매칭 완료 로그를 `DEBUG`로 낮췄다.
- 주문 소비자가 최대 500건씩 poll하고 오프셋을 배치 커밋하도록 변경했다.
- Redis 소비자는 pipeline으로 주문 Hash와 호가 ZSET을 함께 갱신한다.
- 복구 모드에서 과거 가상 주문은 건너뛰고 실제 사용자 주문만 보존했다.
- 보합 캔들을 가로선으로 표시하고 최소 렌더링 높이를 적용했다.

## 복구 절차

1. 봇과 매칭 엔진을 중지해 추가 적체와 조기 체결을 방지했다.
2. 주문 소비자를 `SKIP_VIRTUAL_EVENTS=true`로 실행했다.
3. 주문 DB·Redis consumer lag가 0이 될 때까지 실제 사용자 주문을 복구했다.
4. 주문 소비자를 정상 모드로 재생성했다.
5. 체결 DB consumer lag가 0인 것을 확인했다.
6. 매칭 엔진을 재개한 후 최적화된 봇을 시작했다.

## 검증 결과

- 주문 DB consumer lag: 0
- 주문 Redis consumer lag: 0
- 체결 DB consumer lag: 0
- 사용자 주문: 62,600원 매수 1개, `COMPLETED`
- 실제 체결: 62,500원, 수량 1개, 미수령 체결 내역 생성
- 현재가 및 1분봉 종가: 62,500원
- 봇 CPU: 약 0.23%
- 매칭 엔진 CPU: 약 3.11%
- Redis CPU: 약 0.75%

## 운영 시 확인 사항

- 사용자 주문과 체결 내역은 선택한 품목별로 조회된다. 다른 품목을 선택하면 해당 내역이 표시되지 않는다.
- 봇 설정은 `MARKET_BOT_INTERVAL_MS`, `MARKET_BOT_MIN_LEVELS`, `MARKET_BOT_ORDER_QUANTITY`, `MARKET_BOT_MAX_ORDERS_PER_ITEM_PER_TICK`, `MARKET_BOT_TICK_SIZE`로 조정한다.
- 소비자 lag와 봇 CPU를 함께 관찰하면서 최소 호가 수와 주문 수량을 조정한다.

## 2026-10-10 전체 시장·캔들·뉴스 점검

### 정상 동작

- API 백엔드, 프런트엔드, 봇 주문 생성기, 매칭 엔진, Kafka 3대, Redis, PostgreSQL은 실행 중이다.
- 주문 DB·Redis consumer와 체결 DB consumer의 Kafka lag는 모두 0이다.
- 주문장, 캔들, 체결, 내 주문 API는 브라우저 요청에 HTTP 200을 반환한다.
- 1분봉은 세 품목 모두 매분 생성된다. DB에는 품목별 794개, Redis에는 품목별 최근 120개가 있다.
- 최근 체결이 없는 구간은 현재가로 보합 캔들을 생성한다. 따라서 차트 데이터는 존재하지만 가격 변화가 없으면 가로선처럼 보인다.
- 점검 시 CPU는 백엔드 0.66%, 봇 0.16%, 매칭 엔진 1.84%, Spark worker 0.19%였다.

### 발견한 문제

1. 뉴스 DB가 비어 있다.
   - `external_news=0`, `internal_news=0`이므로 `/api/news`는 정상 응답하더라도 빈 목록을 반환한다.
   - `Refined_news.csv`에는 2020-01-04부터 2025-12-30까지 520건이 있지만 `processed_news_loader.py`가 실행되지 않았다.
   - compose의 `external-loader`는 뉴스가 아니라 `external_index`를 적재한다.
2. 내부 뉴스 Spark 입력이 중단됐다.
   - `order-hdfs-consumer`, `trade-hdfs-consumer`, `hdfs-raw-sink-consumer`가 모두 `Created` 상태다.
   - HDFS 최신 주문·체결 파일은 07:51에 멈췄다.
   - 주문 HDFS consumer lag는 약 21.9만 건, raw sink의 주문 lag는 약 21.8만 건이다.
3. HDFS 파일과 뉴스 Spark 입력 스키마가 맞지 않는다.
   - generic raw sink는 실제 이벤트를 `event_raw` 문자열 안에 저장한다.
   - `market_news_stream.py`는 최상위의 `item_id`, `created_at`, `executed_at`을 읽는다.
   - 이 구조에서는 필수 필드가 null이 되어 후보가 항상 0건이 된다.
4. 뉴스의 현실 시각과 게임 시각이 섞여 있다.
   - Spark 배치 기준 시각은 현실 시각인 2026-10-10이다.
   - 주문 `created_at`과 체결 `executed_at`은 게임 시각인 2020년 epoch 값이다.
   - 현재 필터는 2026년 기준 최근 20분과 2020년 이벤트를 비교하므로 모든 이벤트를 제외한다.
   - 후보가 생성되어도 Spark가 현실 시각을 `published_at`에 기록하면, 게임 날짜 기준으로 조회하는 뉴스 API에서 보이지 않는다.
5. 과거 봇 주문이 Redis와 DB에 대량으로 남아 있다.
   - Redis 주문장은 품목별 매수 11,780~25,543건, 매도 8,130~10,179건이다.
   - DB에는 가상 `PENDING` 주문 97,948건이 남아 있다.
   - 새 봇은 호가가 충분하다고 판단해 추가 주문을 만들지 않지만, 사용자는 과거 봇 주문과 체결하게 된다.
6. 기업가치 Spark 작업이 중단됐다.
   - `spark-submit-valuation`은 checkpoint의 불완전한 offset 파일 때문에 exit code 1로 종료됐다.
   - 랭킹 API가 응답해도 최신 이벤트가 반영되지 않는 stale 상태일 수 있다.
7. HDFS와 Kafka 모니터링이 완전하지 않다.
   - `kafka-exporter`가 `Created` 상태라 Prometheus/Grafana에서 Kafka 지표를 신뢰할 수 없다.
   - generic raw sink와 전용 주문·체결 HDFS consumer를 함께 켜면 동일 토픽을 서로 다른 group으로 중복 적재하면서 서로 다른 스키마가 한 경로에 섞일 수 있다.

### 권장 해결 순서

1. 뉴스용 HDFS 적재 방식을 하나로 통일하고, Spark가 `event_raw`를 파싱하도록 입력 스키마를 수정한다.
2. 최근 구간 판정은 현실 시각 `occurred_at`, 뉴스 발행 시각은 게임 시각 `created_at` 또는 `executed_at`을 사용하도록 분리한다.
3. HDFS consumer의 과거 가상 주문 backlog 처리 정책을 정한 뒤 적재를 재개한다. 그대로 재생하면 불필요한 봇 이벤트가 대량 적재된다.
4. 외부 뉴스 520건을 idempotent 방식으로 적재하고 compose 기동 절차에 뉴스 적재 작업을 포함한다.
5. 사용자 주문을 보존한 채 Redis의 과거 가상 주문을 정리하고 DB의 오래된 가상 `PENDING` 주문을 취소 처리한다.
6. 기업가치 Spark checkpoint를 새 경로로 교체하거나 손상된 checkpoint를 복구한 뒤 랭킹 갱신을 확인한다.
7. `kafka-exporter`를 시작해 consumer lag와 broker 상태를 모니터링한다.

## 2026-10-10 복구 적용 결과

### 시장 주문장

- API·봇·매칭을 중지한 상태에서 실제 사용자 `PENDING` 주문이 0건임을 확인했다.
- DB의 과거 가상 `PENDING`·`PARTIALLY_COMPLETED` 주문 98,760건을 `CANCELED`로 변경했다.
- Redis의 과거 가상 주문 Hash 88,251개와 기존 호가 ZSET 6개를 제거했다.
- 봇 컨테이너에서 스케줄링이 실행되지 않던 문제를 수정했다. `@EnableScheduling`을 애플리케이션 공통 설정으로 이동해 역할별 컨테이너의 스케줄러가 독립적으로 동작한다.
- 재시작 후 품목별 매수 5건·매도 5건, 총 30건의 가상 주문만 유지한다.
- 안정화 후 CPU는 백엔드 0.50%, 봇 0.48%, 매칭 엔진 2.83%였다.

### 캔들

- 체결 버퍼 형식을 `timestamp:price:quantity`로 변경해 실제 체결 수량을 1분봉 거래량에 합산한다.
- 과거 `timestamp:price` 형식도 계속 읽도록 호환성을 유지했다.
- 5분봉이 1분봉과 같은 체결 버퍼를 비우던 구조를 제거했다.
- 5분봉은 최근 1분봉 5개의 시가·고가·저가·종가·거래량을 합쳐 생성한다.
- 검증 결과 1분봉과 5분봉 모두 품목별 Redis 120개를 유지하며 매분/5분 경계에 정상 저장됐다.

### 뉴스와 HDFS

- `hdfs-raw-sink-consumer`를 원천 이벤트의 단일 HDFS 적재기로 사용한다.
- 과거 봇 backlog를 다시 적재하지 않도록 `raw-sink-v1` offset을 최신으로 이동한 뒤 시작했다.
- 전용 `order-hdfs-consumer`, `trade-hdfs-consumer`는 `legacy-hdfs` profile로 이동해 기본 실행에서 제외했다.
- Spark가 generic raw sink의 `event_raw` 안에 있는 주문·체결 payload를 파싱하도록 수정했다.
- 분석 구간은 현실 시각 `occurred_at`, 뉴스 발행은 최신 게임 캔들 시각을 사용하도록 분리했다.
- 전체 HDFS 1.6GB를 반복 스캔하지 않고 최근 분석 구간의 시간 파티션만 읽는다.
- 뉴스 실행 주기를 1분으로 변경하고 checkpoint를 `market-news-stream-v2`로 교체했다.
- 실제 HDFS raw 주문 30건이 Spark에서 `normalized orders=30`으로 파싱되는 것을 확인했다.
- 외부 뉴스 로더를 환경변수 기반·배치·중복 방지 방식으로 수정했다.
- 외부 뉴스 520건을 적재했고 재실행 시 `inserted=0`을 확인했다.
- 현재 게임 날짜 2020-04-01 기준 API 조회 범위에 포함되는 외부 뉴스는 27건이다.
- 내부 뉴스는 균형 잡힌 초기 매수·매도 호가만 존재해 신호 후보가 0건인 정상 상태다.

### 기업가치와 모니터링

- 손상된 기업가치 checkpoint 대신 `company-valuation-v2`를 사용한다.
- 스트림 시작 전에 최신 1분봉 가격과 운영 DB의 현금·재고로 전체 기업가치를 초기 재계산한다.
- `company_valuation`과 `ranking_current` 모두 102개 기업이 갱신됐다.
- `spark-submit-valuation`은 종료되지 않고 실행 중이다.
- `kafka-exporter`를 시작했고 주문 DB·Redis, 체결 DB, raw HDFS consumer lag가 모두 0이다.

## 2026-10-10 시장 속보 중복 원인

DB에서 내부 뉴스 21건을 확인한 결과 같은 제목이 최대 7번 저장돼 있었다. 현실 시간으로는 Spark가 1분마다 실행되지만, 각 뉴스의 `published_at`과 `created_at`에는 빠르게 흐르는 게임 시간이 함께 저장된다. 현재 게임 시간은 현실 1분 동안 약 2시간 24분 진행되므로 게임 시간 기준 10분 cooldown은 다음 Spark 배치 전에 이미 끝난다.

또한 Spark가 `item_id:signal_type:reference_minute` 형식의 `dedupe_key`를 만들지만 `internal_news` 테이블에는 해당 값을 저장하지 않는다. 실제 중복 검사는 제목과 게임 시간 10분 범위만 사용한다. 봇의 주문 생성·취소 패턴으로 `CANCELLATION_SURGE`가 여러 배치 동안 유지되면 매 배치가 새로운 사건으로 처리되는 구조다.

수정 시에는 다음 원칙을 적용한다.

1. `published_at`은 화면에 표시할 게임 시간으로 유지한다.
2. `created_at`은 DB의 실제 생성 시각 `NOW()`를 사용한다.
3. `item_id`, `signal_type`, `dedupe_key`를 내부 뉴스에 저장한다.
4. 전역 발행 간격은 현실 시간으로 제한하고, 같은 품목·신호는 신호가 해제됐다가 다시 발생하거나 충분한 현실 시간 cooldown이 지난 경우에만 재발행한다.
5. 기존 중복 뉴스 정리는 최신 한 건을 보존하는 별도 데이터 정리로 수행한다.

### 시장 속보 중복 수정 결과

- Flyway `V22__deduplicate_internal_market_news.sql`을 추가하고 운영 DB에 적용했다.
- `internal_news`에 `item_id`, `signal_type`, `dedupe_key`를 추가하고 `dedupe_key`에 UNIQUE 제약을 적용했다.
- `market_news_signal_state`를 추가해 품목·신호별 활성/해제 상태와 마지막 관측·발행 시각을 저장한다.
- `published_at`은 게임 시간으로 유지하고 `created_at`은 PostgreSQL `CURRENT_TIMESTAMP`로 저장한다.
- 전역 및 동일 신호 cooldown을 현실 `created_at` 기준으로 변경했다.
- 같은 신호가 다음 배치에도 유지되면 새 사건으로 발행하지 않고, 신호가 사라졌다가 다시 발생했을 때만 새 활성 사건으로 판단한다.
- 재처리 시 같은 `dedupe_key`가 다시 들어와도 DB UNIQUE 제약과 `ON CONFLICT DO NOTHING`으로 중복 insert를 막는다.
- 기존 내부 뉴스는 제목별 최신 한 건만 남겨 21건 이상에서 4건으로 정리했다.

런타임 검증에서 batch 18은 후보 1건을 감지했지만 현실 시간 전역 cooldown으로 발행하지 않고 활성 상태만 기록했다. 다음 batch 19에서 같은 후보가 유지됐지만 `no newly activated signal`로 처리됐고 `internal_news`는 4건을 유지했다. Flyway는 v22 적용에 성공했고 백엔드와 `spark-market-news`는 정상 실행 중이다.
