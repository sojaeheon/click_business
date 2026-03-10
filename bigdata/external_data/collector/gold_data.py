import requests
import pandas as pd
from datetime import date

url = "https://apis.data.go.kr/1160100/service/GetGeneralProductInfoService/getGoldPriceInfo"

SERVICE_KEY = "RfDxHtcRP10kd+0JAvCC5wRW+P7wX82vXH2lvRDg7s5I2FeT2sq2/on+txivrwgnr+aCbUCIk3sq5ZrKJiMCtA=="


def fetch_all_gold_data():
    page_no = 1
    num_of_rows = 1000
    all_items = []

    while True:
        params = {
            "serviceKey": SERVICE_KEY,
            "pageNo": page_no,
            "numOfRows": num_of_rows,
            "resultType": "json",
            "beginBasDt": "2015-01-01",
            "endBasDt": date.today().isoformat(),
        }

        res = requests.get(url, params=params, timeout=20)
        res.raise_for_status()
        data = res.json()

        body = data.get("response", {}).get("body", {})
        items = body.get("items", {}).get("item", [])
        total_count = int(body.get("totalCount", 0))

        if isinstance(items, dict):
            items = [items]

        if not items:
            break

        all_items.extend(items)
        print(f"{page_no}페이지 수집 완료 / 누적 {len(all_items)}건")

        if len(all_items) >= total_count:
            break

        page_no += 1

    return all_items


all_data = fetch_all_gold_data()

df = pd.DataFrame(all_data)

# 날짜 컬럼이 있으면 정렬
if "basDt" in df.columns:
    df["basDt"] = pd.to_datetime(df["basDt"], errors="coerce")
    df = df.sort_values("basDt")

df.to_csv("gold_price_2020_to_today.csv", index=False, encoding="utf-8-sig")
print("CSV 저장 완료: gold_price_2020_to_today.csv")
print(f"총 저장 건수: {len(df)}")