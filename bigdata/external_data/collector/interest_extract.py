import requests
import pandas as pd

API_KEY = "555PM9M9KTXGK1K9YA3Y"

STAT_CODE = "722Y001"
CYCLE = "D"
START_DATE = "20200101"
END_DATE = "20251231"

ITEMS = {
    "0101000": "한국은행 기준금리",
    "0105000": "자금조정 예금금리",
    "0104000": "자금조정 대출금리",
}

def fetch_ecos_data(api_key, stat_code, cycle, start_date, end_date, item_code):
    url = (
        f"https://ecos.bok.or.kr/api/StatisticSearch/"
        f"{api_key}/json/kr/1/10000/"
        f"{stat_code}/{cycle}/{start_date}/{end_date}/{item_code}"
    )

    res = requests.get(url, timeout=30)
    res.raise_for_status()
    data = res.json()

    # 에러 또는 데이터 없음 처리
    if "RESULT" in data:
        print(f"[{item_code}] API 응답:", data["RESULT"])
        return pd.DataFrame()

    rows = data.get("StatisticSearch", {}).get("row", [])
    if not rows:
        print(f"[{item_code}] 조회 결과 없음")
        return pd.DataFrame()

    df = pd.DataFrame(rows)
    return df

all_dfs = []

for item_code, item_name in ITEMS.items():
    df = fetch_ecos_data(
        api_key=API_KEY,
        stat_code=STAT_CODE,
        cycle=CYCLE,
        start_date=START_DATE,
        end_date=END_DATE,
        item_code=item_code,
    )

    if not df.empty:
        df["item_code"] = item_code
        df["item_name_kr"] = item_name
        all_dfs.append(df)

if all_dfs:
    result = pd.concat(all_dfs, ignore_index=True)

    # 필요한 컬럼만 정리
    keep_cols = [
        "TIME",
        "DATA_VALUE",
        "item_code",
        "item_name_kr",
        "STAT_CODE",
        "STAT_NAME",
        "UNIT_NAME",
    ]
    keep_cols = [c for c in keep_cols if c in result.columns]
    result = result[keep_cols]

    # 숫자형 변환
    if "DATA_VALUE" in result.columns:
        result["DATA_VALUE"] = pd.to_numeric(result["DATA_VALUE"], errors="coerce")

    # 저장
    result.to_csv("korea_interest_rates_day_2020_2025.csv", index=False, encoding="utf-8-sig")
    print("저장 완료: korea_interest_rates_day_2020_2025.csv")
    print(result.head())
else:
    print("조회된 데이터가 없습니다.")