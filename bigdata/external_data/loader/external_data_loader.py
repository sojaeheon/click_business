import csv
import os
from decimal import Decimal

import psycopg2
from psycopg2.extras import execute_values

# ------------------------------------------------------------
# 환경변수
# - Docker 내부 실행 기준 기본값으로 설정
# - 로컬 실행 시 .env로 덮어쓰기 가능
# ------------------------------------------------------------
DB_HOST = os.getenv("DB_HOST")  # data/compose.yaml 서비스명
DB_PORT = int(os.getenv("DB_PORT"))
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")

# 컨테이너 내부 경로 기준 기본값
CSV_PATH = os.getenv("CSV_PATH", "/app/external_data/raw/external_index_load.csv")
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "1000"))

# ------------------------------------------------------------
# CSV 필드명 정의 (헤더 검증용)
# ------------------------------------------------------------
REQUIRED_COLUMNS = [
    "item_id",
    "price_date",
    "open_price",
    "close_price",
    "high_price",
    "low_price",
    "fluct_rate",
    "volume",
    "transaction_amount",
    "open_high_fluct_rate",
    "open_low_fluct_rate",
]


# ------------------------------------------------------------
# CSV 한 줄 -> DB row tuple
# ------------------------------------------------------------
def to_row(rec: dict) -> tuple:
    return (
        int(rec["item_id"]),
        rec["price_date"],  # YYYY-MM-DD
        int(rec["open_price"]),
        int(rec["close_price"]),
        int(rec["high_price"]),
        int(rec["low_price"]),
        Decimal(rec["fluct_rate"]) if rec["fluct_rate"] else None,
        int(rec["volume"]) if rec["volume"] else None,
        int(rec["transaction_amount"]) if rec["transaction_amount"] else None,
        Decimal(rec["open_high_fluct_rate"]) if rec["open_high_fluct_rate"] else None,
        Decimal(rec["open_low_fluct_rate"]) if rec["open_low_fluct_rate"] else None,
    )


# ------------------------------------------------------------
# batch upsert SQL
# ------------------------------------------------------------
UPSERT_SQL = """
INSERT INTO external_index (
    item_id,
    price_date,
    open_price,
    close_price,
    high_price,
    low_price,
    fluct_rate,
    volume,
    transaction_amount,
    open_high_fluct_rate,
    open_low_fluct_rate
)
VALUES %s
ON CONFLICT (item_id, price_date) DO UPDATE
SET
    open_price = EXCLUDED.open_price,
    close_price = EXCLUDED.close_price,
    high_price = EXCLUDED.high_price,
    low_price = EXCLUDED.low_price,
    fluct_rate = EXCLUDED.fluct_rate,
    volume = EXCLUDED.volume,
    transaction_amount = EXCLUDED.transaction_amount,
    open_high_fluct_rate = EXCLUDED.open_high_fluct_rate,
    open_low_fluct_rate = EXCLUDED.open_low_fluct_rate
"""


def normalize_record(rec: dict) -> dict:
    # key/value 공백 정리 (헤더/값 오염 방지)
    return {
        (k.strip() if isinstance(k, str) else k): (v.strip() if isinstance(v, str) else v)
        for k, v in rec.items()
    }


def validate_header(fieldnames: list[str]) -> None:
    missing = [c for c in REQUIRED_COLUMNS if c not in fieldnames]
    if missing:
        raise ValueError(f"CSV header mismatch. missing={missing}, got={fieldnames}")


def main():
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
    )
    conn.autocommit = False

    inserted = 0
    batch = []

    try:
        # utf-8-sig: BOM 포함 CSV 대응 (KeyError: 'item_id' 방지 핵심)
        with conn.cursor() as cur, open(CSV_PATH, "r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)

            # 헤더 공백 정리 + 검증
            fieldnames = [(h.strip() if isinstance(h, str) else h) for h in (reader.fieldnames or [])]
            validate_header(fieldnames)

            for rec in reader:
                rec = normalize_record(rec)
                batch.append(to_row(rec))

                if len(batch) >= BATCH_SIZE:
                    execute_values(cur, UPSERT_SQL, batch, page_size=BATCH_SIZE)
                    inserted += len(batch)
                    batch.clear()

            if batch:
                execute_values(cur, UPSERT_SQL, batch, page_size=BATCH_SIZE)
                inserted += len(batch)

        conn.commit()
        print(f"[OK] upsert completed. rows={inserted}, file={CSV_PATH}")

    except Exception as e:
        conn.rollback()
        print(f"[ERROR] load failed: {e}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
