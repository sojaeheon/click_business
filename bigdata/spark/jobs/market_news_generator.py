import json
import os
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Dict, Iterable, List, Optional
from urllib import error, request

import psycopg2
from hdfs import InsecureClient
from psycopg2.extras import RealDictCursor


HDFS_URL = os.getenv("HDFS_URL", "http://namenode:9870")
HDFS_USER = os.getenv("HDFS_USER", "root")
NEWS_CANDIDATE_BASE_PATH = os.getenv(
    "NEWS_CANDIDATE_BASE_PATH",
    "/analytics/market/news_candidates",
)
NEWS_SCAN_LOOKBACK_HOURS = int(os.getenv("NEWS_SCAN_LOOKBACK_HOURS", "2"))
NEWS_POLL_INTERVAL_SECONDS = int(os.getenv("NEWS_POLL_INTERVAL_SECONDS", "60"))

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "ecosim")
DB_USER = os.getenv("DB_USER", "ecosim")
DB_PASSWORD = os.getenv("DB_PASSWORD", "ecosim")

NEWS_GLOBAL_COOLDOWN_MINUTES = int(os.getenv("NEWS_GLOBAL_COOLDOWN_MINUTES", "30"))
NEWS_SIGNAL_COOLDOWN_MINUTES = int(os.getenv("NEWS_SIGNAL_COOLDOWN_MINUTES", "30"))
NEWS_MIN_SEVERITY_SCORE = float(os.getenv("NEWS_MIN_SEVERITY_SCORE", "85.0"))

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.getenv(
    "OPENAI_BASE_URL",
    "https://api.openai.com/v1/chat/completions",
)
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
OPENAI_TIMEOUT_SECONDS = int(os.getenv("OPENAI_TIMEOUT_SECONDS", "20"))


@dataclass
class Candidate:
    item_id: int
    signal_type: str
    severity_score: float
    headline: str
    summary: str
    reference_time: str
    dedupe_key: str
    raw: Dict[str, Any]


def get_db_connection():
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
    )


def list_paths_recursive(client: InsecureClient, root_path: str) -> Iterable[str]:
    try:
        entries = client.list(root_path, status=True)
    except Exception:
        return []

    results: List[str] = []
    for name, status in entries:
        full_path = f"{root_path.rstrip('/')}/{name}"
        if status["type"] == "DIRECTORY":
            results.extend(list_paths_recursive(client, full_path))
        elif name.endswith(".json"):
            results.append(full_path)
    return results


def parse_reference_time(value: str) -> datetime:
    normalized = value.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(normalized)
    except ValueError:
        return datetime.strptime(value, "%Y-%m-%d %H:%M:%S")


def load_recent_candidates(client: InsecureClient) -> List[Candidate]:
    now = datetime.now()
    cutoff = now - timedelta(hours=NEWS_SCAN_LOOKBACK_HOURS)
    candidates: List[Candidate] = []

    for path in list_paths_recursive(client, NEWS_CANDIDATE_BASE_PATH):
        try:
            with client.read(path, encoding="utf-8") as reader:
                for line in reader:
                    line = line.strip()
                    if not line:
                        continue

                    payload = json.loads(line)
                    reference_time = parse_reference_time(payload["reference_time"])
                    if reference_time < cutoff:
                        continue

                    candidates.append(
                        Candidate(
                            item_id=int(payload["item_id"]),
                            signal_type=payload["signal_type"],
                            severity_score=float(payload["severity_score"]),
                            headline=payload["headline"],
                            summary=payload["summary"],
                            reference_time=payload["reference_time"],
                            dedupe_key=payload["dedupe_key"],
                            raw=payload,
                        )
                    )
        except Exception as exc:
            print(f"[NEWS-WORKER] failed to read candidate file path={path} error={exc}")

    deduped = {candidate.dedupe_key: candidate for candidate in candidates}
    return sorted(
        deduped.values(),
        key=lambda candidate: candidate.severity_score,
        reverse=True,
    )


def has_recent_news(cur) -> bool:
    cur.execute(
        """
        SELECT EXISTS (
            SELECT 1
            FROM internal_news
            WHERE published_at >= NOW() - (%s || ' minutes')::interval
        ) AS exists
        """,
        (NEWS_GLOBAL_COOLDOWN_MINUTES,),
    )
    return bool(cur.fetchone()["exists"])


def is_duplicate_or_cooling_down(cur, candidate: Candidate) -> bool:
    cur.execute(
        """
        SELECT EXISTS (
            SELECT 1
            FROM internal_news
            WHERE dedupe_key = %s
        ) AS exists
        """,
        (candidate.dedupe_key,),
    )
    if cur.fetchone()["exists"]:
        return True

    cur.execute(
        """
        SELECT EXISTS (
            SELECT 1
            FROM internal_news
            WHERE item_id = %s
              AND signal_type = %s
              AND published_at >= NOW() - (%s || ' minutes')::interval
        ) AS exists
        """,
        (candidate.item_id, candidate.signal_type, NEWS_SIGNAL_COOLDOWN_MINUTES),
    )
    return bool(cur.fetchone()["exists"])


