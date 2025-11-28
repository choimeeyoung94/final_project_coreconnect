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

import jakarta.persistence.EntityManager;
import lombok.extern.slf4j.Slf4j;

/**
 * 🏥 헬스체크 컨트롤러
 * CI/CD 파이프라인에서 배포 후 시스템이 정상 동작하는지 확인
 * 스타트업 수준의 모니터링 필수 기능
 */
@Slf4j
@RestController
@RequestMapping("/api/health")
public class HealthCheckController {

    @Autowired(required = false)
    private EntityManager entityManager;

    /**
     * 기본 헬스체크 - 서버가 살아있는지만 확인
     * GET /api/health
     */
    @GetMapping
    public ResponseEntity<ResponseDTO<Map<String, Object>>> health() {
        Map<String, Object> healthInfo = new HashMap<>();
        healthInfo.put("status", "UP");
        healthInfo.put("timestamp", LocalDateTime.now());
        healthInfo.put("service", "CoreConnect");

        return ResponseEntity.ok(
            ResponseDTO.<Map<String, Object>>builder()
                .status(HttpStatus.OK.value())
                .message("서버가 정상 작동 중입니다.")
                .data(healthInfo)
                .build()
        );
    }

    /**
     * 상세 헬스체크 - DB 연결, 외부 서비스 등 확인
     * GET /api/health/detailed
     *
     * 📌 Checked Exception 처리 예시:
     * - DB 연결 실패 시 복구 가능한 상황이므로 try-catch로 처리
     */
    @GetMapping("/detailed")
    public ResponseEntity<ResponseDTO<Map<String, Object>>> detailedHealth() {
        Map<String, Object> healthInfo = new HashMap<>();
        healthInfo.put("timestamp", LocalDateTime.now());
        healthInfo.put("service", "CoreConnect");

        // ✅ DB 연결 확인 (Checked Exception 처리)
        boolean dbStatus = checkDatabaseConnection();
        healthInfo.put("database", dbStatus ? "UP" : "DOWN");

        // ✅ 전체 시스템 상태
        boolean isHealthy = dbStatus;
        healthInfo.put("status", isHealthy ? "UP" : "DEGRADED");

        if (isHealthy) {
            return ResponseEntity.ok(
                ResponseDTO.<Map<String, Object>>builder()
                    .status(HttpStatus.OK.value())
                    .message("모든 시스템이 정상 작동 중입니다.")
                    .data(healthInfo)
                    .build()
            );
        } else {
            // 서비스는 동작하지만 일부 기능에 문제가 있을 때 (DEGRADED)
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(
                    ResponseDTO.<Map<String, Object>>builder()
                        .status(HttpStatus.SERVICE_UNAVAILABLE.value())
                        .message("일부 서비스에 문제가 발생했습니다.")
                        .data(healthInfo)
                        .build()
                );
        }
    }

    /**
     * 🔍 DB 연결 상태 확인
     * Checked Exception 처리 예시: DB 연결은 외부 시스템 의존성이므로 복구 가능
     */
    private boolean checkDatabaseConnection() {
        try {
            if (entityManager == null) {
                log.warn("EntityManager가 주입되지 않았습니다.");
                return false;
            }

            // 간단한 쿼리로 DB 연결 확인
            entityManager.createNativeQuery("SELECT 1").getSingleResult();
            log.debug("데이터베이스 연결 정상");
            return true;

        } catch (Exception e) {
            // ⚠️ Checked Exception 처리: DB 연결 실패는 심각하지만 복구 가능
            // 애플리케이션은 계속 동작하되, 모니터링 시스템에 알림
            log.error("데이터베이스 연결 실패 - 관리자 확인 필요: {}", e.getMessage());
            return false;
        }
    }

    /**
     * 🔥 Readiness Probe (Kubernetes/ECS용)
     * - 애플리케이션이 트래픽을 받을 준비가 되었는지 확인
     * - 준비되지 않았으면 503 반환
     */
    @GetMapping("/ready")
    public ResponseEntity<Map<String, Object>> readiness() {
        Map<String, Object> readinessInfo = new HashMap<>();

        boolean isReady = checkDatabaseConnection();
        readinessInfo.put("ready", isReady);
        readinessInfo.put("timestamp", LocalDateTime.now());

        if (isReady) {
            return ResponseEntity.ok(readinessInfo);
        } else {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(readinessInfo);
        }
    }

    /**
     * 💓 Liveness Probe (Kubernetes/ECS용)
     * - 애플리케이션이 살아있는지만 확인
     * - 죽었으면 컨테이너 재시작
     */
    @GetMapping("/live")
    public ResponseEntity<Map<String, Object>> liveness() {
        Map<String, Object> livenessInfo = new HashMap<>();
        livenessInfo.put("alive", true);
        livenessInfo.put("timestamp", LocalDateTime.now());

        return ResponseEntity.ok(livenessInfo);
    }
}
