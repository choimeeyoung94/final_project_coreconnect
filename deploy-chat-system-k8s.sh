#!/bin/bash
# Chat System Kubernetes 배포 스크립트
# 10만명 동시접속 지원 아키텍처

set -e  # 에러 발생 시 중단

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 로그 함수
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 진행 상황 표시
show_progress() {
    echo -e "${GREEN}>>> $1${NC}"
}

# 함수: 네임스페이스 생성
create_namespace() {
    show_progress "1. 네임스페이스 생성"
    
    if kubectl get namespace chat-system &> /dev/null; then
        log_warn "네임스페이스 'chat-system'이 이미 존재합니다."
    else
        kubectl create namespace chat-system
        log_info "네임스페이스 'chat-system' 생성 완료"
    fi
    
    # 네임스페이스 레이블 추가
    kubectl label namespace chat-system name=chat-system --overwrite
}

# 함수: MySQL 배포
deploy_mysql() {
    show_progress "2. MySQL 배포"
    
    log_info "MySQL StatefulSet 배포 중..."
    kubectl apply -f k8s/01-mysql.yaml
    
    log_info "MySQL 준비 대기 중..."
    kubectl wait --for=condition=ready pod -l app=mysql -n chat-system --timeout=300s
    
    log_info "MySQL 배포 완료"
}

# 함수: Redis Cluster 배포
deploy_redis() {
    show_progress "3. Redis Cluster 배포"
    
    log_info "Redis StatefulSet 배포 중..."
    kubectl apply -f k8s/redis-cluster-statefulset.yaml
    
    log_info "Redis Pod 준비 대기 중..."
    kubectl wait --for=condition=ready pod -l app=redis-cluster -n chat-system --timeout=300s
    
    log_info "Redis Cluster 초기화 중..."
    sleep 10
    kubectl apply -f k8s/redis-cluster-statefulset.yaml
    
    log_info "Redis Cluster 배포 완료"
}

# 함수: Kafka Cluster 배포
deploy_kafka() {
    show_progress "4. Kafka Cluster 배포"
    
    log_info "Zookeeper 배포 중..."
    kubectl apply -f k8s/kafka-cluster-statefulset.yaml
    
    log_info "Zookeeper 준비 대기 중..."
    kubectl wait --for=condition=ready pod -l app=zookeeper -n chat-system --timeout=300s
    
    log_info "Kafka 배포 중..."
    sleep 10  # Zookeeper 안정화 대기
    
    log_info "Kafka Pod 준비 대기 중..."
    kubectl wait --for=condition=ready pod -l app=kafka -n chat-system --timeout=300s
    
    log_info "Kafka 토픽 생성 중..."
    sleep 30  # Kafka 안정화 대기
    
    log_info "Kafka Cluster 배포 완료"
}

# 함수: Chat Service 배포
deploy_chat_service() {
    show_progress "5. Chat Service 배포"
    
    log_info "Chat Service Deployment 배포 중..."
    kubectl apply -f k8s/chat-service-optimized.yaml
    
    log_info "Chat Service Pod 준비 대기 중..."
    kubectl wait --for=condition=ready pod -l app=chat-service -n chat-system --timeout=300s
    
    log_info "Chat Service 배포 완료"
}

# 함수: 모니터링 도구 배포
deploy_monitoring() {
    show_progress "6. 모니터링 도구 배포 (선택사항)"
    
    read -p "Prometheus & Grafana를 배포하시겠습니까? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Prometheus 배포 중..."
        kubectl apply -f k8s/monitoring/prometheus.yaml
        
        log_info "Grafana 배포 중..."
        kubectl apply -f k8s/monitoring/grafana.yaml
        
        log_info "모니터링 도구 배포 완료"
    else
        log_warn "모니터링 도구 배포 건너뜀"
    fi
}

# 함수: 배포 상태 확인
check_deployment() {
    show_progress "7. 배포 상태 확인"
    
    echo ""
    log_info "=== Pod 상태 ==="
    kubectl get pods -n chat-system -o wide
    
    echo ""
    log_info "=== Service 상태 ==="
    kubectl get svc -n chat-system
    
    echo ""
    log_info "=== PVC 상태 ==="
    kubectl get pvc -n chat-system
    
    echo ""
    log_info "=== HPA 상태 ==="
    kubectl get hpa -n chat-system
    
    echo ""
    log_info "=== 리소스 사용량 ==="
    kubectl top pods -n chat-system 2>/dev/null || log_warn "Metrics Server가 설치되지 않았습니다"
}

