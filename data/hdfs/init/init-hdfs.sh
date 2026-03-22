#!/bin/bash
set -e

# -----------------------------
# HDFS 데이터 레이크 디렉터리 생성
# -----------------------------

# 원천 데이터 저장
hdfs dfs -mkdir -p /data/raw

# 전처리 데이터
hdfs dfs -mkdir -p /data/processed

# 분석용 데이터
hdfs dfs -mkdir -p /data/analytics


# -----------------------------
# 개발 환경 권한 설정
# -----------------------------
hdfs dfs -chmod -R 777 /data


# -----------------------------
# 디렉터리 확인
# -----------------------------
hdfs dfs -ls /
hdfs dfs -ls /data