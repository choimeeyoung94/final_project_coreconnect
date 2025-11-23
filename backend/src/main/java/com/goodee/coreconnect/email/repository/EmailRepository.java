package com.goodee.coreconnect.email.repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.goodee.coreconnect.email.entity.Email;
import com.goodee.coreconnect.email.enums.EmailStatusEnum;

import org.springframework.data.repository.query.Param; 

public interface EmailRepository extends JpaRepository<Email, Integer> {

	 // [수정] senderId (정수)로 조회하는 메서드 (이메일 문자열 아님!)
    Page<Email> findBySenderId(Integer senderId, Pageable pageable);

    // 보낸메일함 조회 시 SENT 상태만 조회 (휴지통/삭제 상태 제외)
    @Query("SELECT e FROM Email e " +
           "WHERE e.senderId = :senderId " +
           "AND e.emailStatus = com.goodee.coreconnect.email.enums.EmailStatusEnum.SENT " +
           "AND e.emailSentTime IS NOT NULL " +
           "AND (" +
           "    :keyword IS NULL OR :keyword = '' OR (" +
           "        (:searchType = 'TITLE' AND LOWER(e.emailTitle) LIKE LOWER(CONCAT('%', :keyword, '%'))) OR " +
           "        (:searchType = 'CONTENT' AND LOWER(e.emailContent) LIKE LOWER(CONCAT('%', :keyword, '%'))) OR " +
           "        (:searchType = 'TITLE_CONTENT' AND (" +
           "            LOWER(e.emailTitle) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "            LOWER(e.emailContent) LIKE LOWER(CONCAT('%', :keyword, '%'))" +
           "        ))" +
           "    )" +
           ") " +
           "ORDER BY e.emailSentTime DESC")
    Page<Email> findBySenderIdExcludingTrash(
        @Param("senderId") Integer senderId,
        Pageable pageable,
        @Param("searchType") String searchType,
        @Param("keyword") String keyword
    );

	// 내가 보낸 이메일 중 특정 상태(Bounce 등)만 페이징
	Page<com.goodee.coreconnect.email.entity.Email> findBySenderIdAndEmailStatus(Integer userId, EmailStatusEnum bounce, Pageable pageable);

	// [추가] 내가 보낸 이메일 중 특정 상태(DRAFT 등) + senderEmail 기준 페이징 조회
    Page<Email> findBySenderEmailAndEmailStatus(String senderEmail, EmailStatusEnum emailStatus, Pageable pageable);

    // [추가] 임시보관함 카운트용
    long countBySenderEmailAndEmailStatus(String senderEmail, EmailStatusEnum emailStatus);

    Optional<Email> findByEmailIdAndSenderEmailAndEmailStatus(
    	    Integer emailId, String senderEmail, EmailStatusEnum emailStatus);

    // 예약상태 & 예약시각이 도달(이전/같음)한 이메일 전체 조회
    List<Email> findAllByEmailStatusAndReservedAtLessThanEqual(EmailStatusEnum emailStatus, LocalDateTime reservedAt);

    @Modifying(clearAutomatically = true)
    @Query("UPDATE Email e SET e.emailStatus = :status WHERE e.emailId IN :ids")
    int updateEmailStatusByIds(@Param("ids") List<Integer> ids, @Param
    		("status") EmailStatusEnum status);
 // 정렬기준 추가 (emailSentTime 내림차순)
    Page<Email> findBySenderEmailAndEmailStatusOrderByEmailSentTimeDesc(String senderEmail, EmailStatusEnum emailStatus, Pageable pageable);
    
    // 임시보관함 조회용 (DRAFT 상태, emailId 내림차순 정렬 - 최신 저장순)
    @Query("SELECT e FROM Email e " +
           "WHERE e.senderEmail = :senderEmail " +
           "AND e.emailStatus = :emailStatus " +
           "ORDER BY e.emailId DESC")
    Page<Email> findDraftboxBySenderEmailAndEmailStatus(
        @Param("senderEmail") String senderEmail,
        @Param("emailStatus") EmailStatusEnum emailStatus,
        Pageable pageable
    );

    /*
     * 기존 JPQL 방식(수신자 주소 기준)도 유지되어 있으면 괜찮지만,
     * 실제 "사용자별 휴지통 여부"는 mail_user_visibility 테이블을 참조해야 합니다.
     *
     * 아래는 mail_user_visibility 테이블을 직접 조인하는 native query입니다.
     * - userId: 사용자 ID (정수)
     * - deleted: DB에 1/0 또는 true/false 로 저장되는 형태에 따라 조건을 맞춰주세요 (아래는 deleted = 1 기준)
     *
     * NOTE:
     * - nativeQuery 사용 시 컬럼/테이블 명을 DB 실제 이름으로 맞춰야 합니다.
     * - countQuery는 페이징을 위해 필요합니다.
     */