# 함수: 접속 정보 출력
show_access_info() {
    show_progress "8. 접속 정보"
    
    echo ""
    log_info "=== Chat Service 접속 정보 ==="
    
    # LoadBalancer IP 조회
    EXTERNAL_IP=$(kubectl get svc chat-service -n chat-system -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null)
    
    if [ -z "$EXTERNAL_IP" ]; then
        EXTERNAL_IP=$(kubectl get svc chat-service -n chat-system -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null)
    fi
    
    if [ -z "$EXTERNAL_IP" ]; then
        log_warn "LoadBalancer IP가 아직 할당되지 않았습니다."
        log_info "다음 명령어로 확인하세요: kubectl get svc chat-service -n chat-system"
    else
        echo ""
        echo "🚀 Chat Service URL: http://${EXTERNAL_IP}"
        echo "📊 Actuator URL: http://${EXTERNAL_IP}:8081/actuator"
        echo "💬 WebSocket URL: ws://${EXTERNAL_IP}/ws/chat"
    fi
    
    echo ""
    log_info "=== Port Forward로 로컬 접속 ==="
    echo "Chat Service: kubectl port-forward -n chat-system svc/chat-service 8080:80"
    echo "Grafana: kubectl port-forward -n chat-system svc/grafana 3000:3000"
    echo "Prometheus: kubectl port-forward -n chat-system svc/prometheus 9090:9090"
}

# 함수: 테스트 실행
run_test() {
    show_progress "9. 부하 테스트 (선택사항)"
    
    read -p "부하 테스트를 실행하시겠습니까? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "K6 부하 테스트 실행 중..."
        
        if command -v k6 &> /dev/null; then
            k6 run --vus 1000 --duration 5m k6-chat-load-test.js
            log_info "부하 테스트 완료"
        else
            log_error "K6가 설치되지 않았습니다. 설치 방법: brew install k6"
        fi
    else
        log_warn "부하 테스트 건너뜀"
    fi
}

# 함수: 정리 (삭제)
cleanup() {
    show_progress "전체 리소스 삭제"
    
    read -p "정말로 모든 리소스를 삭제하시겠습니까? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_warn "삭제 중..."
        
        kubectl delete namespace chat-system
        
        log_info "삭제 완료"
    else
        log_info "취소됨"
    fi
}

# 함수: 롤백
rollback() {
    show_progress "이전 버전으로 롤백"
    
    log_info "Chat Service 롤백 중..."
    kubectl rollout undo deployment/chat-service -n chat-system
    
    log_info "롤백 완료"
    kubectl rollout status deployment/chat-service -n chat-system
}

# 함수: 스케일 조정
scale() {
    local replicas=$1
    
    if [ -z "$replicas" ]; then
        log_error "replica 수를 지정해주세요. 예: ./deploy.sh scale 20"
        exit 1
    fi
    
    show_progress "Chat Service 스케일 조정: $replicas replicas"
    
    kubectl scale deployment chat-service -n chat-system --replicas=$replicas
    
    log_info "스케일 조정 완료"
    kubectl get pods -n chat-system -l app=chat-service
}

# 함수: 로그 확인
logs() {
    show_progress "Chat Service 로그 확인"
    
    kubectl logs -f -n chat-system -l app=chat-service --tail=100
}

# 메인 배포 함수
main() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════╗"
    echo "║   Chat System Kubernetes 배포                        ║"
    echo "║   10만명 동시접속 지원 아키텍처                       ║"
    echo "╚═══════════════════════════════════════════════════════╝"
    echo ""
    
    # 사전 확인
    log_info "사전 확인 중..."
    
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl이 설치되지 않았습니다."
        exit 1
    fi
    
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Kubernetes 클러스터에 연결할 수 없습니다."
        exit 1
    fi
    
    log_info "사전 확인 완료"
    echo ""
    
    # 배포 시작
    create_namespace
    deploy_mysql
    deploy_redis
    deploy_kafka
    deploy_chat_service
    deploy_monitoring
    
    # 배포 확인
    check_deployment
    show_access_info
    run_test
    
    echo ""
    echo "╔═══════════════════════════════════════════════════════╗"
    echo "║   배포 완료! 🎉                                      ║"
    echo "╚═══════════════════════════════════════════════════════╝"
    echo ""
    
    log_info "다음 단계:"
    echo "  1. 서비스 상태 확인: kubectl get all -n chat-system"
    echo "  2. 로그 확인: ./deploy-chat-system-k8s.sh logs"
    echo "  3. 스케일 조정: ./deploy-chat-system-k8s.sh scale 20"
    echo "  4. 롤백: ./deploy-chat-system-k8s.sh rollback"
    echo "  5. 삭제: ./deploy-chat-system-k8s.sh cleanup"
}

# 커맨드 라인 인자 처리
case "${1:-deploy}" in
    deploy)
        main
        ;;
    cleanup|delete)
        cleanup
        ;;
    rollback)
        rollback
        ;;
    scale)
        scale $2
        ;;
    logs)
        logs
        ;;
    status)
        check_deployment
        ;;
    access)
        show_access_info
        ;;
    test)
        run_test
        ;;
    *)
        echo "사용법: $0 {deploy|cleanup|rollback|scale|logs|status|access|test}"
        echo ""
        echo "명령어:"
        echo "  deploy    - 전체 시스템 배포 (기본값)"
        echo "  cleanup   - 전체 리소스 삭제"
        echo "  rollback  - 이전 버전으로 롤백"
        echo "  scale N   - replica 수 조정"
        echo "  logs      - 실시간 로그 확인"
        echo "  status    - 배포 상태 확인"
        echo "  access    - 접속 정보 출력"
        echo "  test      - 부하 테스트 실행"
        exit 1
        ;;
esac