def get_item_name(cur, item_id: int) -> str:
    cur.execute("SELECT name FROM item WHERE item_id = %s", (item_id,))
    row = cur.fetchone()
    if not row:
        raise ValueError(f"item_id={item_id} does not exist")
    return row["name"]


def build_prompt(candidate: Candidate, item_name: str) -> str:
    raw = candidate.raw
    return f"""
아이템 이름: {item_name}
시그널: {candidate.signal_type}
심각도: {candidate.severity_score}
기준 시각: {candidate.reference_time}
헤드라인 초안: {candidate.headline}
요약 초안: {candidate.summary}
현재 거래량: {raw.get("current_trade_qty")}
직전 거래량: {raw.get("previous_trade_qty")}
현재 VWAP: {raw.get("current_vwap")}
직전 VWAP: {raw.get("previous_vwap")}
현재 매수 주문량: {raw.get("current_buy_created_qty")}
현재 매도 주문량: {raw.get("current_sell_created_qty")}
현재 취소량: {raw.get("current_cancelled_qty")}

너는 게임 내 경제 뉴스를 작성하는 기자다.
한국어로 짧은 기사 한 건을 작성하라.
응답은 반드시 JSON으로만 하고, 필드는 title, summary, content 를 포함하라.
title은 40자 이내, summary는 80자 이내, content는 2~4문장으로 작성하라.
"""


def generate_article_with_llm(candidate: Candidate, item_name: str) -> Dict[str, str]:
    if not OPENAI_API_KEY:
        return generate_article_with_template(candidate, item_name)

    body = {
        "model": OPENAI_MODEL,
        "messages": [
            {
                "role": "system",
                "content": "You are an in-game economic news writer. Return JSON only.",
            },
            {
                "role": "user",
                "content": build_prompt(candidate, item_name),
            },
        ],
        "temperature": 0.7,
    }

    http_request = request.Request(
        OPENAI_BASE_URL,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {OPENAI_API_KEY}",
        },
        method="POST",
    )

    try:
        with request.urlopen(http_request, timeout=OPENAI_TIMEOUT_SECONDS) as response:
            payload = json.loads(response.read().decode("utf-8"))
            content = payload["choices"][0]["message"]["content"]
            return json.loads(content)
    except Exception as exc:
        print(f"[NEWS-WORKER] llm generation failed, fallback template used: {exc}")
        return generate_article_with_template(candidate, item_name)


def generate_article_with_template(candidate: Candidate, item_name: str) -> Dict[str, str]:
    raw = candidate.raw
    return {
        "title": f"[시장속보] {item_name} {candidate.signal_type}",
        "summary": candidate.summary,
        "content": (
            f"{item_name} 시장에서 {candidate.signal_type} 신호가 감지되었습니다. "
            f"기준 시각은 {candidate.reference_time}이며 심각도는 {candidate.severity_score:.1f}입니다. "
            f"현재 거래량은 {raw.get('current_trade_qty', 0)}, 직전 거래량은 {raw.get('previous_trade_qty', 0)}로 집계되었습니다."
        ),
    }


def insert_internal_news(cur, candidate: Candidate, article: Dict[str, str], item_name: str) -> None:
    cur.execute(
        """
        INSERT INTO internal_news (
            item_id,
            signal_type,
            title,
            summary,
            content,
            severity_score,
            reference_time,
            published_at,
            dedupe_key,
            llm_model,
            source_metrics_json
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s::timestamp, NOW(), %s, %s, %s
        )
        """,
        (
            candidate.item_id,
            candidate.signal_type,
            article["title"],
            article["summary"],
            article["content"],
            candidate.severity_score,
            parse_reference_time(candidate.reference_time).strftime("%Y-%m-%d %H:%M:%S"),
            candidate.dedupe_key,
            OPENAI_MODEL if OPENAI_API_KEY else "template-fallback",
            json.dumps(
                {
                    "item_name": item_name,
                    "candidate": candidate.raw,
                },
                ensure_ascii=False,
            ),
        ),
    )


def process_once() -> None:
    hdfs_client = InsecureClient(HDFS_URL, user=HDFS_USER)
    candidates = load_recent_candidates(hdfs_client)

    if not candidates:
        print("[NEWS-WORKER] no recent candidates")
        return

    with get_db_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            if has_recent_news(cur):
                print("[NEWS-WORKER] global cooldown active")
                return

            for candidate in candidates:
                if candidate.severity_score < NEWS_MIN_SEVERITY_SCORE:
                    continue
                if is_duplicate_or_cooling_down(cur, candidate):
                    continue

                item_name = get_item_name(cur, candidate.item_id)
                article = generate_article_with_llm(candidate, item_name)
                insert_internal_news(cur, candidate, article, item_name)
                conn.commit()
                print(
                    f"[NEWS-WORKER] inserted internal news "
                    f"item_id={candidate.item_id} signal={candidate.signal_type} "
                    f"severity={candidate.severity_score}"
                )
                return

            print("[NEWS-WORKER] no candidate passed filters")


def main() -> None:
    print("[NEWS-WORKER] started")
    while True:
        try:
            process_once()
        except Exception as exc:
            print(f"[NEWS-WORKER] cycle failed: {exc}")
        time.sleep(NEWS_POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
