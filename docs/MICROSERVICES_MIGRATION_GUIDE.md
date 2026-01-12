# 🚀 마이크로서비스 전환 완전 가이드

## 📌 목차
1. [전환 전략 개요](#1-전환-전략-개요)
2. [인프라 구축](#2-인프라-구축)
3. [서비스 분리](#3-서비스-분리)
4. [데이터 일관성 전략](#4-데이터-일관성-전략)
5. [배포 전략](#5-배포-전략)
6. [모니터링 및 운영](#6-모니터링-및-운영)

---

## 1. 전환 전략 개요

### 1.1 전환 단계

```
┌──────────────────────────────────────────────────────────┐
│ Phase 1: 모놀리스 + DDD (2-4주)                           │
│ ─────────────────────────────────────────────────────── │
│ ✅ DDD 패턴 적용                                          │
│ ✅ 바운디드 컨텍스트 명확화                                │
│ ✅ 도메인 이벤트 구현                                      │
│ ⚠️  아직 하나의 애플리케이션                               │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│ Phase 2: 데이터베이스 분리 (2-3주)                         │
│ ─────────────────────────────────────────────────────── │
│ ✅ 스키마 분리 (chat_db, email_db, notification_db)       │
│ ✅ 외래키 제거                                            │
│ ✅ 논리적 참조로 변경                                      │
│ ⚠️  여전히 하나의 애플리케이션                             │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│ Phase 3: 서비스 분리 (4-6주)                              │
│ ─────────────────────────────────────────────────────── │
│ ✅ 독립 서비스 분리                                        │
│ ✅ Kafka 기반 통신                                        │
│ ✅ API Gateway 구축                                      │
│ ✅ 독립 배포                                              │
└──────────────────────────────────────────────────────────┘
```

### 1.2 서비스 분리 우선순위

1. **🥇 알림 서비스** (가장 먼저)
   - 다른 서비스에 의존하지 않음
   - 이벤트 구독만 하면 됨
   - 리스크 낮음

2. **🥈 이메일 서비스**
   - 비동기 처리가 대부분
   - 의존성 낮음
   - SendGrid 등 외부 API 사용

3. **🥉 채팅 서비스** (마지막)
   - 실시간 처리 필요
   - WebSocket 통신
   - 복잡도 높음

---

## 2. 인프라 구축

### 2.1 메시지 브로커 (Kafka)

#### Docker Compose 설정

```yaml
# infrastructure/docker-compose.kafka.yml
version: '3.8'

services:
  zookeeper:
    image: confluentinc/cp-zookeeper:7.5.0
    container_name: zookeeper
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
    ports:
      - "2181:2181"
    networks:
      - microservices-network

  kafka:
    image: confluentinc/cp-kafka:7.5.0
    container_name: kafka
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
      - "29092:29092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:29092,PLAINTEXT_HOST://localhost:9092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: "true"
    networks:
      - microservices-network

  kafka-ui:
    image: provectuslabs/kafka-ui:latest
    container_name: kafka-ui
    depends_on:
      - kafka
    ports:
      - "8080:8080"
    environment:
      KAFKA_CLUSTERS_0_NAME: local
      KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS: kafka:29092
      KAFKA_CLUSTERS_0_ZOOKEEPER: zookeeper:2181
    networks:
      - microservices-network

networks:
  microservices-network:
    driver: bridge
```

#### Kafka 토픽 생성

```bash
# infrastructure/scripts/create-kafka-topics.sh
#!/bin/bash

KAFKA_BROKER="localhost:9092"

# 채팅 관련 토픽
kafka-topics --create --topic chat.message.sent \
  --bootstrap-server $KAFKA_BROKER \
  --partitions 3 \
  --replication-factor 1

kafka-topics --create --topic chat.room.created \
  --bootstrap-server $KAFKA_BROKER \
  --partitions 1 \
  --replication-factor 1

# 이메일 관련 토픽
kafka-topics --create --topic email.sent \
  --bootstrap-server $KAFKA_BROKER \
  --partitions 3 \
  --replication-factor 1

kafka-topics --create --topic email.scheduled \
  --bootstrap-server $KAFKA_BROKER \
  --partitions 1 \
  --replication-factor 1

# 알림 관련 토픽
kafka-topics --create --topic notification.created \
  --bootstrap-server $KAFKA_BROKER \
  --partitions 3 \
  --replication-factor 1

kafka-topics --create --topic notification.delivered \
  --bootstrap-server $KAFKA_BROKER \
  --partitions 1 \
  --replication-factor 1

# 토픽 목록 확인
kafka-topics --list --bootstrap-server $KAFKA_BROKER
```

### 2.2 Service Discovery (Eureka)

#### Eureka Server

```java
// eureka-server/src/main/java/com/goodee/eurekaserver/EurekaServerApplication.java
package com.goodee.eurekaserver;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.netflix.eureka.server.EnableEurekaServer;

@SpringBootApplication
@EnableEurekaServer
public class EurekaServerApplication {
    public static void main(String[] args) {
        SpringApplication.run(EurekaServerApplication.class, args);
    }
}
```

```yaml
# eureka-server/src/main/resources/application.yml
server:
  port: 8761

spring:
  application:
    name: eureka-server

eureka:
  client:
    register-with-eureka: false
    fetch-registry: false
  server:
    enable-self-preservation: false
    eviction-interval-timer-in-ms: 5000
```

### 2.3 API Gateway (Spring Cloud Gateway)

```java
// api-gateway/src/main/java/com/goodee/apigateway/ApiGatewayApplication.java
package com.goodee.apigateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

@SpringBootApplication
@EnableDiscoveryClient
public class ApiGatewayApplication {
    public static void main(String[] args) {
        SpringApplication.run(ApiGatewayApplication.class, args);
    }
}
```

```yaml
# api-gateway/src/main/resources/application.yml
server:
  port: 8000

spring:
  application:
    name: api-gateway
  cloud:
    gateway:
      routes:
        # 채팅 서비스
        - id: chat-service
          uri: lb://CHAT-SERVICE
          predicates:
            - Path=/api/chat/**
          filters:
            - name: CircuitBreaker
              args:
                name: chatCircuitBreaker
                fallbackUri: forward:/fallback/chat
        
        # 이메일 서비스
        - id: email-service
          uri: lb://EMAIL-SERVICE
          predicates:
            - Path=/api/email/**
          filters:
            - name: CircuitBreaker
              args:
                name: emailCircuitBreaker
                fallbackUri: forward:/fallback/email
        
        # 알림 서비스
        - id: notification-service
          uri: lb://NOTIFICATION-SERVICE
          predicates:
            - Path=/api/notifications/**
          filters:
            - name: CircuitBreaker
              args:
                name: notificationCircuitBreaker
                fallbackUri: forward:/fallback/notification

      default-filters:
        - DedupeResponseHeader=Access-Control-Allow-Credentials Access-Control-Allow-Origin
        - AddResponseHeader=X-Response-Time, ${spring.cloud.gateway.response-time}

eureka:
  client:
    serviceUrl:
      defaultZone: http://localhost:8761/eureka/

resilience4j:
  circuitbreaker:
    configs:
      default:
        registerHealthIndicator: true
        slidingWindowSize: 10
        minimumNumberOfCalls: 5
        permittedNumberOfCallsInHalfOpenState: 3
        automaticTransitionFromOpenToHalfOpenEnabled: true
        waitDurationInOpenState: 10s
        failureRateThreshold: 50
        recordExceptions:
          - org.springframework.web.client.HttpServerErrorException
          - java.io.IOException
```

---

## 3. 서비스 분리

### 3.1 서비스 구조

```
microservices/
├── eureka-server/              # Service Discovery
│   ├── src/
│   ├── build.gradle
│   └── Dockerfile
│
├── api-gateway/                # API Gateway
│   ├── src/
│   ├── build.gradle
│   └── Dockerfile
│
├── chat-service/               # 채팅 마이크로서비스
│   ├── src/
│   │   └── main/
│   │       ├── java/com/goodee/chatservice/
│   │       │   ├── domain/
│   │       │   ├── application/
│   │       │   ├── infrastructure/
│   │       │   └── interfaces/
│   │       └── resources/
│   │           ├── application.yml
│   │           └── application-prod.yml
│   ├── build.gradle
│   └── Dockerfile
│
├── email-service/              # 이메일 마이크로서비스
│   ├── src/
│   │   └── main/
│   │       ├── java/com/goodee/emailservice/
│   │       │   ├── domain/
│   │       │   ├── application/
│   │       │   ├── infrastructure/
│   │       │   └── interfaces/
│   │       └── resources/
│   ├── build.gradle
│   └── Dockerfile
│
├── notification-service/       # 알림 마이크로서비스
│   ├── src/
│   │   └── main/
│   │       ├── java/com/goodee/notificationservice/
│   │       │   ├── domain/
│   │       │   ├── application/
│   │       │   ├── infrastructure/
│   │       │   └── interfaces/
│   │       └── resources/
│   ├── build.gradle
│   └── Dockerfile
│
└── shared/                     # 공유 라이브러리
    ├── src/
    │   └── main/
    │       └── java/com/goodee/shared/
    │           ├── domain/
    │           │   └── event/
    │           └── infrastructure/
    └── build.gradle
```

### 3.2 채팅 서비스 설정

```yaml
# chat-service/src/main/resources/application.yml
server:
  port: 8081

spring:
  application:
    name: chat-service
  
  datasource:
    url: jdbc:mysql://localhost:3306/chat_db
    username: chat_user
    password: ${DB_PASSWORD}
    driver-class-name: com.mysql.cj.jdbc.Driver
  
  jpa:
    hibernate:
      ddl-auto: validate
    show-sql: false
    properties:
      hibernate:
        format_sql: true
  
  kafka:
    bootstrap-servers: localhost:9092
    producer:
      key-serializer: org.apache.kafka.common.serialization.StringSerializer
      value-serializer: org.apache.kafka.common.serialization.StringSerializer
      acks: all
      retries: 3
    consumer:
      group-id: chat-service
      key-deserializer: org.apache.kafka.common.serialization.StringDeserializer
      value-deserializer: org.apache.kafka.common.serialization.StringDeserializer
      auto-offset-reset: earliest

eureka:
  client:
    serviceUrl:
      defaultZone: http://localhost:8761/eureka/
  instance:
    preferIpAddress: true
    instance-id: ${spring.application.name}:${spring.application.instance_id:${random.value}}

management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,prometheus
  endpoint:
    health:
      show-details: always
```

### 3.3 이메일 서비스 설정

```yaml
# email-service/src/main/resources/application.yml
server:
  port: 8082

spring:
  application:
    name: email-service
  
  datasource:
    url: jdbc:mysql://localhost:3306/email_db
    username: email_user
    password: ${DB_PASSWORD}
  
  kafka:
    bootstrap-servers: localhost:9092
    producer:
      key-serializer: org.apache.kafka.common.serialization.StringSerializer
      value-serializer: org.apache.kafka.common.serialization.StringSerializer
    consumer:
      group-id: email-service

sendgrid:
  api-key: ${SENDGRID_API_KEY}

eureka:
  client:
    serviceUrl:
      defaultZone: http://localhost:8761/eureka/
```

### 3.4 알림 서비스 설정

```yaml
# notification-service/src/main/resources/application.yml
server:
  port: 8083

spring:
  application:
    name: notification-service
  
  datasource:
    url: jdbc:mysql://localhost:3306/notification_db
    username: notification_user
    password: ${DB_PASSWORD}
  
  kafka:
    bootstrap-servers: localhost:9092
    consumer:
      group-id: notification-service
      # 여러 토픽 구독
      topics:
        - chat.message.sent
        - email.sent

eureka:
  client:
    serviceUrl:
      defaultZone: http://localhost:8761/eureka/
```

---

## 4. 데이터 일관성 전략

### 4.1 Saga 패턴 구현

#### Choreography Saga (이벤트 기반)

```java
// chat-service/src/main/java/com/goodee/chatservice/application/service/ChatApplicationService.java
package com.goodee.chatservice.application.service;

import com.goodee.chatservice.domain.model.ChatRoom;
import com.goodee.chatservice.domain.model.event.MessageSentEvent;
import com.goodee.shared.infrastructure.event.EventPublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 채팅 애플리케이션 서비스
 * 
 * Saga 시작점
 */
@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class ChatApplicationService {
    
    private final ChatRoomRepository chatRoomRepository;
    private final EventPublisher eventPublisher;
    
    /**
     * Saga Step 1: 메시지 저장
     */
    public ChatMessageResponse sendMessage(SendMessageCommand command) {
        log.info("🔵 [Saga Step 1] 메시지 저장 시작");
        
        // 1. 메시지 저장
        ChatRoom chatRoom = chatRoomRepository.findById(command.getRoomId())
            .orElseThrow();
        ChatMessage message = chatRoom.sendMessage(...);
        chatRoomRepository.save(chatRoom);
        
        // 2. 이벤트 발행 (Saga Step 2 트리거)
        MessageSentEvent event = new MessageSentEvent(
            message.getId(),
            chatRoom.getId(),
            command.getSenderId(),
            command.getContent(),
            chatRoom.getOtherParticipantIds(command.getSenderId())
        );
        eventPublisher.publish(event);
        
        log.info("✅ [Saga Step 1] 완료 - 이벤트 발행됨");
        
        return ChatMessageResponse.from(message);
    }
}
```

```java
// notification-service/src/main/java/com/goodee/notificationservice/infrastructure/event/KafkaEventSubscriber.java
package com.goodee.notificationservice.infrastructure.event;

import com.goodee.notificationservice.application.service.NotificationApplicationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Component;

/**
 * Kafka 이벤트 구독자
 * 
 * Saga Step 2: 알림 생성
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class KafkaEventSubscriber {
    
    private final NotificationApplicationService notificationService;
    
    /**
     * Saga Step 2: 알림 생성
     */
    @KafkaListener(topics = "chat.message.sent", groupId = "notification-service")
    public void onMessageSent(
        @Payload String message,
        @Header(KafkaHeaders.RECEIVED_TOPIC) String topic,
        @Header(KafkaHeaders.OFFSET) long offset
    ) {
        log.info("🟢 [Saga Step 2] 알림 생성 시작 - topic={}, offset={}", topic, offset);
        
        try {
            // 1. 이벤트 역직렬화
            MessageSentEventPayload event = parseEvent(message);
            
            // 2. 알림 생성 (비즈니스 로직)
            event.getRecipientIds().forEach(recipientId -> {
                try {
                    notificationService.createNotification(
                        recipientId,
                        NotificationType.CHAT,
                        "새로운 메시지: " + event.getContent(),
                        event.getMessageId()
                    );
                } catch (Exception e) {
                    log.error("❌ [Saga Step 2] 알림 생성 실패 - recipientId={}", recipientId, e);
                    // 보상 트랜잭션 트리거
                    publishCompensationEvent(event, recipientId, e);
                }
            });
            
            log.info("✅ [Saga Step 2] 완료");
            
        } catch (Exception e) {
            log.error("❌ [Saga Step 2] 처리 실패", e);
            // Dead Letter Queue로 이동
            sendToDeadLetterQueue(message, topic, offset, e);
        }
    }
    
    /**
     * 보상 트랜잭션 이벤트 발행
     */
    private void publishCompensationEvent(MessageSentEventPayload event, Integer recipientId, Exception error) {
        NotificationCreationFailedEvent compensationEvent = new NotificationCreationFailedEvent(
            event.getMessageId(),
            recipientId,
            error.getMessage()
        );
        
        // Kafka로 보상 이벤트 발행
        kafkaTemplate.send("notification.creation.failed", compensationEvent);
        
        log.warn("⚠️ [Compensation] 보상 이벤트 발행 - messageId={}, recipientId={}", 
            event.getMessageId(), recipientId);
    }
    
    /**
     * Dead Letter Queue로 전송
     */
    private void sendToDeadLetterQueue(String message, String topic, long offset, Exception error) {
        // DLQ 전송 로직
        log.error("💀 [DLQ] 메시지를 DLQ로 이동 - topic={}, offset={}, error={}", 
            topic, offset, error.getMessage());
    }
}
```

```java
// chat-service/src/main/java/com/goodee/chatservice/infrastructure/event/CompensationEventSubscriber.java
package com.goodee.chatservice.infrastructure.event;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/**
 * 보상 트랜잭션 이벤트 구독자
 * 
 * Saga Compensation: 롤백 처리
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class CompensationEventSubscriber {
    
    private final ChatRoomRepository chatRoomRepository;
    
    /**
     * 알림 생성 실패 시 보상 처리
     */
    @KafkaListener(topics = "notification.creation.failed", groupId = "chat-service-compensation")
    public void onNotificationFailed(String message) {
        log.warn("🔴 [Compensation] 알림 생성 실패 이벤트 수신");
        
        NotificationCreationFailedEvent event = parseEvent(message);
        
        // 보상 로직: 
        // 1. 메시지 상태 업데이트 (알림 전송 실패 표시)
        // 2. 재시도 큐에 추가
        // 3. 관리자 알림
        
        try {
            ChatMessage chatMessage = chatMessageRepository.findById(event.getMessageId())
                .orElseThrow();
            
            chatMessage.markNotificationFailed(event.getRecipientId());
            chatMessageRepository.save(chatMessage);
            
            log.info("✅ [Compensation] 보상 처리 완료 - messageId={}", event.getMessageId());
            
        } catch (Exception e) {
            log.error("❌ [Compensation] 보상 처리 실패", e);
            // 최종 에스컬레이션: 관리자 알림 등
        }
    }
}
```

### 4.2 Eventual Consistency 처리

```java
// shared/src/main/java/com/goodee/shared/infrastructure/retry/RetryableEventPublisher.java
package com.goodee.shared.infrastructure.retry;

import com.goodee.shared.domain.event.DomainEvent;
import com.goodee.shared.infrastructure.event.EventPublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.stereotype.Component;

/**
 * 재시도 가능한 이벤트 발행자
 * 
 * 네트워크 장애 등으로 이벤트 발행 실패 시 자동 재시도
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class RetryableEventPublisher {
    
    private final EventPublisher eventPublisher;
    
    /**
     * 최대 3번 재시도, 지수 백오프
     */
    @Retryable(
        value = { EventPublishException.class },
        maxAttempts = 3,
        backoff = @Backoff(delay = 1000, multiplier = 2)
    )
    public void publishWithRetry(DomainEvent event) {
        log.info("🔄 이벤트 발행 시도 - event={}", event.getEventType());
        
        try {
            eventPublisher.publish(event);
            log.info("✅ 이벤트 발행 성공");
        } catch (Exception e) {
            log.warn("⚠️ 이벤트 발행 실패, 재시도 예정 - error={}", e.getMessage());
            throw new EventPublishException("이벤트 발행 실패", e);
        }
    }
}
```

---

## 5. 배포 전략

### 5.1 Docker Compose (로컬 개발)

```yaml
# docker-compose.microservices.yml
version: '3.8'

services:
  # Eureka Server
  eureka-server:
    build: ./eureka-server
    container_name: eureka-server
    ports:
      - "8761:8761"
    networks:
      - microservices-network

  # API Gateway
  api-gateway:
    build: ./api-gateway
    container_name: api-gateway
    ports:
      - "8000:8000"
    depends_on:
      - eureka-server
    environment:
      EUREKA_CLIENT_SERVICEURL_DEFAULTZONE: http://eureka-server:8761/eureka/
    networks:
      - microservices-network

  # Chat Service (3 instances for load balancing)
  chat-service-1:
    build: ./chat-service
    container_name: chat-service-1
    ports:
      - "8081:8081"
    depends_on:
      - eureka-server
      - kafka
      - mysql-chat
    environment:
      SPRING_DATASOURCE_URL: jdbc:mysql://mysql-chat:3306/chat_db
      SPRING_KAFKA_BOOTSTRAP_SERVERS: kafka:29092
      EUREKA_CLIENT_SERVICEURL_DEFAULTZONE: http://eureka-server:8761/eureka/
    networks:
      - microservices-network

  chat-service-2:
    build: ./chat-service
    container_name: chat-service-2
    ports:
      - "8181:8081"
    depends_on:
      - eureka-server
      - kafka
      - mysql-chat
    environment:
      SPRING_DATASOURCE_URL: jdbc:mysql://mysql-chat:3306/chat_db
      SPRING_KAFKA_BOOTSTRAP_SERVERS: kafka:29092
      EUREKA_CLIENT_SERVICEURL_DEFAULTZONE: http://eureka-server:8761/eureka/
    networks:
      - microservices-network

  # Email Service
  email-service:
    build: ./email-service
    container_name: email-service
    ports:
      - "8082:8082"
    depends_on:
      - eureka-server
      - kafka
      - mysql-email
    environment:
      SPRING_DATASOURCE_URL: jdbc:mysql://mysql-email:3306/email_db
      SPRING_KAFKA_BOOTSTRAP_SERVERS: kafka:29092
      EUREKA_CLIENT_SERVICEURL_DEFAULTZONE: http://eureka-server:8761/eureka/
    networks:
      - microservices-network

  # Notification Service
  notification-service:
    build: ./notification-service
    container_name: notification-service
    ports:
      - "8083:8083"
    depends_on:
      - eureka-server
      - kafka
      - mysql-notification
    environment:
      SPRING_DATASOURCE_URL: jdbc:mysql://mysql-notification:3306/notification_db
      SPRING_KAFKA_BOOTSTRAP_SERVERS: kafka:29092
      EUREKA_CLIENT_SERVICEURL_DEFAULTZONE: http://eureka-server:8761/eureka/
    networks:
      - microservices-network

  # Databases
  mysql-chat:
    image: mysql:8.0
    container_name: mysql-chat
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: chat_db
      MYSQL_USER: chat_user
      MYSQL_PASSWORD: chat_password
    ports:
      - "3307:3306"
    networks:
      - microservices-network

  mysql-email:
    image: mysql:8.0
    container_name: mysql-email
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: email_db
      MYSQL_USER: email_user
      MYSQL_PASSWORD: email_password
    ports:
      - "3308:3306"
    networks:
      - microservices-network

  mysql-notification:
    image: mysql:8.0
    container_name: mysql-notification
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: notification_db
      MYSQL_USER: notification_user
      MYSQL_PASSWORD: notification_password
    ports:
      - "3309:3306"
    networks:
      - microservices-network

  # Kafka (from previous section)
  zookeeper:
    image: confluentinc/cp-zookeeper:7.5.0
    container_name: zookeeper
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
    networks:
      - microservices-network

  kafka:
    image: confluentinc/cp-kafka:7.5.0
    container_name: kafka
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:29092,PLAINTEXT_HOST://localhost:9092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
    networks:
      - microservices-network

networks:
  microservices-network:
    driver: bridge
```

### 5.2 Kubernetes 배포

#### Chat Service Deployment

```yaml
# k8s/chat-service/deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: chat-service
  namespace: coreconnect
spec:
  replicas: 3
  selector:
    matchLabels:
      app: chat-service
  template:
    metadata:
      labels:
        app: chat-service
    spec:
      containers:
      - name: chat-service
        image: coreconnect/chat-service:1.0.0
        ports:
        - containerPort: 8081
        env:
        - name: SPRING_PROFILES_ACTIVE
          value: "prod"
        - name: SPRING_DATASOURCE_URL
          valueFrom:
            secretKeyRef:
              name: chat-db-secret
              key: url
        - name: SPRING_KAFKA_BOOTSTRAP_SERVERS
          value: "kafka-service:9092"
        - name: EUREKA_CLIENT_SERVICEURL_DEFAULTZONE
          value: "http://eureka-server:8761/eureka/"
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /actuator/health/liveness
            port: 8081
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /actuator/health/readiness
            port: 8081
          initialDelaySeconds: 20
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: chat-service
  namespace: coreconnect
spec:
  selector:
    app: chat-service
  ports:
  - protocol: TCP
    port: 8081
    targetPort: 8081
  type: ClusterIP
```

### 5.3 배포 스크립트

```bash
# scripts/deploy-microservices.sh
#!/bin/bash

set -e

echo "🚀 마이크로서비스 배포 시작"

# 1. Eureka Server 배포
echo "📡 Eureka Server 배포..."
kubectl apply -f k8s/eureka-server/

# 2. API Gateway 배포
echo "🚪 API Gateway 배포..."
kubectl apply -f k8s/api-gateway/

# 3. 서비스 배포 (순차적으로)
echo "📦 알림 서비스 배포..."
kubectl apply -f k8s/notification-service/

echo "📦 이메일 서비스 배포..."
kubectl apply -f k8s/email-service/

echo "📦 채팅 서비스 배포..."
kubectl apply -f k8s/chat-service/

# 4. 배포 상태 확인
echo "✅ 배포 완료! 상태 확인 중..."
kubectl get pods -n coreconnect
kubectl get services -n coreconnect

echo "🎉 모든 마이크로서비스 배포 완료!"
```

---

## 6. 모니터링 및 운영

### 6.1 분산 추적 (Zipkin)

```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  zipkin:
    image: openzipkin/zipkin:latest
    container_name: zipkin
    ports:
      - "9411:9411"
    networks:
      - microservices-network
```

각 서비스에 Zipkin 설정 추가:

```yaml
# application.yml (모든 서비스)
spring:
  zipkin:
    base-url: http://localhost:9411
  sleuth:
    sampler:
      probability: 1.0  # 100% 샘플링 (개발환경)
```

### 6.2 로그 집계 (ELK Stack)

```yaml
# docker-compose.logging.yml
version: '3.8'

services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.10.0
    container_name: elasticsearch
    environment:
      - discovery.type=single-node
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    ports:
      - "9200:9200"
    networks:
      - microservices-network

  logstash:
    image: docker.elastic.co/logstash/logstash:8.10.0
    container_name: logstash
    volumes:
      - ./logstash/config/logstash.yml:/usr/share/logstash/config/logstash.yml
      - ./logstash/pipeline:/usr/share/logstash/pipeline
    ports:
      - "5044:5044"
      - "9600:9600"
    depends_on:
      - elasticsearch
    networks:
      - microservices-network

  kibana:
    image: docker.elastic.co/kibana/kibana:8.10.0
    container_name: kibana
    ports:
      - "5601:5601"
    depends_on:
      - elasticsearch
    networks:
      - microservices-network
```

---

## 7. 체크리스트

### Phase 1: DDD 적용 (모놀리스)
- [ ] 바운디드 컨텍스트 정의 완료
- [ ] 도메인 모델 구현 완료
- [ ] 도메인 이벤트 구현 완료
- [ ] Application Service 분리 완료
- [ ] 단위 테스트 작성 완료

### Phase 2: 데이터베이스 분리
- [ ] 스키마 분리 완료
- [ ] 외래키 제거 및 논리적 참조 변경
- [ ] 데이터 마이그레이션 스크립트 작성
- [ ] 통합 테스트 통과

### Phase 3: 마이크로서비스 전환
- [ ] Kafka 인프라 구축
- [ ] Eureka Server 구축
- [ ] API Gateway 구축
- [ ] 알림 서비스 분리 및 배포
- [ ] 이메일 서비스 분리 및 배포
- [ ] 채팅 서비스 분리 및 배포
- [ ] Saga 패턴 구현 및 테스트
- [ ] 모니터링 시스템 구축
- [ ] 부하 테스트 완료
- [ ] 프로덕션 배포

---

**작성일**: 2026-01-12  
**버전**: 1.0
