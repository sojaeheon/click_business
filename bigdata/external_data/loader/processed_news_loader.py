import csv
import os
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_values


DB_HOST = os.getenv("DB_HOST", "postgres-db")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "ecosim")
DB_USER = os.getenv("DB_USER", "ecosim")
DB_PASSWORD = os.getenv("DB_PASSWORD", "ecosim")
CSV_PATH = Path(
    os.getenv(
        "NEWS_CSV_PATH",
        "/app/external_data/storage/processed/Refined_news.csv",
    )
)
BATCH_SIZE = int(os.getenv("NEWS_LOAD_BATCH_SIZE", "500"))


INSERT_SQL = """
INSERT INTO external_news (title, content, published_at)
SELECT input.title, input.content, input.published_at::timestamp
FROM (VALUES %s) AS input(title, content, published_at)
WHERE NOT EXISTS (
    SELECT 1
    FROM external_news existing
    WHERE existing.title = input.title
      AND existing.published_at = input.published_at::timestamp
)
"""


def main() -> None:
    if not CSV_PATH.exists():
        raise FileNotFoundError(f"News CSV does not exist: {CSV_PATH}")

    connection = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
    )
    inserted = 0

    try:
        with connection.cursor() as cursor, CSV_PATH.open(
            newline="", encoding="utf-8-sig"
        ) as csv_file:
            reader = csv.DictReader(csv_file)
            batch = []
            for row in reader:
                batch.append(
                    (
                        row["Neutral_Title"].strip(),
                        row["Refined_Content"].strip(),
                        row["Date"].strip(),
                    )
                )
                if len(batch) >= BATCH_SIZE:
                    execute_values(cursor, INSERT_SQL, batch, page_size=BATCH_SIZE)
                    inserted += cursor.rowcount
                    batch.clear()

            if batch:
                execute_values(cursor, INSERT_SQL, batch, page_size=BATCH_SIZE)
                inserted += cursor.rowcount

        connection.commit()
        print(f"[NEWS-LOADER] completed inserted={inserted} file={CSV_PATH}")
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


if __name__ == "__main__":
    main()
