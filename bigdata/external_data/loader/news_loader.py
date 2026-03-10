import csv
import psycopg2
from pathlib import Path

# PostgreSQL 연결 정보
conn = psycopg2.connect(
    host="localhost",
    port=5432,
    dbname="ecosim",
    user="ecosim",
    password="ecosim"
)
cur = conn.cursor()

# CSV 파일 경로와 키워드 매핑
files = {
    '../raw/kbs_news_gold_2020_2025.csv': 'gold',
    '../raw/kbs_news_interest_2020_2025.csv': 'interest'
}

# 시퀀스 생성
cur.execute("""
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'external_news_seq') THEN
            CREATE SEQUENCE external_news_seq START 1;
        END IF;
    END
    $$;
""")
conn.commit()

for file_path, keyword in files.items():
    path = Path(file_path)
    if not path.exists():
        print(f"{file_path} 존재하지 않음")
        continue

    with open(path, newline='', encoding='utf-8-sig') as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            # 삽입
            cur.execute("""
                INSERT INTO external_news (
                    external_news_id,
                    keyword,
                    title,
                    source,
                    reporter,
                    content,
                    url,
                    image_url,
                    published_at
                ) VALUES (
                    nextval('external_news_seq'),
                    %(keyword)s,
                    %(Title)s,
                    %(Source)s,
                    %(Reporter)s,
                    %(Content)s,
                    %(URL)s,
                    %(ImageURL)s,
                    %(Date)s
                )
            """, {**row, 'keyword': keyword})

conn.commit()
cur.close()
conn.close()
print("CSV 데이터 삽입 완료")