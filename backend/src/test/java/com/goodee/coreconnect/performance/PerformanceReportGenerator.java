package com.goodee.coreconnect.performance;

import java.io.FileWriter;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * 성능 리포트를 Markdown 형식으로 생성하는 유틸리티 클래스
 * 
 * 사용 예시:
 * <pre>
 * PerformanceReportGenerator generator = new PerformanceReportGenerator();
 * generator.generateReport(beforeMetrics, afterMetrics, jmeterBefore, jmeterAfter, "performance-report.md");
 * </pre>
 */
public class PerformanceReportGenerator {

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    /**
     * 성능 리포트 생성
     */
    public void generateReport(
            MetricsAnalyzer.PerformanceMetrics beforeLogMetrics,
            MetricsAnalyzer.PerformanceMetrics afterLogMetrics,
            JMeterResultAnalyzer.JMeterMetrics beforeJMeterMetrics,
            JMeterResultAnalyzer.JMeterMetrics afterJMeterMetrics,
            String outputPath) throws IOException {

        try (FileWriter writer = new FileWriter(outputPath)) {
            writeHeader(writer);
            writeTestEnvironment(writer);
            writeLogMetrics(writer, beforeLogMetrics, afterLogMetrics);
            writeJMeterMetrics(writer, beforeJMeterMetrics, afterJMeterMetrics);
            writeSummary(writer, beforeLogMetrics, afterLogMetrics, beforeJMeterMetrics, afterJMeterMetrics);
        }
    }

    private void writeHeader(FileWriter writer) throws IOException {
        writer.write("# 성능 지표 측정 결과\n\n");
        writer.write("**생성 일시**: " + LocalDateTime.now().format(DATE_FORMATTER) + "\n\n");
        writer.write("---\n\n");
    }

    private void writeTestEnvironment(FileWriter writer) throws IOException {
        writer.write("## 측정 환경\n\n");
        writer.write("- 테스트 도구: JMeter 5.5\n");
        writer.write("- 동시 사용자: 10명\n");
        writer.write("- 테스트 시간: 5분\n");
        writer.write("- 총 요청 수: " + (afterJMeterMetrics != null ? afterJMeterMetrics.getTotalRequests() : "N/A") + "건\n\n");
        writer.write("---\n\n");
    }

    private void writeLogMetrics(FileWriter writer, 
                                 MetricsAnalyzer.PerformanceMetrics before,
                                 MetricsAnalyzer.PerformanceMetrics after) throws IOException {
        writer.write("## 애플리케이션 로그 메트릭\n\n");

        // 파일 업로드
        writer.write("### 1. 파일 업로드 성공률\n\n");
        writer.write("| 지표 | Before | After | 개선 |\n");
        writer.write("|------|--------|-------|------|\n");
        writer.write(String.format("| 성공률 | %.2f%% | %.2f%% | %.2f%%p |\n",
            before.getFileUploadSuccessRate(),
            after.getFileUploadSuccessRate(),
            after.getFileUploadSuccessRate() - before.getFileUploadSuccessRate()));
        writer.write(String.format("| 평균 처리 시간 | %.2fms | %.2fms | %.2f%% |\n",
            before.getFileUploadAvgDuration(),
            after.getFileUploadAvgDuration(),
            calculateImprovementPercent(before.getFileUploadAvgDuration(), after.getFileUploadAvgDuration())));
        writer.write("\n");

        // 알림 지연시간
        writer.write("### 2. 알림 전송 지연시간\n\n");
        writer.write("| 지표 | Before | After | 개선 |\n");
        writer.write("|------|--------|-------|------|\n");
        writer.write(String.format("| 평균 | %.2fms | %.2fms | %.2f%% |\n",
            before.getNotificationAvgLatency(),
            after.getNotificationAvgLatency(),
            calculateImprovementPercent(before.getNotificationAvgLatency(), after.getNotificationAvgLatency())));
        writer.write(String.format("| P95 | %.2fms | %.2fms | %.2f%% |\n",
            before.getNotificationP95Latency(),
            after.getNotificationP95Latency(),
            calculateImprovementPercent(before.getNotificationP95Latency(), after.getNotificationP95Latency())));
        writer.write("\n");

        // 이메일 발송
        writer.write("### 3. 이메일 발송 성공률\n\n");
        writer.write("| 지표 | Before | After | 개선 |\n");
        writer.write("|------|--------|-------|------|\n");
        writer.write(String.format("| 성공률 | %.2f%% | %.2f%% | %.2f%%p |\n",
            before.getEmailSendSuccessRate(),
            after.getEmailSendSuccessRate(),
            after.getEmailSendSuccessRate() - before.getEmailSendSuccessRate()));
        writer.write(String.format("| 평균 처리 시간 | %.2fms | %.2fms | %.2f%% |\n",
            before.getEmailSendAvgDuration(),
            after.getEmailSendAvgDuration(),
            calculateImprovementPercent(before.getEmailSendAvgDuration(), after.getEmailSendAvgDuration())));
        writer.write("\n");
    }

