#!/bin/bash

################################################################################
# 🏥 CoreConnect 헬스체크 스크립트
#
# 용도: CI/CD 파이프라인에서 배포 후 시스템 정상 작동 확인
# 사용법: ./healthcheck.sh [OPTIONS]
#
# Options:
#   --max-retries    최대 재시도 횟수 (기본값: 30)
#   --interval       재시도 간격(초) (기본값: 2)
#   --timeout        전체 타임아웃(초) (기본값: 120)
#   --host           호스트 주소 (기본값: localhost)
#   --port           포트 (기본값: 80)
#   --backend-port   백엔드 포트 (기본값: 8080)
#   --verbose        상세 로그 출력
################################################################################

set -e  # 오류 발생 시 즉시 종료

# ============================================================================
# 🔧 설정 변수
# ============================================================================

MAX_RETRIES=30
RETRY_INTERVAL=2
TIMEOUT=120
HOST="localhost"
PORT=80
BACKEND_PORT=8080
VERBOSE=false
BACKEND_CONTAINER="boot-container"
FRONTEND_CONTAINER="nginx-container"

# 색상 코드
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# 📝 로깅 함수
# ============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_verbose() {
    if [ "$VERBOSE" = true ]; then
        echo -e "${BLUE}[DEBUG]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
    fi
}

# ============================================================================
# 🛠️ 파라미터 파싱
# ============================================================================

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --max-retries)
                MAX_RETRIES="$2"
                shift 2
                ;;
            --interval)
                RETRY_INTERVAL="$2"
                shift 2
                ;;
            --timeout)
                TIMEOUT="$2"
                shift 2
                ;;
            --host)
                HOST="$2"
                shift 2
                ;;
            --port)
                PORT="$2"
                shift 2
                ;;
            --backend-port)
                BACKEND_PORT="$2"
                shift 2
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --max-retries NUM     최대 재시도 횟수 (기본값: 30)"
                echo "  --interval SEC        재시도 간격(초) (기본값: 2)"
                echo "  --timeout SEC         전체 타임아웃(초) (기본값: 120)"
                echo "  --host HOST           호스트 주소 (기본값: localhost)"
                echo "  --port PORT           포트 (기본값: 80)"
                echo "  --backend-port PORT   백엔드 포트 (기본값: 8080)"
                echo "  --verbose             상세 로그 출력"
                echo "  --help                도움말 출력"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
}

# ============================================================================
# 🐳 Docker 컨테이너 상태 확인
# ============================================================================

check_container_status() {
    local container_name=$1

    log_verbose "컨테이너 상태 확인: $container_name"

    if docker ps --format '{{.Names}}' | grep -q "^${container_name}$"; then
        local status=$(docker inspect --format='{{.State.Status}}' "$container_name" 2>/dev/null)
        local health=$(docker inspect --format='{{.State.Health.Status}}' "$container_name" 2>/dev/null || echo "none")

        log_verbose "  - Status: $status"
        log_verbose "  - Health: $health"

        if [ "$status" = "running" ]; then
            return 0
        else
            log_warning "컨테이너가 실행 중이 아닙니다: $container_name (상태: $status)"
            return 1
        fi
    else
        log_warning "컨테이너를 찾을 수 없습니다: $container_name"
        return 1
    fi
}

# ============================================================================
# 🔌 Backend 포트 체크 (TCP)
# ============================================================================

check_backend_port() {
    log_verbose "Backend 포트 체크 시작 (${BACKEND_PORT})"

    if docker exec "$BACKEND_CONTAINER" nc -z localhost "$BACKEND_PORT" 2>/dev/null; then
        log_verbose "Backend 포트 열림: $BACKEND_PORT"
        return 0
    else
        log_verbose "Backend 포트 닫힘: $BACKEND_PORT"
        return 1
    fi
}

# ============================================================================
# 🏥 Backend 헬스체크 API 호출
# ============================================================================

check_backend_health_api() {
    log_verbose "Backend 헬스체크 API 호출 중..."

    # /api/health 엔드포인트 호출
    local response=$(curl -s -o /dev/null -w "%{http_code}" \
        --connect-timeout 5 \
        --max-time 10 \
        "http://${HOST}:${PORT}/api/health" 2>/dev/null)

    log_verbose "  - HTTP Status Code: $response"

    if [ "$response" = "200" ]; then
        # 상세 응답 확인 (verbose 모드)
        if [ "$VERBOSE" = true ]; then
            local body=$(curl -s --connect-timeout 5 --max-time 10 \
                "http://${HOST}:${PORT}/api/health" 2>/dev/null)
            log_verbose "  - Response: $body"
        fi
        return 0
    else
        log_verbose "Backend 헬스체크 API 실패 (HTTP $response)"
        return 1
    fi
}

# ============================================================================
# 🌐 Frontend 접근 확인
# ============================================================================

check_frontend() {
    log_verbose "Frontend 접근 확인 중..."

    local response=$(curl -s -o /dev/null -w "%{http_code}" \
        --connect-timeout 5 \
        --max-time 10 \
        "http://${HOST}:${PORT}/" 2>/dev/null)

    log_verbose "  - HTTP Status Code: $response"

    if [ "$response" = "200" ] || [ "$response" = "304" ]; then
        return 0
    else
        log_verbose "Frontend 접근 실패 (HTTP $response)"
        return 1
    fi
}

# ============================================================================
# 📊 상세 헬스체크 (DB 연결 포함)
# ============================================================================

