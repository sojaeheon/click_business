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

file_path = 'Refined_news.csv'
path = Path(file_path)

if not path.exists():
    print(f"{file_path} 파일이 존재하지 않습니다. 경로를 다시 확인해주세요.")
    exit()

print("🚀 데이터 적재를 시작합니다...")

# external_news 테이블이 없으면 생성
cur.execute("""
    CREATE TABLE IF NOT EXISTS external_news (
        external_news_id BIGSERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        content TEXT NOT NULL,
        published_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
""")
conn.commit()

with open(path, newline='', encoding='utf-8-sig') as csvfile:
    reader = csv.DictReader(csvfile)
    
    count = 0
    for row in reader:
        cur.execute("""
            INSERT INTO external_news (
                title,
                content,
                published_at
            ) VALUES (
                %(Neutral_Title)s,
                %(Refined_Content)s,
                %(Date)s
            )
        """, {
            'Neutral_Title': row['Neutral_Title'],
            'Refined_Content': row['Refined_Content'],
            'Date': row['Date']
        })
        count += 1
        if count % 1000 == 0:
            print(f"✅ {count}개 적재 중...")

conn.commit()
cur.close()
conn.close()

print(f"🎉 주입 완료! 총 {count}개의 데이터가 external_news 테이블에 적재되었습니다.")
