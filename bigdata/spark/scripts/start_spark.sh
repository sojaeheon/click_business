#!/bin/bash
set -e

SPARK_MASTER_URL="${SPARK_MASTER_URL:-spark://spark-master:7077}"
JOB_PATH="${JOB_PATH:-/opt/spark-apps/company_valutation_stream.py}"

# 파일명 오타 대응 (company_valuation_stream.py fallback)
if [ ! -f "$JOB_PATH" ] && [ -f "/opt/spark-apps/company_valuation_stream.py" ]; then
  JOB_PATH="/opt/spark-apps/company_valuation_stream.py"
fi

if [ ! -f "$JOB_PATH" ]; then
  echo "[ERROR] Spark job file not found: $JOB_PATH"
  exit 1
fi

echo "[INFO] submit job: $JOB_PATH"
exec /opt/spark/bin/spark-submit \
  --master "$SPARK_MASTER_URL" \
  "$JOB_PATH"
