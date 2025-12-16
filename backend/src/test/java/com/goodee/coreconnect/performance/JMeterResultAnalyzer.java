package com.goodee.coreconnect.performance;

import lombok.extern.slf4j.Slf4j;

import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.stream.Collectors;

/**
 * JMeter CSV 결과 파일을 분석하는 유틸리티 클래스
 * 
 * JMeter 결과 파일 형식 (CSV):
 * timeStamp,elapsed,label,responseCode,responseMessage,threadName,dataType,success,failureMessage,bytes,sentBytes,grpThreads,allThreads,URL,Latency,IdleTime,Connect
 * 
 * 사용 예시:
 * <pre>
 * JMeterResultAnalyzer analyzer = new JMeterResultAnalyzer();
 * JMeterMetrics metrics = analyzer.analyzeJMeterResult("results.jtl");
 * analyzer.printSummary(metrics);
 * </pre>
 */
@Slf4j
public class JMeterResultAnalyzer {

    /**
     * JMeter CSV 결과 파일 분석
     */
    public JMeterMetrics analyzeJMeterResult(String csvFilePath) {
        log.info("JMeter 결과 파일 분석 시작: {}", csvFilePath);
        
        Path path = Paths.get(csvFilePath);
        if (!Files.exists(path)) {
            log.warn("JMeter 결과 파일이 존재하지 않습니다: {}", csvFilePath);
            return JMeterMetrics.empty();
        }

        List<JMeterSample> samples = new ArrayList<>();

        try (BufferedReader reader = Files.newBufferedReader(path)) {
            String headerLine = reader.readLine(); // 헤더 스킵
            if (headerLine == null || !headerLine.contains("timeStamp")) {
                log.warn("JMeter CSV 파일 형식이 올바르지 않습니다.");
                return JMeterMetrics.empty();
            }

            String line;
            while ((line = reader.readLine()) != null) {
                JMeterSample sample = parseSample(line);
                if (sample != null) {
                    samples.add(sample);
                }
            }
        } catch (IOException e) {
            log.error("JMeter 결과 파일 읽기 실패: {}", csvFilePath, e);
            return JMeterMetrics.empty();
        }

        return buildMetrics(samples);
    }

    /**
     * CSV 라인을 파싱하여 JMeterSample 객체 생성
     */
    private JMeterSample parseSample(String line) {
        String[] fields = line.split(",");
        if (fields.length < 8) {
            return null;
        }

        try {
            return JMeterSample.builder()
                .timeStamp(Long.parseLong(fields[0]))
                .elapsed(Long.parseLong(fields[1]))
                .label(fields[2])
                .responseCode(fields[3])
                .responseMessage(fields.length > 4 ? fields[4] : "")
                .threadName(fields.length > 5 ? fields[5] : "")
                .success("true".equalsIgnoreCase(fields[7]))
                .latency(fields.length > 14 ? Long.parseLong(fields[14]) : 0)
                .build();
        } catch (NumberFormatException e) {
            log.warn("JMeter 샘플 파싱 실패: {}", line);
            return null;
        }
    }

