package com.goodee.coreconnect.performance;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * 로그 파일에서 성능 메트릭을 추출하고 분석하는 유틸리티 클래스
 * 
 * 사용 예시:
 * <pre>
 * MetricsAnalyzer analyzer = new MetricsAnalyzer();
 * PerformanceMetrics before = analyzer.analyzeLogFile("logs/before_optimization.log");
 * PerformanceMetrics after = analyzer.analyzeLogFile("logs/after_optimization.log");
 * analyzer.printComparison(before, after);
 * </pre>
 */
@Slf4j
public class MetricsAnalyzer {

    // 로그 패턴 정의
    private static final Pattern FILE_UPLOAD_PATTERN = Pattern.compile(
        "\\[METRICS\\] chat\\.file\\.upload=(success|failure) duration=(\\d+)ms"
    );
    
    private static final Pattern NOTIFICATION_LATENCY_PATTERN = Pattern.compile(
        "\\[METRICS\\] notification\\.delivery\\.latency=(\\d+)ms"
    );
    
    private static final Pattern CHAT_ERROR_PATTERN = Pattern.compile(
        "\\[METRICS\\] chat\\.error type=(\\w+)"
    );
    
    private static final Pattern EMAIL_SEND_PATTERN = Pattern.compile(
        "\\[METRICS\\] email\\.send=(success|failure) duration=(\\d+)ms"
    );

    /**
     * 로그 파일을 분석하여 성능 메트릭을 추출
     * 
     * @param logFilePath 로그 파일 경로
     * @return 성능 메트릭 객체
     */
    public PerformanceMetrics analyzeLogFile(String logFilePath) {
        log.info("로그 파일 분석 시작: {}", logFilePath);
        
        Path path = Paths.get(logFilePath);
        if (!Files.exists(path)) {
            log.warn("로그 파일이 존재하지 않습니다: {}", logFilePath);
            return PerformanceMetrics.empty();
        }

        MetricsCollector collector = new MetricsCollector();

        try (BufferedReader reader = Files.newBufferedReader(path)) {
            String line;
            while ((line = reader.readLine()) != null) {
                analyzeLine(line, collector);
            }
        } catch (IOException e) {
            log.error("로그 파일 읽기 실패: {}", logFilePath, e);
            return PerformanceMetrics.empty();
        }

        return collector.build();
    }

    /**
     * 단일 로그 라인 분석
     */
    private void analyzeLine(String line, MetricsCollector collector) {
        // 파일 업로드 메트릭
        Matcher fileUploadMatcher = FILE_UPLOAD_PATTERN.matcher(line);
        if (fileUploadMatcher.find()) {
            boolean success = "success".equals(fileUploadMatcher.group(1));
            long duration = Long.parseLong(fileUploadMatcher.group(2));
            collector.recordFileUpload(success, duration);
            return;
        }

        // 알림 지연시간
        Matcher notificationMatcher = NOTIFICATION_LATENCY_PATTERN.matcher(line);
        if (notificationMatcher.find()) {
            long latency = Long.parseLong(notificationMatcher.group(1));
            collector.recordNotificationLatency(latency);
            return;
        }

        // 채팅 에러
        Matcher chatErrorMatcher = CHAT_ERROR_PATTERN.matcher(line);
        if (chatErrorMatcher.find()) {
            String errorType = chatErrorMatcher.group(1);
            collector.recordChatError(errorType);
            return;
        }

        // 이메일 발송
        Matcher emailMatcher = EMAIL_SEND_PATTERN.matcher(line);
        if (emailMatcher.find()) {
            boolean success = "success".equals(emailMatcher.group(1));
            long duration = Long.parseLong(emailMatcher.group(2));
            collector.recordEmailSend(success, duration);
        }
    }