check_detailed_health() {
    log_verbose "상세 헬스체크 API 호출 중..."

    local response=$(curl -s --connect-timeout 5 --max-time 10 \
        "http://${HOST}:${PORT}/api/health/detailed" 2>/dev/null)

    if [ $? -eq 0 ]; then
        log_verbose "  - Response: $response"

        # JSON 파싱 (jq가 있으면)
        if command -v jq &> /dev/null; then
            local db_status=$(echo "$response" | jq -r '.data.database' 2>/dev/null || echo "unknown")
            log_verbose "  - Database Status: $db_status"

            if [ "$db_status" = "UP" ]; then
                return 0
            else
                log_warning "데이터베이스 연결 상태가 좋지 않습니다: $db_status"
                return 1
            fi
        else
            # jq가 없으면 grep으로 확인
            if echo "$response" | grep -q '"database":"UP"'; then
                return 0
            else
                return 1
            fi
        fi
    else
        log_verbose "상세 헬스체크 API 호출 실패"
        return 1
    fi
}

# ============================================================================
# 📝 컨테이너 로그 출력
# ============================================================================

print_container_logs() {
    local container_name=$1
    local tail_lines=${2:-50}

    log_info "컨테이너 로그 (${container_name}):"
    echo "========================================"
    docker logs --tail="$tail_lines" "$container_name" 2>&1 || true
    echo "========================================"
}

# ============================================================================
# 🎯 전체 헬스체크 실행
# ============================================================================

run_healthcheck() {
    local start_time=$(date +%s)
    local retry_count=0

    log_info "헬스체크 시작"
    log_info "설정: MAX_RETRIES=$MAX_RETRIES, INTERVAL=${RETRY_INTERVAL}s, TIMEOUT=${TIMEOUT}s"
    log_info "대상: http://${HOST}:${PORT}"
    echo ""

    # 1단계: 컨테이너 상태 확인
    log_info "1단계: Docker 컨테이너 상태 확인"
    if ! check_container_status "$BACKEND_CONTAINER"; then
        log_error "Backend 컨테이너가 실행 중이 아닙니다"
        print_container_logs "$BACKEND_CONTAINER" 100
        return 1
    fi
    log_success "✓ Backend 컨테이너 실행 중"

    if ! check_container_status "$FRONTEND_CONTAINER"; then
        log_error "Frontend 컨테이너가 실행 중이 아닙니다"
        print_container_logs "$FRONTEND_CONTAINER" 100
        return 1
    fi
    log_success "✓ Frontend 컨테이너 실행 중"
    echo ""

    # 2단계: Backend 포트 확인 (재시도 로직)
    log_info "2단계: Backend 포트 확인 (재시도)"
    retry_count=0
    while [ $retry_count -lt $MAX_RETRIES ]; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))

        # 타임아웃 체크
        if [ $elapsed -gt $TIMEOUT ]; then
            log_error "타임아웃 발생 (${TIMEOUT}초 초과)"
            print_container_logs "$BACKEND_CONTAINER" 100
            return 1
        fi

        if check_backend_port; then
            log_success "✓ Backend 포트 열림 (${BACKEND_PORT})"
            break
        fi

        retry_count=$((retry_count + 1))
        log_info "재시도 중... ($retry_count/$MAX_RETRIES)"
        sleep "$RETRY_INTERVAL"
    done

    if [ $retry_count -ge $MAX_RETRIES ]; then
        log_error "Backend 포트가 열리지 않았습니다 (${MAX_RETRIES}회 시도)"
        print_container_logs "$BACKEND_CONTAINER" 100
        return 1
    fi
    echo ""

    # 3단계: Backend 헬스체크 API (재시도 로직)
    log_info "3단계: Backend 헬스체크 API 호출 (재시도)"
    retry_count=0
    while [ $retry_count -lt $MAX_RETRIES ]; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))

        if [ $elapsed -gt $TIMEOUT ]; then
            log_error "타임아웃 발생 (${TIMEOUT}초 초과)"
            print_container_logs "$BACKEND_CONTAINER" 100
            return 1
        fi

        if check_backend_health_api; then
            log_success "✓ Backend 헬스체크 API 정상 (GET /api/health)"
            break
        fi

        retry_count=$((retry_count + 1))
        log_info "재시도 중... ($retry_count/$MAX_RETRIES)"
        sleep "$RETRY_INTERVAL"
    done

    if [ $retry_count -ge $MAX_RETRIES ]; then
        log_error "Backend 헬스체크 API 호출 실패 (${MAX_RETRIES}회 시도)"
        print_container_logs "$BACKEND_CONTAINER" 100
        return 1
    fi
    echo ""

    # 4단계: Frontend 접근 확인
    log_info "4단계: Frontend 접근 확인"
    if check_frontend; then
        log_success "✓ Frontend 접근 정상"
    else
        log_warning "Frontend 접근 실패 (치명적이지 않음)"
    fi
    echo ""

    # 5단계: 상세 헬스체크 (DB 연결 확인)
    log_info "5단계: 상세 헬스체크 (DB 연결)"
    if check_detailed_health; then
        log_success "✓ 데이터베이스 연결 정상"
    else
        log_warning "데이터베이스 연결 확인 실패 (선택사항)"
    fi
    echo ""

    # 최종 결과
    local end_time=$(date +%s)
    local total_elapsed=$((end_time - start_time))

    echo "========================================"
    log_success "🎉 모든 헬스체크 통과!"
    log_info "총 소요 시간: ${total_elapsed}초"
    echo "========================================"

    # 요약 로그 출력
    if [ "$VERBOSE" = true ]; then
        echo ""
        log_info "컨테이너 상태 요약:"
        docker ps --filter "name=${BACKEND_CONTAINER}" --filter "name=${FRONTEND_CONTAINER}" \
            --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    fi

    return 0
}

# ============================================================================
# 🚀 메인 실행
# ============================================================================

main() {
    parse_arguments "$@"

    if run_healthcheck; then
        exit 0
    else
        log_error "헬스체크 실패"
        exit 1
    fi
}

# 스크립트 실행
main "$@"
