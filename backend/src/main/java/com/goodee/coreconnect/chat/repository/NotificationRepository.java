package com.goodee.coreconnect.chat.repository;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.goodee.coreconnect.common.entity.Notification;
import com.goodee.coreconnect.common.notification.enums.NotificationType;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Integer> {

	List<Notification> findByChatId(Integer id);

	List<Notification> findByUserId(Integer id);
	
	@Modifying
	@Query("UPDATE Document d SET d.docDeletedYn = true WHERE d.id = :documentId")
	void deleteByDocumentId(@Param("documentId") Integer documentId);
	
    List<Notification> findByDocumentId(Integer documentId);

   // @Query("SELECT n FROM Notification n " +
   // 	       "WHERE n.user.id = :userId " +
   // 	       "AND n.notificationReadYn = false " +
   // 	       "AND n.notificationType IN (:types)")
//	List<Notification> findUnreadByUserIdAndTypes(@Param("userId") Integer userId,
	                                           //   @Param("types") List<NotificationType> types);

	//List<Notification> findByUserIdAndNotificationReadYnIsFalse(Integer userId);
	
    @Query("SELECT n FROM Notification n " +
    	       "JOIN FETCH n.user " +
    	       "WHERE n.user.id = :userId " +
    	       "AND n.notificationReadYn = false " +
    	       "AND n.notificationType IN (:types)")
    	List<Notification> findUnreadByUserIdAndTypes(@Param("userId") Integer userId,
    	                                              @Param("types") List<NotificationType> types);
	
    
    // 4. 나에게 온 알림만 조회
    @Query("SELECT n FROM Notification n WHERE n.user.id = :userId ORDER BY n.notificationSentAt DESC")
    List<Notification> findByUserIdOrderBySentAtDesc(@Param("userId") Integer userId);

    // 4. 나에게 온 안읽은 알림 조회 (참고)
    @Query("SELECT n FROM Notification n WHERE n.user.id = :userId AND n.notificationReadYn = false AND (n.notificationDeletedYn = false OR n.notificationDeletedYn IS NULL) ORDER BY n.notificationSentAt DESC")
    List<Notification> findUnreadByUserId(@Param("userId") Integer userId);
    
    @Query("SELECT DISTINCT n FROM Notification n " +
    	       "JOIN FETCH n.user " +
    	       "LEFT JOIN FETCH n.sender " +
    	       "LEFT JOIN FETCH n.document " +
    	       "LEFT JOIN FETCH n.board " +
    	       "LEFT JOIN FETCH n.schedule " +
    	       "WHERE n.user.id = :userId " +
    	       "AND (n.notificationReadYn = false OR n.notificationReadYn IS NULL) " +
    	       "AND (n.notificationDeletedYn = false OR n.notificationDeletedYn IS NULL) " +
    	       "AND n.notificationType IN (:types) " +
    	       "ORDER BY n.notificationSentAt DESC")
    	List<Notification> findUnreadByUserIdAndTypesOrderBySentAtDesc(
    	    @Param("userId") Integer userId,
    	    @Param("types") List<NotificationType> types
    	);
    
    // ========== ⭐ 페이징 지원 메서드 (성능 최적화) ==========
    
    /**
     * 사용자의 모든 알림 조회 (페이징)
     * - 10만개의 알림이 있어도 필요한 만큼만 조회하여 성능 향상
     */
    @Query("SELECT n FROM Notification n " +
           "WHERE n.user.id = :userId " +
           "ORDER BY n.notificationSentAt DESC")
    Page<Notification> findByUserIdOrderBySentAtDesc(
        @Param("userId") Integer userId, 
        Pageable pageable
    );
    
    /**
     * 사용자의 미읽은 알림 조회 (페이징)
     * - idx_user_deleted_read_sent 인덱스 활용
     */
    @Query("SELECT n FROM Notification n " +
           "WHERE n.user.id = :userId " +
           "AND n.notificationReadYn = false " +
           "AND (n.notificationDeletedYn = false OR n.notificationDeletedYn IS NULL) " +
           "ORDER BY n.notificationSentAt DESC")
    Page<Notification> findUnreadByUserId(
        @Param("userId") Integer userId, 
        Pageable pageable
    );
    
    /**
     * 사용자의 특정 타입 미읽은 알림 조회 (페이징)
     * - idx_user_type_read_deleted_sent 인덱스 활용
     * - 가장 많이 사용되는 패턴
     */
    @Query("SELECT n FROM Notification n " +
           "WHERE n.user.id = :userId " +
           "AND n.notificationType IN (:types) " +
           "AND n.notificationReadYn = false " +
           "AND (n.notificationDeletedYn = false OR n.notificationDeletedYn IS NULL) " +
           "ORDER BY n.notificationSentAt DESC")
    Page<Notification> findUnreadByUserIdAndTypesPaged(
        @Param("userId") Integer userId,
        @Param("types") List<NotificationType> types,
        Pageable pageable
    );
    
    /**
     * 사용자별 미읽은 알림 개수 조회 (카운트만)
     * - Covering Index로 매우 빠른 조회
     * - 인덱스만으로 결과 반환 (테이블 접근 불필요)
     */
    @Query("SELECT COUNT(n) FROM Notification n " +
           "WHERE n.user.id = :userId " +
           "AND n.notificationReadYn = false " +
           "AND (n.notificationDeletedYn = false OR n.notificationDeletedYn IS NULL)")
    long countUnreadByUserId(@Param("userId") Integer userId);
    
    /**
     * 사용자별 특정 타입 미읽은 알림 개수 조회
     */
    @Query("SELECT COUNT(n) FROM Notification n " +
           "WHERE n.user.id = :userId " +
           "AND n.notificationType IN (:types) " +
           "AND n.notificationReadYn = false " +
           "AND (n.notificationDeletedYn = false OR n.notificationDeletedYn IS NULL)")
    long countUnreadByUserIdAndTypes(
        @Param("userId") Integer userId,
        @Param("types") List<NotificationType> types
    );
    
    /** 특정 사용자가 보낸 모든 알림 조회 (sentYn 보정용) */
    List<Notification> findBySenderId(Integer senderId);
}
