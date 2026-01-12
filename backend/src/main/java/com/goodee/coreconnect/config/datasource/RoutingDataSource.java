package com.goodee.coreconnect.config.datasource;

import org.springframework.jdbc.datasource.lookup.AbstractRoutingDataSource;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import lombok.extern.slf4j.Slf4j;

/**
 * 동적 DataSource 라우팅
 * - @Transactional(readOnly=true) → SLAVE
 * - @Transactional(readOnly=false) 또는 기본 → MASTER
 * 
 * 동작 원리:
 * 1. Spring이 트랜잭션 시작 시 determineCurrentLookupKey() 호출
 * 2. ThreadLocal에서 현재 DataSource 타입 확인
 * 3. 해당 타입의 DataSource로 연결
 */
@Slf4j
public class RoutingDataSource extends AbstractRoutingDataSource {

    @Override
    protected Object determineCurrentLookupKey() {
        // Spring 트랜잭션이 readOnly인지 확인
        boolean isReadOnly = TransactionSynchronizationManager.isCurrentTransactionReadOnly();
        
        DataSourceType dataSourceType;
        
        if (isReadOnly) {
            dataSourceType = DataSourceType.SLAVE;
            log.debug("📖 [Transaction] Read-Only detected → Using SLAVE DB");
        } else {
            dataSourceType = DataSourceType.MASTER;
            log.debug("✍️  [Transaction] Write operation → Using MASTER DB");
        }
        
        // Context에도 저장 (디버깅용)
        DataSourceContextHolder.setDataSourceType(dataSourceType);
        
        return dataSourceType;
    }
}




