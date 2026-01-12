#!/bin/bash

# K6 테스트를 실행하고 HTML 리포트를 자동 생성하는 스크립트
# 사용법: ./run-k6-html.sh

set -e

cd /home/ubuntu/final_project_coreconnect

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_DIR="k6-web-reports"
mkdir -p "$REPORT_DIR"

echo "=========================================="
echo "  🚀 K6 부하 테스트 시작"
echo "=========================================="
echo "  시간: $(date '+%Y-%m-%d %H:%M:%S')"
echo "  호스트: http://coreconnect.io.kr"
echo "=========================================="
echo ""

# K6 테스트 실행
echo "📊 테스트 실행 중..."
K6_HOST=http://coreconnect.io.kr \
USERS_FILE=./users.csv \
k6 run --out json="$REPORT_DIR/result_${TIMESTAMP}.json" test.js

echo ""
echo "=========================================="
echo "  📈 HTML 리포트 생성 중..."
echo "=========================================="

# HTML 리포트 생성
./create-k6-html-report.sh "$REPORT_DIR/result_${TIMESTAMP}.json"

echo ""
echo "=========================================="
echo "  ✅ 테스트 완료!"
echo "=========================================="
echo ""
echo "📂 결과 파일:"
echo "   JSON: $REPORT_DIR/result_${TIMESTAMP}.json"
echo "   HTML: $REPORT_DIR/report_${TIMESTAMP}.html"
echo ""
echo "=========================================="
echo "  🌐 웹 서버 시작"
echo "=========================================="
echo ""
echo "브라우저에서 접속:"
echo "  http://54.116.26.182:8000/$REPORT_DIR/report_${TIMESTAMP}.html"
echo ""
echo "Ctrl+C를 눌러 서버를 종료할 수 있습니다."
echo ""

# 웹 서버 실행
python3 -m http.server 8000
