    /**
     * Before/After 비교 결과 출력
     */
    public void printComparison(PerformanceMetrics before, PerformanceMetrics after) {
        System.out.println("=".repeat(60));
        System.out.println("성능 지표 비교 (Before vs After)");
        System.out.println("=".repeat(60));

        // 1. 파일 업로드 성공률
        System.out.println("\n1. 파일 업로드 성공률:");
        System.out.printf("   Before: %.2f%%\n", before.getFileUploadSuccessRate());
        System.out.printf("   After:  %.2f%%\n", after.getFileUploadSuccessRate());
        System.out.printf("   개선:   %.2f%%p\n", 
            after.getFileUploadSuccessRate() - before.getFileUploadSuccessRate());
        System.out.printf("   평균 처리 시간: %.2fms → %.2fms (%.2f%% 개선)\n",
            before.getFileUploadAvgDuration(),
            after.getFileUploadAvgDuration(),
            calculateImprovementPercent(before.getFileUploadAvgDuration(), after.getFileUploadAvgDuration()));

        // 2. 알림 평균 지연시간
        System.out.println("\n2. 알림 전송 지연시간:");
        System.out.printf("   Before - 평균: %.2fms, P95: %.2fms\n", 
            before.getNotificationAvgLatency(), before.getNotificationP95Latency());
        System.out.printf("   After  - 평균: %.2fms, P95: %.2fms\n", 
            after.getNotificationAvgLatency(), after.getNotificationP95Latency());
        System.out.printf("   개선:   평균 %.2fms (%.2f%%), P95 %.2fms (%.2f%%)\n",
            before.getNotificationAvgLatency() - after.getNotificationAvgLatency(),
            calculateImprovementPercent(before.getNotificationAvgLatency(), after.getNotificationAvgLatency()),
            before.getNotificationP95Latency() - after.getNotificationP95Latency(),
            calculateImprovementPercent(before.getNotificationP95Latency(), after.getNotificationP95Latency()));

        // 3. 채팅 에러율
        System.out.println("\n3. 채팅 에러율:");
        System.out.printf("   Before: %.2f%% (총 %d건)\n", 
            before.getChatErrorRate(), before.getChatErrorCount());
        System.out.printf("   After:  %.2f%% (총 %d건)\n", 
            after.getChatErrorRate(), after.getChatErrorCount());
        System.out.printf("   개선:   %.2f%%p\n", 
            before.getChatErrorRate() - after.getChatErrorRate());

        // 4. 이메일 발송 성공률
        System.out.println("\n4. 이메일 발송 성공률:");
        System.out.printf("   Before: %.2f%%\n", before.getEmailSendSuccessRate());
        System.out.printf("   After:  %.2f%%\n", after.getEmailSendSuccessRate());
        System.out.printf("   개선:   %.2f%%p\n", 
            after.getEmailSendSuccessRate() - before.getEmailSendSuccessRate());
        System.out.printf("   평균 처리 시간: %.2fms → %.2fms (%.2f%% 개선)\n",
            before.getEmailSendAvgDuration(),
            after.getEmailSendAvgDuration(),
            calculateImprovementPercent(before.getEmailSendAvgDuration(), after.getEmailSendAvgDuration()));

        System.out.println("\n" + "=".repeat(60));
    }

    /**
     * 개선율 계산 (백분율)
     */
    private double calculateImprovementPercent(double before, double after) {
        if (before == 0) return 0;
        return ((before - after) / before) * 100;
    }

    /**
     * 메트릭 수집을 위한 내부 클래스
     */
    private static class MetricsCollector {
        private final List<FileUploadMetric> fileUploads = new ArrayList<>();
        private final List<Long> notificationLatencies = new ArrayList<>();
        private final Map<String, Integer> chatErrors = new HashMap<>();
        private final List<EmailSendMetric> emailSends = new ArrayList<>();

        void recordFileUpload(boolean success, long duration) {
            fileUploads.add(new FileUploadMetric(success, duration));
        }

        void recordNotificationLatency(long latency) {
            notificationLatencies.add(latency);
        }

        void recordChatError(String errorType) {
            chatErrors.put(errorType, chatErrors.getOrDefault(errorType, 0) + 1);
        }

        void recordEmailSend(boolean success, long duration) {
            emailSends.add(new EmailSendMetric(success, duration));
        }