    private void writeJMeterMetrics(FileWriter writer,
                                   JMeterResultAnalyzer.JMeterMetrics before,
                                   JMeterResultAnalyzer.JMeterMetrics after) throws IOException {
        if (before == null || after == null) {
            return;
        }

        writer.write("## JMeter 부하 테스트 결과\n\n");

        writer.write("### 1. 전체 성공률\n\n");
        writer.write("| 지표 | Before | After | 개선 |\n");
        writer.write("|------|--------|-------|------|\n");
        writer.write(String.format("| 성공률 | %.2f%% | %.2f%% | %.2f%%p |\n",
            before.getSuccessRate(),
            after.getSuccessRate(),
            after.getSuccessRate() - before.getSuccessRate()));
        writer.write("\n");

        writer.write("### 2. 응답 시간\n\n");
        writer.write("| 지표 | Before | After | 개선 |\n");
        writer.write("|------|--------|-------|------|\n");
        writer.write(String.format("| 평균 | %.2fms | %.2fms | %.2f%% |\n",
            before.getAvgResponseTime(),
            after.getAvgResponseTime(),
            calculateImprovementPercent(before.getAvgResponseTime(), after.getAvgResponseTime())));
        writer.write(String.format("| P95 | %dms | %dms | %.2f%% |\n",
            before.getP95ResponseTime(),
            after.getP95ResponseTime(),
            calculateImprovementPercent(before.getP95ResponseTime(), after.getP95ResponseTime())));
        writer.write(String.format("| P99 | %dms | %dms | %.2f%% |\n",
            before.getP99ResponseTime(),
            after.getP99ResponseTime(),
            calculateImprovementPercent(before.getP99ResponseTime(), after.getP99ResponseTime())));
        writer.write("\n");
    }

    private void writeSummary(FileWriter writer,
                             MetricsAnalyzer.PerformanceMetrics beforeLog,
                             MetricsAnalyzer.PerformanceMetrics afterLog,
                             JMeterResultAnalyzer.JMeterMetrics beforeJMeter,
                             JMeterResultAnalyzer.JMeterMetrics afterJMeter) throws IOException {
        writer.write("## 종합 요약\n\n");

        writer.write("### 주요 개선 사항\n\n");
        writer.write("1. **파일 업로드 성공률**: ");
        writer.write(String.format("%.2f%% → %.2f%% (%.2f%%p 개선)\n",
            beforeLog.getFileUploadSuccessRate(),
            afterLog.getFileUploadSuccessRate(),
            afterLog.getFileUploadSuccessRate() - beforeLog.getFileUploadSuccessRate()));

        writer.write("2. **알림 전송 지연시간**: ");
        writer.write(String.format("%.2fms → %.2fms (%.2f%% 개선)\n",
            beforeLog.getNotificationAvgLatency(),
            afterLog.getNotificationAvgLatency(),
            calculateImprovementPercent(beforeLog.getNotificationAvgLatency(), afterLog.getNotificationAvgLatency())));

        if (beforeJMeter != null && afterJMeter != null) {
            writer.write("3. **전체 API 응답 시간**: ");
            writer.write(String.format("%.2fms → %.2fms (%.2f%% 개선)\n",
                beforeJMeter.getAvgResponseTime(),
                afterJMeter.getAvgResponseTime(),
                calculateImprovementPercent(beforeJMeter.getAvgResponseTime(), afterJMeter.getAvgResponseTime())));
        }

        writer.write("\n### 개선 방법\n\n");
        writer.write("- Nginx WebSocket 설정 최적화 (proxy_buffering off)\n");
        writer.write("- JPA Fetch Join으로 N+1 문제 해결\n");
        writer.write("- 비동기 처리 도입\n");
        writer.write("- 쿼리 최적화\n");
    }

    private double calculateImprovementPercent(double before, double after) {
        if (before == 0) return 0;
        return ((before - after) / before) * 100;
    }
}






































