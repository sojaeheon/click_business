import csv
import os
from pathlib import Path

import psycopg2

def get_env(name, default=None):
    value = os.getenv(name, default)
    if value is None:
        raise ValueError(f"Missing required env: {name}")
    return value


def get_int_env(name, default=None):
    value = get_env(name, default)
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Invalid integer env {name}: {value}") from exc


# PostgreSQL 연결 정보
conn = psycopg2.connect(
    host=get_env("DB_HOST", "localhost"),
    port=get_int_env("DB_PORT", "5432"),
    dbname=get_env("DB_NAME", "ecosim"),
    user=get_env("DB_USER", "ecosim"),
    password=get_env("DB_PASSWORD", "ecosim"),
)
cur = conn.cursor()

file_path = Path(
    get_env(
        "PROCESSED_NEWS_CSV_PATH",
        str(
            Path(__file__).resolve().parent.parent
            / "storage"
            / "processed"
            / "Refined_news.csv"
        ),
    )
)

if not file_path.exists():
    print(f"{file_path} 파일이 존재하지 않습니다. 경로를 다시 확인해주세요.")
    raise SystemExit(1)

print("🚀 데이터 적재를 시작합니다...")

# external_news 테이블이 없으면 생성
cur.execute(
    """
    CREATE TABLE IF NOT EXISTS external_news (
        external_news_id BIGSERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        content TEXT NOT NULL,
        published_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """
)
conn.commit()

with file_path.open(newline="", encoding="utf-8-sig") as csvfile:
    reader = csv.DictReader(csvfile)

    count = 0
    for row in reader:
        cur.execute(
            """
            INSERT INTO external_news (
                title,
                content,
                published_at
            ) VALUES (
                %(Neutral_Title)s,
                %(Refined_Content)s,
                %(Date)s
            )
            """,
            {
                "Neutral_Title": row["Neutral_Title"],
                "Refined_Content": row["Refined_Content"],
                "Date": row["Date"],
            },
        )
        count += 1
        if count % 1000 == 0:
            print(f"✅ {count}개 적재 중...")

conn.commit()
cur.close()
conn.close()

print(f"🎉 주입 완료! 총 {count}개의 데이터가 external_news 테이블에 적재되었습니다.")