        PerformanceMetrics build() {
            return PerformanceMetrics.builder()
                .fileUploadSuccessRate(calculateFileUploadSuccessRate())
                .fileUploadAvgDuration(calculateFileUploadAvgDuration())
                .notificationAvgLatency(calculateNotificationAvgLatency())
                .notificationP95Latency(calculateNotificationP95Latency())
                .chatErrorCount(chatErrors.values().stream().mapToInt(Integer::intValue).sum())
                .chatErrorRate(calculateChatErrorRate())
                .chatErrorTypes(new HashMap<>(chatErrors))
                .emailSendSuccessRate(calculateEmailSendSuccessRate())
                .emailSendAvgDuration(calculateEmailSendAvgDuration())
                .build();
        }

        private double calculateFileUploadSuccessRate() {
            if (fileUploads.isEmpty()) return 0;
            long successCount = fileUploads.stream().filter(FileUploadMetric::isSuccess).count();
            return (double) successCount / fileUploads.size() * 100;
        }

        private double calculateFileUploadAvgDuration() {
            if (fileUploads.isEmpty()) return 0;
            return fileUploads.stream()
                .mapToLong(FileUploadMetric::getDuration)
                .average()
                .orElse(0);
        }

        private double calculateNotificationAvgLatency() {
            if (notificationLatencies.isEmpty()) return 0;
            return notificationLatencies.stream()
                .mapToLong(Long::longValue)
                .average()
                .orElse(0);
        }

        private double calculateNotificationP95Latency() {
            if (notificationLatencies.isEmpty()) return 0;
            List<Long> sorted = notificationLatencies.stream()
                .sorted()
                .collect(Collectors.toList());
            int index = (int) Math.ceil(sorted.size() * 0.95) - 1;
            return sorted.get(Math.max(0, index));
        }

        private double calculateChatErrorRate() {
            // 채팅 에러율은 전체 요청 대비 에러 수로 계산
            // 실제로는 JMeter 결과와 결합 필요
            int totalErrors = chatErrors.values().stream().mapToInt(Integer::intValue).sum();
            // 여기서는 간단히 에러 수만 반환 (실제 요청 수는 JMeter 결과에서 가져와야 함)
            return totalErrors; // 실제로는 (totalErrors / totalRequests) * 100
        }

        private double calculateEmailSendSuccessRate() {
            if (emailSends.isEmpty()) return 0;
            long successCount = emailSends.stream().filter(EmailSendMetric::isSuccess).count();
            return (double) successCount / emailSends.size() * 100;
        }

        private double calculateEmailSendAvgDuration() {
            if (emailSends.isEmpty()) return 0;
            return emailSends.stream()
                .mapToLong(EmailSendMetric::getDuration)
                .average()
                .orElse(0);
        }
    }

    @Data
    @AllArgsConstructor
    private static class FileUploadMetric {
        private boolean success;
        private long duration;
    }

    @Data
    @AllArgsConstructor
    private static class EmailSendMetric {
        private boolean success;
        private long duration;
    }

    /**
     * 성능 메트릭 결과를 담는 DTO
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PerformanceMetrics {
        // 파일 업로드
        private double fileUploadSuccessRate;
        private double fileUploadAvgDuration;

        // 알림
        private double notificationAvgLatency;
        private double notificationP95Latency;

        // 채팅 에러
        private int chatErrorCount;
        private double chatErrorRate;
        private Map<String, Integer> chatErrorTypes;

        // 이메일
        private double emailSendSuccessRate;
        private double emailSendAvgDuration;

        public static PerformanceMetrics empty() {
            return PerformanceMetrics.builder()
                .fileUploadSuccessRate(0)
                .fileUploadAvgDuration(0)
                .notificationAvgLatency(0)
                .notificationP95Latency(0)
                .chatErrorCount(0)
                .chatErrorRate(0)
                .chatErrorTypes(new HashMap<>())
                .emailSendSuccessRate(0)
                .emailSendAvgDuration(0)
                .build();
        }
    }
}
































