import re
import json
import time
import requests
import pandas as pd
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util.retry import Retry

### 크롤링 기본 설정 ###
KEYWORDS = ["금값", "금 가격", "금 시세", "금 투자", "금 ETF"] # 금 관련 검색 키워드
KEYWORDS = ["금리", "기준 금리", "예금 금리", "대출 금리", "한국 금리"] # 금리 관련 검색 키워드
START_YEAR = 2020 # 수집 시작 기간
END_YEAR = 2025 # 수집 종료 기간
PAGE_SIZE = 10 # 페이지 당 반환하는 뉴스 개수
DELAY = 0.5 # 요청 딜레이
API_URL = "https://reco.kbs.co.kr/v2/search" # KBS 뉴스 검색 API

### Requests 세션 및 재시도 설정 ###
session = requests.Session()
retry = Retry(total=5, backoff_factor=1, status_forcelist=[500, 502, 503, 504])
adapter = HTTPAdapter(max_retries=retry)
session.mount("http://", adapter)
session.mount("https://", adapter)

headers = {"User-Agent": "Mozilla/5.0"}

all_news = [] # 결과

### 키워드별 수집 ###
for KEYWORD in KEYWORDS:
    print(f"=== 수집 시작: '{KEYWORD}' ===")

    # 파라미터 설정
    params = {
        "target": "newstotal",
        "keyword": KEYWORD,
        "page_size": PAGE_SIZE,
        "page": 1,
        "sort_option": "date",
        "callback": "SearchNewsList"
    }

    # API 요청 및 JSONP -> JSON 변환
    try:
        response = session.get(API_URL, params=params, headers=headers, timeout=10)
        match = re.search(r'\((.*)\)', response.text)
        data = json.loads(match.group(1))
    except Exception as e:
        print(f"키워드 '{KEYWORD}' 초기 요청 실패: {e}")
        continue

    # 전체 뉴스 개수 계산
    total_count = data.get("total_count", 0)
    print(f"총 뉴스 개수: {total_count}")

    # 전체 페이지 계산
    total_pages = (total_count + PAGE_SIZE - 1) // PAGE_SIZE
    print(f"총 페이지 수: {total_pages}")

    # 페이지 별 반복 크롤링
    for page in range(1, total_pages + 1):
        print(f"{KEYWORD} 수집 중: {page}/{total_pages} 페이지")
        params["page"] = page

        # 뉴스 목록 가져오기
        try:
            response = session.get(API_URL, params=params, headers=headers, timeout=10)
            match = re.search(r'\((.*)\)', response.text)
            if not match:
                print("JSONP 패턴 매칭 실패")
                continue
            data = json.loads(match.group(1))
            news_list = data.get("data", [])
        except Exception as e:
            print(f"페이지 {page} 요청 실패: {e}, 3초 후 재시도")
            time.sleep(3)
            continue

        # 뉴스 별 반복 크롤링
        for item in news_list:
            # 작성일
            rdatetime = item.get("rdatetime", "")
            if not rdatetime or not rdatetime[:4].isdigit():
                continue
            year = int(rdatetime[:4])
            if year < START_YEAR or year > END_YEAR:
                continue

            # 링크
            url = item.get("target_url")

            # 뉴스 상세 페이지 가져오기
            try:
                res = session.get(url, headers=headers, timeout=10)
                soup = BeautifulSoup(res.text, "html.parser")

                # 본문
                content_tag = soup.select_one("#cont_newstext")
                content = content_tag.get_text(separator="\n").strip() if content_tag else ""

                # 이미지
                img_tag = soup.select_one(".news-photo img") or \
                          soup.select_one(".article img") or \
                          soup.select_one("figure img")
                if img_tag:
                    image_url = img_tag.get("src") or img_tag.get("data-src") or ""
                else:
                    image_url = ""

            except Exception as e:
                print(f"상세 페이지 요청 실패: {url}, 이유: {e}")
                content = ""
                image_url = ""

            # 뉴스 데이터
            news_data = {
                "Title": item.get("title"),
                "Source": "KBS",
                "Date": rdatetime,
                "Reporter": item.get("reporter"),
                "Content": content,
                "ImageURL": image_url,
                "URL": url
            }
            all_news.append(news_data)

            time.sleep(DELAY)

### CSV 저장 ###
df = pd.DataFrame(all_news, columns=["Title", "Source", "Date", "Reporter", "Content", "ImageURL", "URL"])
df.to_csv("../raw/kbs_news_gold_2020_2025.csv", index=False, encoding="utf-8-sig") # 금
df.to_csv("../raw/kbs_news_interest_2020_2025.csv", index=False, encoding="utf-8-sig") # 금리
print("CSV 저장 완료")