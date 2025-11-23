package com.goodee.coreconnect.common.notification.service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.DefaultTransactionDefinition;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.goodee.coreconnect.board.entity.Board;
import com.goodee.coreconnect.board.repository.BoardRepository;
import com.goodee.coreconnect.chat.dto.response.NotificationReadResponseDTO;
import com.goodee.coreconnect.chat.repository.NotificationRepository;
import com.goodee.coreconnect.common.entity.Notification;
import com.goodee.coreconnect.common.notification.dto.NotificationPayload;
import com.goodee.coreconnect.common.notification.enums.NotificationType;
import com.goodee.coreconnect.schedule.entity.Schedule;
import com.goodee.coreconnect.schedule.repository.ScheduleRepository;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.repository.UserRepository;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
//import org.springframework.data.redis.core.StringRedisTemplate;
//import org.springframework.beans.factory.ObjectProvider;

/**
 * NotificationService - 알림 저장 및 트랜잭션 커밋 이후(후커밋) 실시간 전송 처리 (Redis는 주석)
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final BoardRepository boardRepository;
    private final ScheduleRepository scheduleRepository;
    private final WebSocketDeliveryService webSocketDeliveryService;
    private final ObjectMapper objectMapper;
    private final PlatformTransactionManager transactionManager;
    //private final ObjectProvider<StringRedisTemplate> redisTemplateProvider;

    public NotificationReadResponseDTO markAsRead(Integer notificationId, String email) {
        Notification notification = notificationRepository.findById(notificationId)
            .orElseThrow(() -> new IllegalArgumentException("알림 없음: " + notificationId));
        notification.markRead();
        notificationRepository.save(notification);
        return new NotificationReadResponseDTO(notification.getId(), notification.getNotificationReadYn());
    }

    @Transactional
    public void sendNotification(
        Integer recipientId,
        NotificationType type,
        String message,
        Integer chatId,
        Integer roomId,
        Integer senderId,
        String senderName,
        Integer scheduleId
    ) {
        // 로그 추가: scheduleId 전달 확인
        if (type == NotificationType.SCHEDULE) {
            log.info("[NotificationService] sendNotification 호출: type=SCHEDULE, scheduleId={}, message={}", scheduleId, message);
        }
        
        if (recipientId == null) {
            log.warn("[NotificationService] recipientId가 null입니다. 알림 전송 중단.");
            return;
        }
        if (senderId == null) {
            log.warn("[NotificationService] senderId가 null입니다. 알림 전송 중단.");
            return;
        }
        User recipient = userRepository.findById(recipientId)
            .orElseThrow(() -> new IllegalArgumentException("알림 수신자 없음: " + recipientId));
        User sender = userRepository.findById(senderId)
            .orElseThrow(() -> new IllegalArgumentException("알림 발신자 없음: " + senderId));

        if ((type == NotificationType.EMAIL || type == NotificationType.NOTICE 
                || type == NotificationType.APPROVAL || type == NotificationType.SCHEDULE)
                && (chatId != null || roomId != null)) {
            log.warn("[NotificationService] {} 알림에 chatId/roomId가 전달됨 -> 무시", type.name());
            chatId = null;
            roomId = null;
        }

        // scheduleId가 있으면 Schedule 엔티티 조회
        Schedule schedule = null;
        if (scheduleId != null) {
            try {
                schedule = scheduleRepository.findById(scheduleId)
                    .orElse(null); // schedule이 없어도 알림은 전송
                if (schedule == null) {
                    log.warn("[NotificationService] scheduleId={}에 해당하는 Schedule을 찾을 수 없습니다.", scheduleId);
                } else {
                    log.info("[NotificationService] scheduleId={}에 해당하는 Schedule을 찾았습니다. 제목: {}", scheduleId, schedule.getTitle());
                }
            } catch (Exception e) {
                log.error("[NotificationService] scheduleId={} 조회 중 오류 발생", scheduleId, e);
            }
        }

        Notification notification = Notification.createNotification(
            recipient, type, message, null, null, null, schedule, false, false, false,
            LocalDateTime.now(), null, sender
        );
        notificationRepository.save(notification);

        NotificationPayload payload = new NotificationPayload();
        payload.setNotificationId(notification.getId());
        payload.setSenderId(sender.getId());
        payload.setSenderName(sender.getName());
        payload.setRecipientId(recipient.getId());
        payload.setReceiverName(recipient.getName());
        payload.setMessage(notification.getNotificationMessage());
        payload.setNotificationType(type.name());
        payload.setCreatedAt(notification.getNotificationSentAt() != null
            ? notification.getNotificationSentAt()
            : LocalDateTime.now());

        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                try {
                    webSocketDeliveryService.sendToUser(recipientId, payload);
                    
                    // 전송 성공 후 sentYn 업데이트
                    notificationRepository.findById(payload.getNotificationId())
                    .ifPresent(n -> n.markSent(LocalDateTime.now()));
                    
                } catch (Exception e) {
                    log.warn("[NotificationService][afterCommit] 로컬 전송 실패 recipientId={}: {}", recipientId, e.getMessage(), e);
                }
                /*
                try {
                    StringRedisTemplate redisTemplate = redisTemplateProvider.getIfAvailable();
                    if (redisTemplate != null) {
                        String channel = "notifications";
                        String json = objectMapper.writeValueAsString(payload);
                        redisTemplate.convertAndSend(channel, json);
                    }
                } catch (Exception e) {
                    log.warn("[NotificationService][afterCommit] redis publish 실패 recipientId={}: {}", recipientId, e.getMessage(), e);
                }
                */
                log.info("[NotificationService] 알림 후커밋 전송 완료: recipientId={}, notificationId={}", recipientId, payload.getNotificationId());
            }
        });
    }

    // @Transactional 제거 - TransactionTemplate으로 명시적 트랜잭션 관리
    public void sendNotificationToUsers(
        List<Integer> recipientIds,
        NotificationType type,
        String message,
        Integer chatId,
        Integer roomId,
        Integer senderId,
        String senderName,
        Integer boardId,
        Integer scheduleId
    ) {
        log.info("[NotificationService] ===== sendNotificationToUsers 시작 ===== type={}, recipientCount={}, senderId={}, boardId={}, scheduleId={}", 
                type, recipientIds != null ? recipientIds.size() : 0, senderId, boardId, scheduleId);
        
        try {
            // TransactionTemplate으로 명시적 트랜잭션 관리 (REQUIRES_NEW)
            DefaultTransactionDefinition def = new DefaultTransactionDefinition();
            def.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
            def.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);
            TransactionTemplate transactionTemplate = new TransactionTemplate(transactionManager, def);
            
            log.info("[NotificationService] TransactionTemplate 생성 완료: propagation=REQUIRES_NEW");
        
        @SuppressWarnings("unchecked")
        List<NotificationPayload> notificationPayloads = (List<NotificationPayload>) transactionTemplate.execute(status -> {
            try {
            // 트랜잭션 활성 상태 확인
            boolean isTransactionActive = org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive();
            String transactionName = org.springframework.transaction.support.TransactionSynchronizationManager.getCurrentTransactionName();
            log.info("[NotificationService] TransactionTemplate 내부 - 트랜잭션 활성: {}, 트랜잭션 이름: {}, readOnly: {}", 
                    isTransactionActive, transactionName, status.isReadOnly());
            
            log.info("[NotificationService] TransactionTemplate 내부 진입 확인: type={}, senderId={}, recipientIds.size()={}", 
                    type, senderId, recipientIds != null ? recipientIds.size() : 0);
            
            if (senderId == null) {
                log.warn("[NotificationService] senderId가 null입니다. 여러명 알림 중단. type={}", type);
                return new ArrayList<>(); // null 대신 빈 리스트 반환
            }
            
            log.info("[NotificationService] senderId 검증 통과: senderId={}", senderId);
            
            User sender = null;
            try {
                log.info("[NotificationService] 발신자 조회 시작: senderId={}, type={}", senderId, type);
                log.info("[NotificationService] userRepository 객체 확인: {}", userRepository != null ? "존재" : "null");
                
                // Optional로 조회하여 null 체크
                log.info("[NotificationService] userRepository.findById() 호출 직전: senderId={}", senderId);
                java.util.Optional<User> senderOpt = null;
                try {
                    senderOpt = userRepository.findById(senderId);
                    log.info("[NotificationService] userRepository.findById() 호출 완료: senderId={}", senderId);
                } catch (Exception findException) {
                    log.error("[NotificationService] ⚠️ userRepository.findById() 호출 중 예외 발생: senderId={}, 예외 타입: {}, 메시지: {}", 
                            senderId, findException.getClass().getName(), findException.getMessage(), findException);
                    findException.printStackTrace();
                    return new ArrayList<>();
                }
                
                log.info("[NotificationService] 발신자 조회 완료 (Optional): senderId={}, isPresent={}", senderId, senderOpt != null && senderOpt.isPresent());
                
                if (!senderOpt.isPresent()) {
                    log.error("[NotificationService] 발신자를 찾을 수 없습니다: senderId={}, type={}", senderId, type);
                    return new ArrayList<>(); // 발신자가 없으면 빈 리스트 반환
                }
                
                sender = senderOpt.get();
                log.info("[NotificationService] 발신자 객체 추출 성공: senderId={}", senderId);
                
                if (sender == null) {
                    log.error("[NotificationService] 발신자 객체가 null입니다: senderId={}, type={}", senderId, type);
                    return new ArrayList<>();
                }
                
                String actualSenderName = sender.getName();
                log.info("[NotificationService] 발신자 조회 성공: senderId={}, actualSenderName={}", senderId, actualSenderName);
            } catch (Exception e) {
                log.error("[NotificationService] ⚠️ 발신자 조회 중 예외 발생: senderId={}, type={}", senderId, type);
                log.error("[NotificationService] 예외 타입: {}", e.getClass().getName());
                log.error("[NotificationService] 예외 메시지: {}", e.getMessage());
                log.error("[NotificationService] 예외 스택 트레이스:", e);
                e.printStackTrace();
                return new ArrayList<>(); // 예외 발생 시 빈 리스트 반환 (예외를 던지지 않음)
            }
            
            log.info("[NotificationService] recipientIds 검증 시작: recipientIds={}, size={}", 
                    recipientIds, recipientIds != null ? recipientIds.size() : 0);
            
            if (recipientIds == null || recipientIds.isEmpty()) {
                log.warn("[NotificationService] recipientIds가 비어있습니다. 중단. type={}, senderId={}", type, senderId);
                return new ArrayList<>(); // null 대신 빈 리스트 반환
            }
            
            log.info("[NotificationService] recipientIds 검증 통과: size={}", recipientIds.size());
            
            // boardId가 있으면 Board 엔티티 조회
            // afterCommit 콜백 내부에서 새로운 트랜잭션을 시작할 때, 이전 트랜잭션의 커밋이 완전히 반영되기 전일 수 있으므로
            // 재시도 로직 추가
            Board board = null;
            if (boardId != null) {
                int retryCount = 0;
                int maxRetries = 3;
                while (retryCount < maxRetries && board == null) {
                    try {
                        board = boardRepository.findById(boardId)
                            .orElse(null); // board가 없어도 알림은 전송
                        if (board == null) {
                            retryCount++;
                            if (retryCount < maxRetries) {
                                log.warn("[NotificationService] boardId={} 조회 실패 (재시도 {}/{})", boardId, retryCount, maxRetries);
                                Thread.sleep(100); // 100ms 대기 후 재시도
                            } else {
                                log.warn("[NotificationService] boardId={}에 해당하는 Board를 찾을 수 없습니다. (최대 재시도 횟수 초과)", boardId);
                            }
                        } else {
                            log.info("[NotificationService] boardId={}에 해당하는 Board를 찾았습니다. 제목: {} (재시도 횟수: {})", 
                                    boardId, board.getTitle(), retryCount);
                        }
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        log.error("[NotificationService] boardId={} 조회 중 인터럽트 발생", boardId, e);
                        break;
                    } catch (Exception e) {
                        log.error("[NotificationService] boardId={} 조회 중 오류 발생", boardId, e);
                        break;
                    }
                }
            }
            
            // scheduleId가 있으면 Schedule 엔티티 조회
            Schedule schedule = null;
            if (scheduleId != null) {
                try {
                    schedule = scheduleRepository.findById(scheduleId)
                        .orElse(null); // schedule이 없어도 알림은 전송
                    if (schedule == null) {
                        log.warn("[NotificationService] scheduleId={}에 해당하는 Schedule을 찾을 수 없습니다.", scheduleId);
                    } else {
                        log.info("[NotificationService] scheduleId={}에 해당하는 Schedule을 찾았습니다. 제목: {}", scheduleId, schedule.getTitle());
                    }
                } catch (Exception e) {
                    log.error("[NotificationService] scheduleId={} 조회 중 오류 발생", scheduleId, e);
                }
            }
            

            List<NotificationPayload> resultPayloads = new ArrayList<>(recipientIds.size());
            int savedCount = 0;
            int failedCount = 0;
            
            for (Integer rid : recipientIds) {
                if (rid == null) {
                    log.warn("[NotificationService] recipientId 리스트에 null 값 존재 - 스킵");
                    failedCount++;
                    continue;
                }
                
                try {
                    log.info("[NotificationService] ===== 알림 저장 시작 ===== type={}, recipientId={}, senderId={}", type, rid, senderId);
                    
                    User receiver = userRepository.findById(rid)
                        .orElseThrow(() -> new EntityNotFoundException("알림 수신자 없음: " + rid));
                    
                    log.info("[NotificationService] 수신자 조회 성공: recipientId={}, recipientName={}", rid, receiver.getName());

                    Notification notification = Notification.createNotification(
                        receiver, type, message, null, null, board, schedule, false, false, false,
                        LocalDateTime.now(), null, sender
                    );
                    
                    // 알림 생성 직후 readYn 확인 로그
                    log.info("[NotificationService] 알림 생성 직후 상태 확인: type={}, recipientId={}, readYn={}, sentYn={}, deletedYn={}", 
                            type, rid, notification.getNotificationReadYn(), notification.getNotificationSentYn(), notification.getNotificationDeletedYn());
                    
                    // notificationType이 제대로 설정되었는지 확인
                    if (notification.getNotificationType() == null) {
                        log.error("[NotificationService] ❌ 알림 생성 실패: notificationType이 null입니다! type={}, message={}, recipientId={}", 
                                type, message, rid);
                        failedCount++;
                        continue;
                    }
                    
                    if (notification.getNotificationType() != type) {
                        log.error("[NotificationService] ❌ 알림 생성 시 타입 불일치: 기대={}, 실제={}, recipientId={}", 
                                type, notification.getNotificationType(), rid);
                        failedCount++;
                        continue;
                    }
                    
                    log.info("[NotificationService] ✅ 알림 엔티티 생성 완료: type={}, notificationType={}, message={}, recipientId={}, senderId={}", 
                            type, notification.getNotificationType(), message, receiver.getId(), sender.getId());
                    
                    // saveAndFlush를 사용하여 즉시 DB에 반영
                    log.info("[NotificationService] DB 저장 시작: saveAndFlush 호출 전, readYn={}", notification.getNotificationReadYn());
                    notification = notificationRepository.saveAndFlush(notification);
                    log.info("[NotificationService] DB 저장 완료: saveAndFlush 호출 후, notificationId={}, readYn={}", 
                            notification.getId(), notification.getNotificationReadYn());
                    
                    // 저장 후 flush하여 즉시 DB에 반영
                    notificationRepository.flush();
                    
                    // 저장 직후 readYn 확인 (JPA 엔티티 상태)
                    if (Boolean.TRUE.equals(notification.getNotificationReadYn())) {
                        log.warn("[NotificationService] ⚠️ 저장 후 엔티티의 readYn이 true입니다! false로 강제 업데이트합니다. notificationId={}, type={}", 
                                notification.getId(), type);
                        notification.markUnread();
                        notification = notificationRepository.saveAndFlush(notification);
                        log.info("[NotificationService] 알림 강제 업데이트 완료: notificationId={}, readYn={}", 
                                notification.getId(), notification.getNotificationReadYn());
                    }
                    
                    // 저장 후 notificationType 재확인
                    if (notification.getNotificationType() != type) {
                        log.error("[NotificationService] ❌ 알림 저장 후 타입 불일치: 기대={}, 실제={}, notificationId={}", 
                                type, notification.getNotificationType(), notification.getId());
                        failedCount++;
                        continue;
                    }
                    
                    // 저장 직후 같은 트랜잭션 내에서 조회하여 실제로 저장되었는지 확인
                    Notification savedNotification = notificationRepository.findById(notification.getId()).orElse(null);
                    if (savedNotification == null) {
                        log.error("[NotificationService] ❌ 알림 저장 실패: DB에서 조회되지 않음! notificationId={}, type={}, recipientId={}", 
                                notification.getId(), type, rid);
                        failedCount++;
                        continue;
                    }
                    
                    if (savedNotification.getNotificationType() != type) {
                        log.error("[NotificationService] ❌ DB 조회 후 타입 불일치: 기대={}, 실제={}, notificationId={}", 
                                type, savedNotification.getNotificationType(), savedNotification.getId());
                        failedCount++;
                        continue;
                    }
                    
                    log.info("[NotificationService] ✅✅✅ 알림 저장 완료 (DB 반영 확인됨) ✅✅✅ notificationId={}, type={}, notificationType={}, recipientId={}, senderId={}, boardId={}", 
                            savedNotification.getId(), type, savedNotification.getNotificationType(), receiver.getId(), sender.getId(), boardId);
                    
                    NotificationPayload payload = new NotificationPayload();
                    payload.setNotificationId(savedNotification.getId());
                    payload.setSenderId(sender.getId());
                    payload.setSenderName(sender.getName());
                    payload.setRecipientId(receiver.getId());
                    payload.setReceiverName(receiver.getName());
                    payload.setMessage(message);
                    payload.setNotificationType(type.name());
                    payload.setCreatedAt(savedNotification.getNotificationSentAt());


                    resultPayloads.add(payload);
                    savedCount++;
                    
                    log.info("[NotificationService] ✅ 알림 저장 성공: savedCount={}, failedCount={}", savedCount, failedCount);
                } catch (Exception e) {
                    log.error("[NotificationService] ❌ 알림 저장 중 예외 발생: type={}, recipientId={}, senderId={}, 예외 메시지: {}", 
                            type, rid, senderId, e.getMessage(), e);
                    e.printStackTrace(); // 스택 트레이스 출력
                    failedCount++;
                }
            }
            
            log.info("[NotificationService] ===== 알림 저장 요약 ===== type={}, 총 요청={}, 성공={}, 실패={}", 
                    type, recipientIds.size(), savedCount, failedCount);
            
            // 트랜잭션 커밋 후 WebSocket 전송을 위해 resultPayloads를 저장
            // TransactionTemplate의 afterCommit은 없으므로, 여기서 직접 WebSocket 전송
            // 하지만 트랜잭션이 커밋된 후에 전송해야 하므로, 별도로 처리

            log.info("[NotificationService] ===== 트랜잭션 커밋 전 ===== type={}, 저장된 알림 수={}", type, resultPayloads.size());
            
            // WebSocket 전송은 트랜잭션 커밋 후에 실행되도록 별도 처리
            // 여기서는 저장만 하고, WebSocket 전송은 메서드 종료 후 처리
            return resultPayloads; // TransactionTemplate에서 반환
            } catch (Exception e) {
                log.error("[NotificationService] TransactionTemplate 내부에서 예외 발생: type={}, recipientCount={}, senderId={}, 예외: {}", 
                        type, recipientIds != null ? recipientIds.size() : 0, senderId, e.getMessage(), e);
                e.printStackTrace();
                // 예외가 발생해도 빈 리스트 반환 (일부 저장 성공 시를 위해)
                return new ArrayList<>();
            }

        });
        
        // TransactionTemplate 실행 후 (트랜잭션 커밋 완료)
        log.info("[NotificationService] ===== TransactionTemplate 실행 완료 (트랜잭션 커밋됨) ===== type={}, notificationPayloads={}", 
                type, notificationPayloads != null ? notificationPayloads.size() : 0);
        
        // 트랜잭션 커밋 후 WebSocket 전송
        if (notificationPayloads != null && !notificationPayloads.isEmpty()) {
            log.info("[NotificationService] ===== WebSocket 전송 시작 ===== count={}", notificationPayloads.size());
            for (NotificationPayload p : notificationPayloads) {
                try {
                    webSocketDeliveryService.sendToUser(p.getRecipientId(), p);
                    
                    // 전송 성공 후 sentYn 업데이트 (별도 트랜잭션)
                    notificationRepository.findById(p.getNotificationId())
                        .ifPresent(n -> {
                            n.markSent(LocalDateTime.now());
                            notificationRepository.save(n);
                        });
                    
                } catch (Exception e) {
                    log.warn("[NotificationService] WebSocket 전송 실패 recipientId={}: {}", p.getRecipientId(), e.getMessage(), e);
                }
            }
            log.info("[NotificationService] ===== WebSocket 전송 완료 ===== count={}", notificationPayloads.size());
        } else {
            log.warn("[NotificationService] WebSocket 전송할 notificationPayloads가 없습니다. type={}", type);
        }
        
        log.info("[NotificationService] ===== sendNotificationToUsers 종료 ===== type={}, 저장된 알림 수={}", 
                type, notificationPayloads != null ? notificationPayloads.size() : 0);
        } catch (Exception e) {
            log.error("[NotificationService] ===== sendNotificationToUsers 실행 중 예외 발생 ===== type={}, recipientCount={}, senderId={}, 예외: {}", 
                    type, recipientIds != null ? recipientIds.size() : 0, senderId, e.getMessage(), e);
            e.printStackTrace(); // 스택 트레이스 출력
            // 예외를 다시 던지지 않고 로그만 남김 (afterCommit에서 호출되므로 예외를 던지면 문제 발생 가능)
            // 알림 전송 실패는 로그로만 처리하고, 게시글 저장 등의 주요 트랜잭션에는 영향을 주지 않음
        }
    }
}