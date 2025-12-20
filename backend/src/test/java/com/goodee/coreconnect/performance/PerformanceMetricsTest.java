package com.goodee.coreconnect.performance;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 성능 메트릭 분석 유틸리티 테스트
 * 
 * 실제 사용 예시를 보여주는 테스트 클래스
 */
@DisplayName("성능 메트릭 분석 테스트")
class PerformanceMetricsTest {

    @Test
    @DisplayName("로그 파일 분석 및 Before/After 비교")
    void testLogAnalysisAndComparison() {
        // Given: 로그 분석기 생성
        MetricsAnalyzer analyzer = new MetricsAnalyzer();

        // When: Before/After 로그 파일 분석
        // 실제 파일 경로로 변경 필요
        String beforeLogPath = "logs/before_optimization.log";
        String afterLogPath = "logs/after_optimization.log";

        // 주석 처리: 실제 로그 파일이 있을 때만 실행
        /*
        MetricsAnalyzer.PerformanceMetrics before = analyzer.analyzeLogFile(beforeLogPath);
        MetricsAnalyzer.PerformanceMetrics after = analyzer.analyzeLogFile(afterLogPath);

        // Then: 결과 출력
        analyzer.printComparison(before, after);

        // 검증
        assertThat(after.getFileUploadSuccessRate())
            .isGreaterThan(before.getFileUploadSuccessRate());
        assertThat(after.getNotificationAvgLatency())
            .isLessThan(before.getNotificationAvgLatency());
        */
    }

    @Test
    @DisplayName("JMeter 결과 파일 분석")
    void testJMeterResultAnalysis() {
        // Given: JMeter 결과 분석기 생성
        JMeterResultAnalyzer analyzer = new JMeterResultAnalyzer();

        // When: JMeter CSV 결과 파일 분석
        // 실제 파일 경로로 변경 필요
        String jmeterResultPath = "results.jtl";

        // 주석 처리: 실제 JMeter 결과 파일이 있을 때만 실행
        /*
        JMeterResultAnalyzer.JMeterMetrics metrics = analyzer.analyzeJMeterResult(jmeterResultPath);

        // Then: 결과 출력
        analyzer.printSummary(metrics);

        // 검증
        assertThat(metrics.getSuccessRate()).isGreaterThan(95.0);
        assertThat(metrics.getAvgResponseTime()).isLessThan(500);
        */
    }

    @Test
    @DisplayName("통합 분석: 로그 + JMeter 결과")
    void testIntegratedAnalysis() {
        // 실제 사용 예시:
        /*
        // 1. 로그 파일 분석
        MetricsAnalyzer logAnalyzer = new MetricsAnalyzer();
        MetricsAnalyzer.PerformanceMetrics logMetrics = logAnalyzer.analyzeLogFile("logs/test.log");

        // 2. JMeter 결과 분석
        JMeterResultAnalyzer jmeterAnalyzer = new JMeterResultAnalyzer();
        JMeterResultAnalyzer.JMeterMetrics jmeterMetrics = jmeterAnalyzer.analyzeJMeterResult("results.jtl");

        // 3. 통합 리포트 생성
        System.out.println("=== 통합 성능 리포트 ===");
        System.out.println("\n애플리케이션 로그 메트릭:");
        System.out.printf("  파일 업로드 성공률: %.2f%%\n", logMetrics.getFileUploadSuccessRate());
        System.out.printf("  알림 평균 지연시간: %.2fms\n", logMetrics.getNotificationAvgLatency());

        System.out.println("\nJMeter 부하 테스트 결과:");
        System.out.printf("  전체 성공률: %.2f%%\n", jmeterMetrics.getSuccessRate());
        System.out.printf("  평균 응답 시간: %.2fms\n", jmeterMetrics.getAvgResponseTime());
        System.out.printf("  P95 응답 시간: %dms\n", jmeterMetrics.getP95ResponseTime());
        */
    }
}































































