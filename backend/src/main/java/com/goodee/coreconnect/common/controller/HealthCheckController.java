package com.goodee.coreconnect.common.controller;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.goodee.coreconnect.common.dto.response.ResponseDTO;

import lombok.extern.slf4j.Slf4j;

import javax.sql.DataSource;
import java.sql.Connection;

/**
 * 헬스체크 컨트롤러
 * - AWS ELB 헬스체크용 엔드포인트 제공
 * - CI/CD 배포 시 애플리케이션 상태 확인
 */
@Slf4j
@RestController
@RequestMapping("/api")
public class HealthCheckController {

    @Autowired(required = false)
    private DataSource dataSource;

    /**
     * 기본 헬스체크 (AWS ELB 헬스체크용)
     * - 인증 불필요, 빠른 응답
     * - ELB가 주기적으로 호출하여 서버 상태 확인
     * 
     * @return HTTP 200 OK - 서비스 정상
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> healthCheck() {
        Map<String, String> response = new HashMap<>();
        response.put("status", "UP");
        response.put("service", "CoreConnect Backend");
        
        // 로그는 최소화 (ELB가 자주 호출하므로)
        log.debug("[HealthCheck] ELB 헬스체크 요청 - 상태: UP");
        
        return ResponseEntity.ok(response);
    }

    /**
     * 상세 헬스체크 (DB 연결 상태 확인 포함)
     * - DB 연결 상태 확인
     * - 실제 서비스 가용성 검증
     * - CI/CD에서 배포 후 확인용
     * 
     * @return HTTP 200 OK - 모든 서비스 정상
     *         HTTP 503 Service Unavailable - 일부 서비스 오류
     */
    @GetMapping("/health/detailed")
    public ResponseEntity<ResponseDTO<Map<String, Object>>> detailedHealthCheck() {
        Map<String, Object> healthStatus = new HashMap<>();
        boolean isHealthy = true;

        // 1. 기본 정보
        healthStatus.put("timestamp", LocalDateTime.now());
        healthStatus.put("service", "CoreConnect Backend");

        // 2. DB 연결 상태 확인
        if (dataSource != null) {
            try (Connection conn = dataSource.getConnection()) {
                healthStatus.put("database", "UP");
                healthStatus.put("databaseType", conn.getMetaData().getDatabaseProductName());
                log.debug("[DetailedHealthCheck] DB 연결 성공");
            } catch (Exception e) {
                healthStatus.put("database", "DOWN");
                healthStatus.put("databaseError", e.getMessage());
                isHealthy = false;
                log.error("[DetailedHealthCheck] DB 연결 실패", e);
            }
        } else {
            healthStatus.put("database", "NOT_CONFIGURED");
            log.warn("[DetailedHealthCheck] DataSource가 구성되지 않음");
        }

        // 3. 전체 상태
        healthStatus.put("status", isHealthy ? "UP" : "DOWN");

        if (isHealthy) {
            log.info("[DetailedHealthCheck] 모든 상태 정상");
            return ResponseEntity.ok(
                ResponseDTO.success(healthStatus, "모든 서비스가 정상 작동 중입니다.")
            );
        } else {
            log.error("[DetailedHealthCheck] 일부 서비스 오류 발생");
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(ResponseDTO.<Map<String, Object>>builder()
                    .status(HttpStatus.SERVICE_UNAVAILABLE.value())
                    .message("일부 서비스에 문제가 발생했습니다.")
                    .data(healthStatus)
                    .build());
        }
    }

    /**
     * Liveness Probe (애플리케이션이 살아있는지 확인)
     * - Kubernetes liveness probe와 유사
     * - 애플리케이션이 응답 가능한 상태인지 확인
     * 
     * @return HTTP 200 OK - 애플리케이션 실행 중
     */
    @GetMapping("/health/live")
    public ResponseEntity<Map<String, String>> livenessCheck() {
        Map<String, String> response = new HashMap<>();
        response.put("status", "ALIVE");
        log.debug("[LivenessCheck] 애플리케이션 실행 중");
        return ResponseEntity.ok(response);
    }

    /**
     * Readiness Probe (트래픽을 받을 준비가 되었는지 확인)
     * - Kubernetes readiness probe와 유사
     * - DB 연결 등 필수 서비스 준비 상태 확인
     * 
     * @return HTTP 200 OK - 트래픽 수신 준비 완료
     *         HTTP 503 Service Unavailable - 준비되지 않음
     */
    @GetMapping("/health/ready")
    public ResponseEntity<Map<String, String>> readinessCheck() {
        Map<String, String> response = new HashMap<>();
        
        // DB 연결 확인
        if (dataSource != null) {
            try (Connection conn = dataSource.getConnection()) {
                if (conn.isValid(2)) { // 2초 타임아웃
                    response.put("status", "READY");
                    response.put("database", "CONNECTED");
                    log.debug("[ReadinessCheck] 서비스 준비 완료");
                    return ResponseEntity.ok(response);
                }
            } catch (Exception e) {
                log.error("[ReadinessCheck] DB 연결 실패", e);
                response.put("status", "NOT_READY");
                response.put("database", "DISCONNECTED");
                return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(response);
            }
        }
        
        // DataSource가 없어도 기본적으로는 준비된 것으로 간주
        response.put("status", "READY");
        return ResponseEntity.ok(response);
    }
}