    @Query(value = "SELECT m.mail_id FROM mail_user_visibility m WHERE m.user_id = :userId AND m.deleted = 1 ORDER BY m.deleted_at DESC", nativeQuery = true)
    List<Integer> findDeletedMailIdsByUserId(@Param("userId") Integer userId);

    /*
     * NEW: 예약메일 목록 조회 (예약시간(reservedAt) 이후/미래의 예약된 메일을 조회)
     * - 수신자 기준(EmailRecipient)으로 조회
     */
    @Query(value = "SELECT e FROM Email e, EmailRecipient r " +
                   "WHERE r.email = e " +
                   "  AND r.emailRecipientAddress = :userEmail " +
                   "  AND e.reservedAt IS NOT NULL " +
                   "  AND e.reservedAt > :now",
           countQuery = "SELECT count(e) FROM Email e, EmailRecipient r " +
                        "WHERE r.email = e " +
                        "  AND r.emailRecipientAddress = :userEmail " +
                        "  AND e.reservedAt IS NOT NULL " +
                        "  AND e.reservedAt > :now")
    Page<Email> findScheduledByRecipientEmailAfter(@Param("userEmail") String userEmail,
                                                  @Param("now") LocalDateTime now,
                                                  Pageable pageable);

    /*
     * Optional: 수신자의 모든 메일(휴지통 포함) 조회 (별도 필요 시)
     */
    @Query(value = "SELECT e FROM Email e, EmailRecipient r " +
                   "WHERE r.email = e " +
                   "  AND r.emailRecipientAddress = :userEmail",
           countQuery = "SELECT count(e) FROM Email e, EmailRecipient r " +
                        "WHERE r.email = e " +
                        "  AND r.emailRecipientAddress = :userEmail")
    Page<Email> findByRecipientEmail(@Param("userEmail") String userEmail, Pageable pageable);
    
 // id 리스트로 Email 조회 (정렬/페이징은 서비스에서 처리)
    List<Email> findByEmailIdIn(List<Integer> ids);
    
 // 아래 메서드를 EmailRepository 인터페이스에 추가하세요.
 // 주의: nativeQuery에서 사용한 테이블/컬럼명(email, email_id, mail_user_visibility, mail_id, user_id, deleted, deleted_at)
 // 은 현재 DB 스키마와 일치해야 합니다. (스크린샷과 일치하면 그대로 사용)
 @Query(
   value = "SELECT e.* FROM email e " +
           "JOIN mail_user_visibility v ON v.mail_id = e.email_id " +
           "WHERE v.user_id = :userId AND v.deleted = 1 " +
           "ORDER BY v.deleted_at DESC",
   countQuery = "SELECT count(*) FROM email e " +
                "JOIN mail_user_visibility v ON v.mail_id = e.email_id " +
                "WHERE v.user_id = :userId AND v.deleted = 1",
   nativeQuery = true
 )
 Page<Email> findTrashEmailsByUserId(@Param("userId") Integer userId, Pageable pageable);
 
 // Spring Data method 이름 기반 쿼리로 간단히 추가합니다.
    Page<Email> findBySenderIdAndEmailStatusAndReservedAtAfter(
         Integer senderId,
         EmailStatusEnum emailStatus,
         LocalDateTime now,
         Pageable pageable);

    // 발신한 중요 메일 조회
    @Query("SELECT e FROM Email e " +
           "WHERE e.senderId = :senderId " +
           "AND e.favoriteStatus = true " +
           "AND e.emailStatus NOT IN ('TRASH', 'DELETED') " +
           "AND (" +
           "    :keyword IS NULL OR :keyword = '' OR (" +
           "        (:searchType = 'TITLE' AND LOWER(e.emailTitle) LIKE LOWER(CONCAT('%', :keyword, '%'))) OR " +
           "        (:searchType = 'CONTENT' AND LOWER(e.emailContent) LIKE LOWER(CONCAT('%', :keyword, '%'))) OR " +
           "        (:searchType = 'TITLE_CONTENT' AND (" +
           "            LOWER(e.emailTitle) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "            LOWER(e.emailContent) LIKE LOWER(CONCAT('%', :keyword, '%'))" +
           "        ))" +
           "    )" +
           ") " +
           "ORDER BY e.emailSentTime DESC")
    Page<Email> findFavoriteSentMails(
        @Param("senderId") Integer senderId,
        Pageable pageable,
        @Param("searchType") String searchType,
        @Param("keyword") String keyword
    );
}


