# Market News Signals

`market.order.events`와 `market.trade.events`를 HDFS에서 읽어 최근 시장 변화를 뉴스 후보로 변환하는 Spark 잡입니다.

- 배치 잡: `market_news_signals.py`
- 자동 1분 스트리밍 잡: `market_news_streaming.py`

## 감지하는 시그널

- `PRICE_SURGE`: 최근 거래 평균가 급등
- `PRICE_DROP`: 최근 거래 평균가 급락
- `TRADE_VOLUME_SPIKE`: 체결량 급증
- `TRADE_VOLUME_DROP`: 체결량 급감
- `BUY_PRESSURE`: 매수 주문 급증
- `SELL_PRESSURE`: 매도 주문 급증
- `CANCELLATION_SURGE`: 주문 취소 급증

## 기본 입력 경로

- 주문 이벤트: `hdfs://namenode:9000/raw/kafka/topic=market.order.events`
- 체결 이벤트: `hdfs://namenode:9000/raw/kafka/topic=market.trade.events`
- 출력 경로: `hdfs://namenode:9000/analytics/market/news_candidates`

## 배치 실행 예시

```bash
spark-submit \
  --master spark://spark-master:7077 \
  /opt/spark-apps/market_news_signals.py \
  --window-minutes 1 \
  --reference-time 2026-03-22T14:30:00+09:00
```

기본값이 1분이라서 `--window-minutes`를 생략해도 됩니다.

```bash
spark-submit \
  --master spark://spark-master:7077 \
  /opt/spark-apps/market_news_signals.py
```

## Structured Streaming 자동 실행

이 잡은 내부적으로 `rate` 스트림을 heartbeat로 사용해서 1분마다 `foreachBatch`를 실행합니다.

```bash
spark-submit \
  --master spark://spark-master:7077 \
  /opt/spark-apps/market_news_streaming.py \
  --trigger-interval "1 minute" \
  --window-minutes 1 \
  --checkpoint-path /tmp/checkpoints/market-news-stream
```

`docker compose up -d`만으로도 자동 실행되게 하려면 `compose.yaml`에 추가한 `spark-market-news` 서비스를 같이 띄우면 됩니다.

```bash
cd /home/eunsu/S14P21B109/bigdata
docker compose up -d spark-master spark-worker namenode datanode spark-market-news
```

로그 확인:

```bash
docker logs -f spark-market-news
```

## 주요 파라미터

- `--window-minutes`: 최근 구간과 직전 구간의 길이, 기본값 `1`
- `--reference-time`: 집계 기준 시각, 생략하면 실행 시각 사용
- `--min-trade-qty`: 가격/거래량 뉴스 최소 체결량
- `--min-order-qty`: 주문 압력/취소 뉴스 최소 주문량
- `--price-change-threshold`: 가격 급등락 비율 기본값 `0.12`
- `--volume-spike-threshold`: 거래량 급증 비율 기본값 `1.0`
- `--volume-drop-threshold`: 거래량 급감 비율 기본값 `-0.65`
- `--volume-drop-min-previous-qty`: 거래 급감 뉴스 최소 직전 체결량 기본값 `1000`
- `--min-market-activity-qty`: 거래 급감 뉴스가 뜨기 위한 현재 시장 활동량 기본값 `30`
- `--pressure-ratio-threshold`: 매수/매도 쏠림 비율 기본값 `1.8`
- `--cancel-rate-threshold`: 취소 비중 기본값 `0.6`

## 출력 컬럼 예시

- `item_id`
- `signal_type`
- `severity_score`
- `should_publish`
- `headline`
- `summary`
- `reference_time`
- `current_vwap`
- `previous_vwap`
- `current_trade_qty`
- `previous_trade_qty`
- `current_buy_created_qty`
- `current_sell_created_qty`
- `current_cancelled_qty`
- `cancel_rate`
- `dedupe_key`
