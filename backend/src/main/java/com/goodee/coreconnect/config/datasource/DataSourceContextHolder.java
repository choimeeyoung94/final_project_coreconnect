package com.goodee.coreconnect.config.datasource;

import lombok.extern.slf4j.Slf4j;

/**
 * ThreadLocal을 사용한 DataSource 컨텍스트 관리
 * - 현재 스레드에서 사용할 DataSource를 결정
 * - 각 요청마다 독립적인 DataSource 선택 보장
 */
@Slf4j
public class DataSourceContextHolder {

    private static final ThreadLocal<DataSourceType> CONTEXT = new ThreadLocal<>();

    /**
     * 현재 스레드의 DataSource 타입 설정
     */
    public static void setDataSourceType(DataSourceType dataSourceType) {
        if (dataSourceType == null) {
            throw new NullPointerException("dataSourceType cannot be null");
        }
        log.debug("🔄 [DataSource] Switch to: {}", dataSourceType);
        CONTEXT.set(dataSourceType);
    }

    /**
     * 현재 스레드의 DataSource 타입 조회
     * - 기본값: MASTER
     */
    public static DataSourceType getDataSourceType() {
        DataSourceType type = CONTEXT.get();
        if (type == null) {
            log.debug("🔄 [DataSource] No explicit type set, defaulting to MASTER");
            return DataSourceType.MASTER;
        }
        return type;
    }

    /**
     * 현재 스레드의 DataSource 컨텍스트 초기화
     * - 메모리 누수 방지를 위해 반드시 호출 필요
     */
    public static void clearDataSourceType() {
        CONTEXT.remove();
        log.debug("🧹 [DataSource] Context cleared");
    }
}




