package com.goodee.coreconnect.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import lombok.extern.slf4j.Slf4j;

/**
 * 서버/LB Idle Timeout 관련 설정을 점검/로그로 알려주는 유틸 컴포넌트.
 * - HTTP/1.1 Keep-Alive는 기본 동작
 * - LB/프록시의 Idle Timeout이 서버 설정(connection-timeout)보다 너무 짧거나 긴지 확인 필요
 */
@Slf4j
@Component
public class NetworkIdleTimeoutLogger implements CommandLineRunner {

    @Value("${server.connection-timeout:20000}")
    private String serverConnectionTimeout; // ms 또는 ISO-8601(30s) 형태

    @Value("${app.proxy.idle-timeout-seconds:60}")
    private int proxyIdleTimeoutSeconds;    // LB/프록시 Idle Timeout(수동 입력)

    @Override
    public void run(String... args) {
        log.info("HTTP Keep-Alive 기본 활성화 (HTTP/1.1).");
        log.info("server.connection-timeout = {}", serverConnectionTimeout);
        log.info("app.proxy.idle-timeout-seconds = {}s (LB/프록시 설정 값 수동 입력)", proxyIdleTimeoutSeconds);
        log.info("권장: 서버 connection-timeout <= LB Idle Timeout, 필요 시 LB Idle Timeout을 더 길게 설정하거나 동일하게 맞추세요.");
    }
}

