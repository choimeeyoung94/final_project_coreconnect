#!/bin/bash

# CoreConnect 전체 성능 테스트 실행 스크립트

echo "=========================================="
echo "  CoreConnect 성능 테스트 시작"
echo "=========================================="
echo ""

# 환경 변수 설정 (필요시 수정)
export BASE_URL="${BASE_URL:-http://localhost:8080}"
export WS_URL="${WS_URL:-ws://localhost:8080}"

echo "테스트 대상: $BASE_URL"
echo ""

# 결과 디렉토리 생성
RESULTS_DIR="results/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$RESULTS_DIR"

echo "결과 저장 경로: $RESULTS_DIR"
echo ""

# 1. 채팅 기능 테스트
echo "=========================================="
echo "  1/3 채팅 기능 테스트 시작..."
echo "=========================================="
k6 run --out json="$RESULTS_DIR/chat-results.json" chat-test.js
echo ""

# 2. 알림 기능 테스트
echo "=========================================="
echo "  2/3 알림 기능 테스트 시작..."
echo "=========================================="
k6 run --out json="$RESULTS_DIR/notification-results.json" notification-test.js
echo ""

# 3. 이메일 기능 테스트
echo "=========================================="
echo "  3/3 이메일 기능 테스트 시작..."
echo "=========================================="
k6 run --out json="$RESULTS_DIR/email-results.json" email-test.js
echo ""

# 요약 결과 복사
cp chat-test-summary.json "$RESULTS_DIR/" 2>/dev/null
cp notification-test-summary.json "$RESULTS_DIR/" 2>/dev/null
cp email-test-summary.json "$RESULTS_DIR/" 2>/dev/null

echo "=========================================="
echo "  모든 테스트 완료!"
echo "=========================================="
echo ""
echo "결과 파일:"
ls -lh "$RESULTS_DIR"
echo ""
echo "테스트 결과를 확인하려면 다음 파일들을 열어보세요:"
echo "  - $RESULTS_DIR/chat-results.json"
echo "  - $RESULTS_DIR/notification-results.json"
echo "  - $RESULTS_DIR/email-results.json"
echo ""
