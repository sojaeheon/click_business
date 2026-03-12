# KBS News Crawler

## 1. Overview
- KBS 뉴스 검색 API를 활용하여 특정 키워드와 기간에 해당하는 뉴스 데이터를 수집하는 크롤러입니다.
- 뉴스 목록 API와 기사 상세 페이지를 함께 크롤링하여 제목, 날짜, 기자, 본문, 이미지, 링크 등의 정보를 CSV 파일로 저장합니다.
- 수집된 데이터는 이후 데이터 분석, 자연어 처리 등에 활용할 수 있습니다.

## 2. Data Collection Scope
수집 대상
- 언론사: KBS
- 기간: 2020 ~ 2025
- 데이터 유형: 뉴스 기사
- 수집 키워드
    - 금 관련: 금값, 금 가격, 금 시세, 금 투자, 금 ETF
    - 금리 관련: 금리, 기준 금리, 예금 금리, 대출 금리, 한국 금리

## 3. Collected Data Schema
수집된 데이터는 다음 구조로 저장됩니다.

| Column | Description |
| ---------------- | --------------- |
| Title	| 기사 제목 |
| Source | 언론사 (KBS) |
| Date | 기사 작성일 |
| Reporter | 기자 이름 |
| Content | 기사 본문 |
| ImageURL | 기사 이미지 링크 |
| URL | 기사 원문 링크 |

## 4. Project Structure
| 파일               | 설명              |
| ---------------- | --------------- |
| news_crawler.py  | 뉴스 수집 파일       |
| requirements.txt | Python 라이브러리 |
| crawler_env      | Python 가상환경     |
| README.md | 환경설정 파일 |


## 5. Environment Setup
```
# 파이썬 버전 확인
python --version

# 가상환경 생성
python -m venv crawler_env

# 가상환경 활성화
source crawler_env/bin/activate

# 라이브러리 설치
pip install -r requirements.txt

# 라이브러리 저장
pip freeze > requirements.txt

# 주피터 커널 등록
python -m ipykernel install --user --name crawler_env --display-name "Python (crawler_env)"

# 파이썬 파일 실행
python news_crawler.py
```

## 6. Crawling Process
```
Keyword Loop
    ↓
KBS Search API Request
    ↓
Total Page Calculation
    ↓
Page Iteration
    ↓
News List Collection
    ↓
Year Filtering
    ↓
Article Page Crawling
    ↓
Content + Image Extraction
    ↓
DataFrame 생성
    ↓
CSV 저장
```