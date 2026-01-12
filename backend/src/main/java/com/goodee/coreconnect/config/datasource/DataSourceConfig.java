package com.goodee.coreconnect.config.datasource;

import java.util.HashMap;
import java.util.Map;

import javax.sql.DataSource;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.datasource.LazyConnectionDataSourceProxy;

import com.zaxxer.hikari.HikariDataSource;

import lombok.extern.slf4j.Slf4j;

/**
 * Master-Slave DataSource 설정
 * 
 * 구조:
 * - Master DB: Write 작업 (INSERT, UPDATE, DELETE)
 * - Slave DB: Read 작업 (SELECT)
 * 
 * 사용법:
 * - @Transactional(readOnly = true) → Slave DB 사용
 * - @Transactional 또는 @Transactional(readOnly = false) → Master DB 사용
 */
@Slf4j
@Configuration
public class DataSourceConfig {

    /**
     * Master DataSource 설정 (Write 전용)
     */
    @Bean
    @ConfigurationProperties(prefix = "spring.datasource.master.hikari")
    public DataSource masterDataSource() {
        log.info("🔵 Initializing MASTER DataSource (Write)");
        HikariDataSource dataSource = DataSourceBuilder.create()
                .type(HikariDataSource.class)
                .build();
        
        // Master DB 설정 (환경변수에서 주입)
        dataSource.setJdbcUrl(System.getenv().getOrDefault(
            "SPRING_DATASOURCE_MASTER_URL",
            "jdbc:mysql://mysql-master:3306/db_coreconnect?useSSL=false&serverTimezone=Asia/Seoul&allowPublicKeyRetrieval=true"
        ));
        dataSource.setUsername(System.getenv().getOrDefault("MYSQL_USERNAME", "root"));
        dataSource.setPassword(System.getenv().getOrDefault("MYSQL_PASSWORD", "finalcoreconnect"));
        dataSource.setDriverClassName("com.mysql.cj.jdbc.Driver");
        
        log.info("🔵 MASTER DataSource configured: {}", dataSource.getJdbcUrl());
        return dataSource;
    }

    /**
     * Slave DataSource 설정 (Read 전용)
     */
    @Bean
    @ConfigurationProperties(prefix = "spring.datasource.slave.hikari")
    public DataSource slaveDataSource() {
        log.info("🟢 Initializing SLAVE DataSource (Read)");
        HikariDataSource dataSource = DataSourceBuilder.create()
                .type(HikariDataSource.class)
                .build();
        
        // Slave DB 설정 (환경변수에서 주입)
        String slaveHost = System.getenv().getOrDefault("MYSQL_SLAVE_HOST", "mysql-slave-1");
        String slavePort = System.getenv().getOrDefault("MYSQL_SLAVE_PORT", "3306");
        String database = System.getenv().getOrDefault("MYSQL_DATABASE", "db_coreconnect");
        
        String slaveUrl = String.format(
            "jdbc:mysql://%s:%s/%s?useSSL=false&serverTimezone=Asia/Seoul&allowPublicKeyRetrieval=true",
            slaveHost, slavePort, database
        );
        
        dataSource.setJdbcUrl(slaveUrl);
        dataSource.setUsername(System.getenv().getOrDefault("MYSQL_USERNAME", "root"));
        dataSource.setPassword(System.getenv().getOrDefault("MYSQL_PASSWORD", "finalcoreconnect"));
        dataSource.setDriverClassName("com.mysql.cj.jdbc.Driver");
        
        log.info("🟢 SLAVE DataSource configured: {}", dataSource.getJdbcUrl());
        return dataSource;
    }

    /**
     * Routing DataSource 설정
     * - @Transactional(readOnly) 여부에 따라 Master/Slave 자동 선택
     */
    @Bean
    public DataSource routingDataSource(
            @Qualifier("masterDataSource") DataSource masterDataSource,
            @Qualifier("slaveDataSource") DataSource slaveDataSource) {
        
        log.info("🔄 Initializing Routing DataSource");
        
        RoutingDataSource routingDataSource = new RoutingDataSource();
        
        Map<Object, Object> dataSourceMap = new HashMap<>();
        dataSourceMap.put(DataSourceType.MASTER, masterDataSource);
        dataSourceMap.put(DataSourceType.SLAVE, slaveDataSource);
        
        routingDataSource.setTargetDataSources(dataSourceMap);
        routingDataSource.setDefaultTargetDataSource(masterDataSource);
        
        log.info("🔄 Routing DataSource initialized with MASTER (default) and SLAVE");
        return routingDataSource;
    }

    /**
     * LazyConnectionDataSourceProxy
     * - 실제 쿼리 실행 시점까지 Connection 획득을 지연
     * - @Transactional 시작 시점이 아닌 실제 쿼리 실행 시 DataSource 결정
     * 
     * 중요: Primary DataSource로 지정하여 JPA/MyBatis가 이것을 사용하도록 함
     */
    @Primary
    @Bean
    public DataSource dataSource(@Qualifier("routingDataSource") DataSource routingDataSource) {
        log.info("🚀 Initializing LazyConnectionDataSourceProxy (Primary)");
        return new LazyConnectionDataSourceProxy(routingDataSource);
    }
}




