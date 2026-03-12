로컬에서 DB에 데이터 적재하는 방법
```
# PostgreSQL 접속
psql -h localhost -p 5432 -U ecosim -d ecosim

# 테이블 생성
CREATE TABLE external_news (
    external_news_id BIGINT PRIMARY KEY,
    keyword VARCHAR(200),
    title VARCHAR(200),
    source VARCHAR(200),
    reporter VARCHAR(200),
    content TEXT,
    url VARCHAR(500),
    image_url VARCHAR(500),
    published_at TIMESTAMP
);

CREATE SEQUENCE external_news_seq START 1;

# 테이블 확인
\dt

---

# 데이터 적재
python3 news_loader.py
```