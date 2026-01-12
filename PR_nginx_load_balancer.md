# feat: Add Nginx Load Balancer for 100K Concurrent Users

## 📋 변경사항

### 추가된 파일
- `nginx/nginx.conf`: 10만명 동시접속을 위한 Nginx 로드 밸런서 설정

## 🎯 주요 기능

### 1️⃣ 10대 서버 로드 밸런싱
- **Upstream 설정**: chat-app-1 ~ chat-app-10 (10대 서버)
- **알고리즘**: `least_conn` (연결 수 기반 분산)
- **장애 복구**: `max_fails=3`, `fail_timeout=30s`
- **가중치**: 모든 서버 동일 (weight=1)

### 2️⃣ 대용량 동시 연결 처리
- **Worker Connections**: 10,000개
- **최적화**: epoll (Linux), multi_accept
- **목표**: 10만명 동시접속 지원 (서버당 1만명)

### 3️⃣ WebSocket 장시간 연결 지원
- **타임아웃**: 7일 (proxy_read_timeout, proxy_send_timeout)
- **버퍼링 비활성화**: 실시간 메시지 전송
- **Keepalive**: 연결 재사용으로 성능 향상

### 4️⃣ 성능 최적화
- ✅ Gzip 압축 (텍스트 기반 콘텐츠)
- ✅ Keepalive 연결 유지
- ✅ 프록시 버퍼 최적화
- ✅ 에러 자동 복구 (proxy_next_upstream)

### 5️⃣ 모니터링 & 헬스체크
- `/health`: 서비스 상태 확인
- `/nginx_status`: Nginx 통계 (stub_status)
- `/actuator`: Spring Boot Actuator 프록시

## 📊 성능 목표

| 항목 | AS-IS | TO-BE |
|------|-------|-------|
| **최대 동시 접속** | 10,000명 ❌ | 100,000명 ✅ |
| **메시지 전송 시간** | 1,000초 | 100초 (10배 개선) |
| **장애 대응** | 서비스 중단 | 자동 failover |

## 🔗 관련 문서
- 10만명_동시접속_채팅방_아키텍처.md
- 서버_스케일_아웃_10대_구축_가이드.md

## ✅ 체크리스트
- [x] 10대 서버 upstream 설정 완료
- [x] Least connection 알고리즘 적용
- [x] WebSocket 프록시 설정 완료
- [x] 타임아웃 설정 (7일)
- [x] Gzip 압축 활성화
- [x] 헬스체크 엔드포인트 추가
- [x] 모니터링 엔드포인트 추가
- [x] 에러 처리 및 자동 복구 설정

## 🚀 배포 방법
```bash
# Docker Compose로 실행
docker-compose up -d nginx

# 설정 테스트
docker exec nginx nginx -t

# 설정 리로드
docker exec nginx nginx -s reload
```

## 📝 커밋 정보
- **브랜치**: `feature_scale-out-10-servers`
- **커밋 해시**: `7ac9015`
- **타겟 브랜치**: `main`