    /**
     * 샘플 리스트로부터 메트릭 생성
     */
    private JMeterMetrics buildMetrics(List<JMeterSample> samples) {
        if (samples.isEmpty()) {
            return JMeterMetrics.empty();
        }

        // 전체 통계
        long totalRequests = samples.size();
        long successCount = samples.stream().filter(JMeterSample::isSuccess).count();
        long failureCount = totalRequests - successCount;

        // 응답 시간 통계
        List<Long> elapsedTimes = samples.stream()
            .map(JMeterSample::getElapsed)
            .sorted()
            .collect(Collectors.toList());

        List<Long> latencies = samples.stream()
            .map(JMeterSample::getLatency)
            .filter(l -> l > 0)
            .sorted()
            .collect(Collectors.toList());

        // 라벨별 통계
        Map<String, List<JMeterSample>> samplesByLabel = samples.stream()
            .collect(Collectors.groupingBy(JMeterSample::getLabel));

        Map<String, LabelMetrics> labelMetrics = new HashMap<>();
        for (Map.Entry<String, List<JMeterSample>> entry : samplesByLabel.entrySet()) {
            labelMetrics.put(entry.getKey(), buildLabelMetrics(entry.getValue()));
        }

        return JMeterMetrics.builder()
            .totalRequests(totalRequests)
            .successCount(successCount)
            .failureCount(failureCount)
            .successRate((double) successCount / totalRequests * 100)
            .avgResponseTime(calculateAverage(elapsedTimes))
            .minResponseTime(elapsedTimes.isEmpty() ? 0 : elapsedTimes.get(0))
            .maxResponseTime(elapsedTimes.isEmpty() ? 0 : elapsedTimes.get(elapsedTimes.size() - 1))
            .p50ResponseTime(calculatePercentile(elapsedTimes, 50))
            .p95ResponseTime(calculatePercentile(elapsedTimes, 95))
            .p99ResponseTime(calculatePercentile(elapsedTimes, 99))
            .avgLatency(calculateAverage(latencies))
            .p95Latency(calculatePercentile(latencies, 95))
            .labelMetrics(labelMetrics)
            .build();
    }

    /**
     * 라벨별 메트릭 생성
     */
    private LabelMetrics buildLabelMetrics(List<JMeterSample> samples) {
        long total = samples.size();
        long success = samples.stream().filter(JMeterSample::isSuccess).count();
        List<Long> elapsedTimes = samples.stream()
            .map(JMeterSample::getElapsed)
            .sorted()
            .collect(Collectors.toList());

        return LabelMetrics.builder()
            .totalRequests(total)
            .successCount(success)
            .failureCount(total - success)
            .successRate((double) success / total * 100)
            .avgResponseTime(calculateAverage(elapsedTimes))
            .p95ResponseTime(calculatePercentile(elapsedTimes, 95))
            .build();
    }

    /**
     * 평균 계산
     */
    private double calculateAverage(List<Long> values) {
        if (values.isEmpty()) return 0;
        return values.stream().mapToLong(Long::longValue).average().orElse(0);
    }

    /**
     * 백분위수 계산
     */
    private long calculatePercentile(List<Long> sortedValues, int percentile) {
        if (sortedValues.isEmpty()) return 0;
        int index = (int) Math.ceil(sortedValues.size() * percentile / 100.0) - 1;
        return sortedValues.get(Math.max(0, index));
    }

    /**
     * 메트릭 요약 출력
     */
    public void printSummary(JMeterMetrics metrics) {
        System.out.println("=".repeat(60));
        System.out.println("JMeter 성능 테스트 결과 요약");
        System.out.println("=".repeat(60));
        
        System.out.println("\n전체 통계:");
        System.out.printf("  총 요청 수: %d\n", metrics.getTotalRequests());
        System.out.printf("  성공: %d (%.2f%%)\n", metrics.getSuccessCount(), metrics.getSuccessRate());
        System.out.printf("  실패: %d (%.2f%%)\n", 
            metrics.getFailureCount(), 
            100 - metrics.getSuccessRate());

        System.out.println("\n응답 시간 (ms):");
        System.out.printf("  평균: %.2f\n", metrics.getAvgResponseTime());
        System.out.printf("  최소: %d\n", metrics.getMinResponseTime());
        System.out.printf("  최대: %d\n", metrics.getMaxResponseTime());
        System.out.printf("  P50: %d\n", metrics.getP50ResponseTime());
        System.out.printf("  P95: %d\n", metrics.getP95ResponseTime());
        System.out.printf("  P99: %d\n", metrics.getP99ResponseTime());

        if (metrics.getAvgLatency() > 0) {
            System.out.println("\n지연시간 (Latency, ms):");
            System.out.printf("  평균: %.2f\n", metrics.getAvgLatency());
            System.out.printf("  P95: %d\n", metrics.getP95Latency());
        }

        if (!metrics.getLabelMetrics().isEmpty()) {
            System.out.println("\n라벨별 통계:");
            metrics.getLabelMetrics().forEach((label, labelMetrics) -> {
                System.out.printf("\n  [%s]\n", label);
                System.out.printf("    요청 수: %d\n", labelMetrics.getTotalRequests());
                System.out.printf("    성공률: %.2f%%\n", labelMetrics.getSuccessRate());
                System.out.printf("    평균 응답 시간: %.2fms\n", labelMetrics.getAvgResponseTime());
                System.out.printf("    P95 응답 시간: %dms\n", labelMetrics.getP95ResponseTime());
            });
        }

        System.out.println("\n" + "=".repeat(60));
    }

