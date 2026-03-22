# Market News Generator

`market_news_generator.py`는 Spark가 HDFS에 저장한 시장 뉴스 후보를 읽어서,
LLM으로 기사 문안을 생성한 뒤 `internal_news` 테이블에 적재하는 초안 워커입니다.

## 왜 Spark job으로 분리하지 않았나

- Spark는 집계와 대량 처리에 적합합니다.
- LLM 호출은 건별 네트워크 I/O, 재시도, 중복 억제, DB 트랜잭션 제어가 핵심입니다.
- 그래서 `Spark -> 후보 생성`, `Python worker -> LLM 생성 + DB 저장`으로 나누는 편이 운영상 더 안정적입니다.

## 기본 흐름

1. Spark Structured Streaming이 `hdfs://namenode:9000/analytics/market/news_candidates`에 후보 저장
2. Worker가 최근 후보 파일을 스캔
3. `internal_news` 테이블 기준으로 중복/쿨다운 필터링
4. 가장 강한 후보 1건을 LLM으로 기사 생성
5. `internal_news`에 저장

## 주요 환경변수

- `HDFS_URL`
- `HDFS_USER`
- `NEWS_CANDIDATE_BASE_PATH`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`
- `NEWS_POLL_INTERVAL_SECONDS`
- `NEWS_GLOBAL_COOLDOWN_MINUTES`
- `NEWS_SIGNAL_COOLDOWN_MINUTES`

## 실행 예시

```bash
cd /home/eunsu/S14P21B109/bigdata
python3 spark/jobs/market_news_generator.py
```
