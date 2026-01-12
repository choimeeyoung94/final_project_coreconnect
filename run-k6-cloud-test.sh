#!/bin/bash

# ==========================================
# k6 부하 테스트 실행 스크립트 (k6 Cloud)
# ==========================================

echo "🚀 k6 부하 테스트 시작..."
echo ""

# 환경 변수 확인
if [ -z "$K6_CLOUD_PROJECT_ID" ]; then
    echo "⚠️  K6_CLOUD_PROJECT_ID가 설정되지 않았습니다."
    echo "   export K6_CLOUD_PROJECT_ID=6156169"
    exit 1
fi

if [ -z "$K6_CLOUD_TOKEN" ]; then
    echo "⚠️  K6_CLOUD_TOKEN이 설정되지 않았습니다."
    echo "   k6 login cloud 명령으로 로그인하거나"
    echo "   export K6_CLOUD_TOKEN=YOUR_TOKEN 으로 설정하세요."
    exit 1
fi

# 기본값 설정
export BASE_URL=${BASE_URL:-http://54.116.26.182:8080}
export USER_EMAIL=${USER_EMAIL:-admin@coreconnect.io.kr}
export USER_PASSWORD=${USER_PASSWORD:-1}
export LOGIN_PATH=${LOGIN_PATH:-/api/v1/auth/login}
export CHAT_LIST_PATH=${CHAT_LIST_PATH:-/api/v1/chat/rooms/messages/latest}
export K6_TEST_NAME=${K6_TEST_NAME:-"Chatroom Performance Test"}

echo "📋 테스트 설정:"
echo "   BASE_URL: $BASE_URL"
echo "   LOGIN_PATH: $LOGIN_PATH"
echo "   CHAT_LIST_PATH: $CHAT_LIST_PATH"
echo "   USER_EMAIL: $USER_EMAIL"
echo "   PROJECT_ID: $K6_CLOUD_PROJECT_ID"
echo ""

# 스크립트 파일 확인
SCRIPT_FILE="k6-chatroom-performance-test.js"
if [ ! -f "$SCRIPT_FILE" ]; then
    echo "❌ 테스트 스크립트를 찾을 수 없습니다: $SCRIPT_FILE"
    exit 1
fi

echo "✅ 테스트 스크립트 확인: $SCRIPT_FILE"
echo ""

# k6 실행 (Cloud 업로드)
echo "🏃 k6 실행 중... (결과는 k6 Cloud/Grafana로 업로드됩니다)"
echo ""

k6 run --out cloud "$SCRIPT_FILE"

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo "✅ 테스트 완료!"
    echo "📊 결과 확인: https://app.k6.io/projects/$K6_CLOUD_PROJECT_ID"
else
    echo ""
    echo "❌ 테스트 실패 (종료 코드: $EXIT_CODE)"
    echo ""
    echo "🔍 문제 해결:"
    echo "   1. 서버가 실행 중인지 확인: curl $BASE_URL/actuator/health"
    echo "   2. 로그인이 가능한지 확인: curl -X POST $BASE_URL$LOGIN_PATH -H 'Content-Type: application/json' -d '{\"email\":\"$USER_EMAIL\",\"password\":\"$USER_PASSWORD\"}'"
    echo "   3. k6 Cloud 토큰이 유효한지 확인: k6 login cloud"
    exit $EXIT_CODE
fi

echo ""
echo "📈 성능 목표 달성 여부:"
echo "   - P95 Latency < 500ms"
echo "   - P99 Latency < 1000ms"
echo "   - 에러율 < 1%"
echo "   - RPS 10-15+ (20 VU 기준)"
echo ""
echo "🎯 Grafana에서 'Compare with' 기능으로 개선 전/후 비교하세요!"







