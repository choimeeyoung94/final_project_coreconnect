package com.goodee.coreconnect.config.datasource;

/**
 * 데이터베이스 타입 열거형
 * - MASTER: 쓰기 작업 (INSERT, UPDATE, DELETE)
 * - SLAVE: 읽기 작업 (SELECT)
 */
public enum DataSourceType {
    MASTER,  // Write
    SLAVE    // Read
}




