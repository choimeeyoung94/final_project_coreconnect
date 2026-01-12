#!/bin/bash

# ========================================
# 채팅방 목록 조회 N+1 문제 성능 측정 스크립트
# ========================================

set -e

echo "=========================================="
echo "📊 채팅방 목록 조회 N+1 문제 성능 측정"
echo "=========================================="
echo ""

# 환경 변수 설정
export BASE_URL="${BASE_URL:-http://54.116.26.182:8080}"
export WS_URL="${WS_URL:-ws://54.116.26.182:8080}"

# 테스트 타입 선택
TEST_TYPE="${1:-cloud}"

if [ "$TEST_TYPE" = "cloud" ]; then
  echo "🌩️  K6 Cloud로 테스트 실행"
  echo "   - Grafana 대시보드 자동 생성"
  echo "   - 실시간 성능 모니터링"
  echo "   - 테스트 결과 URL 자동 출력"
  echo ""
  
  # K6 Cloud 토큰 확인
  if [ -z "$K6_CLOUD_TOKEN" ]; then
    echo "⚠️  K6_CLOUD_TOKEN 환경 변수가 설정되지 않았습니다."
    echo "   다음 명령어로 설정하세요:"
    echo "   export K6_CLOUD_TOKEN='your-token-here'"
    echo ""
    exit 1
  fi
  
  echo "✅ K6 Cloud 토큰 확인 완료"
  echo ""
  echo "🚀 테스트 시작..."
  echo ""
  
  k6 cloud chatroom-list-n-plus-1-test.js \
    -e BASE_URL="$BASE_URL" \
    -e WS_URL="$WS_URL"
    
elif [ "$TEST_TYPE" = "local" ]; then
  echo "💻 로컬에서 테스트 실행"
  echo "   - 로컬 머신에서 부하 생성"
  echo "   - JSON 결과 파일 생성"
  echo ""
  
  k6 run chatroom-list-n-plus-1-test.js \
    -e BASE_URL="$BASE_URL" \
    -e WS_URL="$WS_URL" \
    --out json=chatroom-list-test-result.json
    
  echo ""
  echo "✅ 테스트 완료!"
  echo "   결과 파일: chatroom-list-test-result.json"
  echo ""
  
elif [ "$TEST_TYPE" = "html" ]; then
  echo "📄 HTML 리포트 생성 모드"
  echo "   - 로컬에서 테스트 실행"
  echo "   - HTML 리포트 자동 생성"
  echo ""
  
  # k6 실행
  k6 run chatroom-list-n-plus-1-test.js \
    -e BASE_URL="$BASE_URL" \
    -e WS_URL="$WS_URL" \
    --out json=chatroom-list-test-result.json
  
  # HTML 리포트 생성 (k6-reporter 필요)
  if command -v k6-to-junit &> /dev/null; then
    echo ""
    echo "📊 HTML 리포트 생성 중..."
    k6-to-junit chatroom-list-test-result.json > chatroom-list-test-report.xml
    echo "✅ 리포트 생성 완료: chatroom-list-test-report.xml"
  else
    echo "⚠️  k6-to-junit이 설치되지 않아 HTML 리포트를 생성할 수 없습니다."
    echo "   설치: npm install -g k6-to-junit"
  fi
  
else
  echo "❌ 잘못된 테스트 타입: $TEST_TYPE"
  echo ""
  echo "사용법:"
  echo "  ./run-chatroom-list-test.sh [cloud|local|html]"
  echo ""
  echo "예시:"
  echo "  ./run-chatroom-list-test.sh cloud   # K6 Cloud로 실행"
  echo "  ./run-chatroom-list-test.sh local   # 로컬에서 실행"
  echo "  ./run-chatroom-list-test.sh html    # HTML 리포트 생성"
  exit 1
fi

echo ""
echo "=========================================="
echo "✅ 완료!"
echo "=========================================="