    /**
     * Before/After 비교 출력
     */
    public void printComparison(JMeterMetrics before, JMeterMetrics after) {
        System.out.println("=".repeat(60));
        System.out.println("JMeter 성능 테스트 비교 (Before vs After)");
        System.out.println("=".repeat(60));

        System.out.println("\n성공률:");
        System.out.printf("  Before: %.2f%%\n", before.getSuccessRate());
        System.out.printf("  After:  %.2f%%\n", after.getSuccessRate());
        System.out.printf("  개선:   %.2f%%p\n", after.getSuccessRate() - before.getSuccessRate());

        System.out.println("\n평균 응답 시간:");
        System.out.printf("  Before: %.2fms\n", before.getAvgResponseTime());
        System.out.printf("  After:  %.2fms\n", after.getAvgResponseTime());
        System.out.printf("  개선:   %.2fms (%.2f%%)\n",
            before.getAvgResponseTime() - after.getAvgResponseTime(),
            calculateImprovementPercent(before.getAvgResponseTime(), after.getAvgResponseTime()));

        System.out.println("\nP95 응답 시간:");
        System.out.printf("  Before: %dms\n", before.getP95ResponseTime());
        System.out.printf("  After:  %dms\n", after.getP95ResponseTime());
        System.out.printf("  개선:   %dms (%.2f%%)\n",
            before.getP95ResponseTime() - after.getP95ResponseTime(),
            calculateImprovementPercent(before.getP95ResponseTime(), after.getP95ResponseTime()));

        System.out.println("\n" + "=".repeat(60));
    }

    private double calculateImprovementPercent(double before, double after) {
        if (before == 0) return 0;
        return ((before - after) / before) * 100;
    }

    // 내부 클래스들
    @lombok.Data
    @lombok.Builder
    public static class JMeterSample {
        private long timeStamp;
        private long elapsed;
        private String label;
        private String responseCode;
        private String responseMessage;
        private String threadName;
        private boolean success;
        private long latency;
    }

    @lombok.Data
    @lombok.Builder
    public static class JMeterMetrics {
        private long totalRequests;
        private long successCount;
        private long failureCount;
        private double successRate;
        private double avgResponseTime;
        private long minResponseTime;
        private long maxResponseTime;
        private long p50ResponseTime;
        private long p95ResponseTime;
        private long p99ResponseTime;
        private double avgLatency;
        private long p95Latency;
        private Map<String, LabelMetrics> labelMetrics;

        public static JMeterMetrics empty() {
            return JMeterMetrics.builder()
                .totalRequests(0)
                .successCount(0)
                .failureCount(0)
                .successRate(0)
                .avgResponseTime(0)
                .minResponseTime(0)
                .maxResponseTime(0)
                .p50ResponseTime(0)
                .p95ResponseTime(0)
                .p99ResponseTime(0)
                .avgLatency(0)
                .p95Latency(0)
                .labelMetrics(new HashMap<>())
                .build();
        }
    }

    @lombok.Data
    @lombok.Builder
    public static class LabelMetrics {
        private long totalRequests;
        private long successCount;
        private long failureCount;
        private double successRate;
        private double avgResponseTime;
        private long p95ResponseTime;
    }
}

















































