package com.goodee.coreconnect.common.entity;

import java.time.LocalDateTime;

import com.goodee.coreconnect.approval.entity.Document;
import com.goodee.coreconnect.board.entity.Board;
import com.goodee.coreconnect.chat.entity.Chat;
import com.goodee.coreconnect.common.notification.enums.NotificationType;
import com.goodee.coreconnect.schedule.entity.Schedule;
import com.goodee.coreconnect.user.entity.User;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.DynamicUpdate;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor // ★ 롬복 기본 생성자(생략 가능, 직접 protected Notification() {} 써도 OK)
@Entity
@Table(
    name = "notification",
    indexes = {
        // ⭐ 가장 중요: 사용자별 미읽은/미삭제 알림 조회 + 시간순 정렬
        // WHERE user_id = ? AND deleted_yn = false AND read_yn = false ORDER BY sent_at DESC
        @Index(
            name = "idx_user_deleted_read_sent", 
            columnList = "user_id, notification_deleted_yn, notification_read_yn, notification_sent_at DESC"
        ),
        
        // ⭐ 타입별 필터링 포함 조회 (가장 많이 사용되는 패턴)
        // WHERE user_id = ? AND deleted_yn = false AND read_yn = false AND type IN (...) ORDER BY sent_at DESC
        @Index(
            name = "idx_user_type_read_deleted_sent",
            columnList = "user_id, notification_type, notification_read_yn, notification_deleted_yn, notification_sent_at DESC"
        ),
        
        // ⭐ 채팅 메시지별 알림 조회
        // WHERE chat_message_id = ?
        @Index(
            name = "idx_chat_message",
            columnList = "chat_message_id"
        ),
        
        // ⭐ 문서별 알림 조회
        // WHERE doc_id = ?
        @Index(
            name = "idx_document",
            columnList = "doc_id"
        ),
        
        // ⭐ 게시판별 알림 조회
        // WHERE board_id = ?
        @Index(
            name = "idx_board",
            columnList = "board_id"
        ),
        
        // ⭐ 일정별 알림 조회
        // WHERE schedule_id = ?
        @Index(
            name = "idx_schedule",
            columnList = "schedule_id"
        ),
        
        // ⭐ 발신자별 알림 조회 (관리자용)
        // WHERE sender_id = ? ORDER BY sent_at DESC
        @Index(
            name = "idx_sender_sent",
            columnList = "sender_id, notification_sent_at DESC"
        ),
        
        // ⭐ 전체 알림 시간순 조회 (백업/통계용)
        @Index(
            name = "idx_sent_at",
            columnList = "notification_sent_at DESC"
        )
    }
)
@DynamicUpdate // 변경된 필드만 업데이트하도록 설정
public class Notification {
  
   @Id
   @GeneratedValue(strategy = GenerationType.IDENTITY)
   private Integer id;
   
  @Column(name = "notification_read_yn", nullable = false)
  private Boolean notificationReadYn = false;
   
   @Enumerated(EnumType.STRING)
   @Column(name = "notification_type", nullable = false, length = 20)
   private NotificationType notificationType;
   
   @Column(name = "notification_read_at")
   private LocalDateTime notificationReadAt;
   
   @Column(name = "notification_sent_at")
   private LocalDateTime notificationSentAt;
   
   @Column(name = "notification_deleted_yn")
   private Boolean notificationDeletedYn = false;
   
   @Column(name = "notification_sent_yn")
   private Boolean notificationSentYn;
   
   @Column(name = "notification_message", length = 255)
   private String notificationMessage;
   
   @ManyToOne
   @JoinColumn(name = "sender_id")
   private User sender;
   
   // N : 1 관계 (채팅메시지 테이블과 매핑)
   @ManyToOne(fetch = FetchType.LAZY)
   @JoinColumn(name = "chat_message_id")
   private Chat chat;
  
   @ManyToOne(fetch = FetchType.LAZY)
	 @JoinColumn(name = "doc_id")
	 private Document document;
  
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "board_id")
  private Board board;
  
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "schedule_id")
  private Schedule schedule;
   
   // N : 1 관계 (user 테이블과 매핑)
   // 알림 수신자
   @ManyToOne(fetch = FetchType.LAZY)
   @JoinColumn(name = "user_id")
   private User user;
   
  // protected Notification() {}
   
   public static Notification createNotification(
           User user,
           NotificationType notificationType,
           String notificationMessage,
           Chat chat,
           Document document,
           Board board,
           Schedule schedule,
           Boolean notificationReadYn,
           Boolean notificationSentYn,
           Boolean notificationDeletedYn,
           LocalDateTime notificationSentAt,
           LocalDateTime notificationReadAt,
           User sender
   ) {
       Notification notification = new Notification();
       notification.user = user;
       notification.notificationType = notificationType;
       notification.notificationMessage = notificationMessage;
      notification.chat = chat;
      notification.document = document;
      notification.board = board;
      notification.schedule = schedule;
      notification.notificationReadYn = notificationReadYn != null ? notificationReadYn : false;
      notification.notificationSentYn = notificationSentYn;
      notification.notificationDeletedYn = notificationDeletedYn != null ? notificationDeletedYn : false;
       notification.notificationSentAt = notificationSentAt;
       notification.notificationReadAt = notificationReadAt;
       notification.sender = sender;
       return notification;
   }
   
   // 알림 삭제시 사용하는 메서드
   public void markDeleted() {
	    this.notificationDeletedYn = true;
	}
   
   /**
    * 알림 전송 성공/실패 상태 및 시각을 변경하는 도메인 메서드
    * @param sentAt 전송 시각
    */
   public void markSent(LocalDateTime sentAt) {
       this.notificationSentYn = true;           // 성공: true, 필요시 파라미터로 받아도 됨
       this.notificationSentAt = sentAt;
   }
   
   /**
    * 알림 읽음 상태 및 읽은 시각을 변경하는 도메인 메서드
    * @param readAt 읽은 시각
    */
   public void markRead() {
       this.notificationReadYn = true;
       this.notificationReadAt = LocalDateTime.now();
   }
   
   /**
    * 알림을 읽지 않음 상태로 변경하는 도메인 메서드
    */
   public void markUnread() {
       this.notificationReadYn = false;
       this.notificationReadAt = null;
   }
   
}
