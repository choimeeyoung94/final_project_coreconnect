package com.goodee.coreconnect.email.repository;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.goodee.coreconnect.email.entity.EmailRecipient;

import org.springframework.data.repository.query.Param;

public interface EmailRecipientRepository extends JpaRepository<EmailRecipient, Integer> {

    // 기본: 특정 수신자(userEmail)로 TO/CC/BCC 메일들 전체 페이징 조회 (상태 필터링 없음)
    Page<EmailRecipient> findByEmailRecipientAddressAndEmailRecipientTypeIn(
        String emailRecipientAddress, List<String> emailRecipientType, Pageable pageable
    );

    // 메일 엔티티로 해당 메일의 모든 수신자 조회
    List<EmailRecipient> findByEmail(com.goodee.coreconnect.email.entity.Email email);

    // 안읽은 메일 개수 (수신자 이메일, 읽음여부, 삭제되지 않은 것만)
    // emailReadYn이 false이거나 null인 경우를 안읽은 메일로 간주
    @Query("SELECT COUNT(r) FROM EmailRecipient r " +
           "WHERE r.emailRecipientAddress = :emailRecipientAddress " +
           "AND (r.emailReadYn = false OR r.emailReadYn IS NULL) " +
           "AND r.email.emailStatus NOT IN ('TRASH', 'DELETED') " +
           "AND (r.deleted IS NULL OR r.deleted = false)")
    int countUnreadInboxMails(
        @Param("emailRecipientAddress") String emailRecipientAddress
    );

    // 전체 메일 수신 데이터: 메일 생성시각 내림차순
    Page<EmailRecipient> findByEmailRecipientAddressAndEmailRecipientTypeInOrderByEmail_EmailSentTimeDesc(
        String emailRecipientAddress,
        List<String> emailRecipientType,
        Pageable pageable
    );

    // 오늘 받은 메일: 메일 생성시각 내림차순
    Page<EmailRecipient> findByEmailRecipientAddressAndEmailRecipientTypeInAndEmail_EmailSentTimeBetweenOrderByEmail_EmailSentTimeDesc(
        String emailRecipientAddress,
        List<String> emailRecipientType,
        LocalDateTime start,
        LocalDateTime end,
        Pageable pageable
    );

    // 안읽은 메일만 반환: 메일 생성시각 내림차순
    Page<EmailRecipient> findByEmailRecipientAddressAndEmailRecipientTypeInAndEmailReadYnOrderByEmail_EmailSentTimeDesc(
        String emailRecipientAddress,
        List<String> emailRecipientType,
        Boolean emailReadYn,
        Pageable pageable
    );

    // 수신자 이메일 기준으로 해당 이메일의 모든 메일 ID 조회
    @Query("SELECT r.email.emailId FROM EmailRecipient r WHERE r.emailRecipientAddress = :address")
    List<Integer> findEmailIdsByRecipientAddress(@Param("address") String address);

    // 해당 메일ID+수신자 이메일이 존재하는지 체크
    @Query("SELECT CASE WHEN (COUNT(r) > 0) THEN true ELSE false END FROM EmailRecipient r WHERE r.email.emailId = :emailId AND r.emailRecipientAddress = :address")
    boolean existsByEmailIdAndEmailRecipientAddress(@Param("emailId") Integer emailId, @Param("address") String address);

    // 받은메일함(전체)에서 'TRASH', 'DELETED', 'DRAFT', 'RESERVED' 상태 제외 및 삭제된 메일 제외
    @Query("SELECT r FROM EmailRecipient r " +
           "WHERE r.emailRecipientAddress = :emailRecipientAddress " +
           "AND r.emailRecipientType IN :emailRecipientType " +
           "AND r.email.emailStatus NOT IN ('TRASH', 'DELETED', 'DRAFT', 'RESERVED') " +
           "AND (r.deleted IS NULL OR r.deleted = false) " +
           "AND (" +
           "    :keyword IS NULL OR :keyword = '' OR (" +
           "        (:searchType = 'TITLE' AND LOWER(r.email.emailTitle) LIKE LOWER(CONCAT('%', :keyword, '%'))) OR " +
           "        (:searchType = 'CONTENT' AND LOWER(r.email.emailContent) LIKE LOWER(CONCAT('%', :keyword, '%'))) OR " +
           "        (:searchType = 'TITLE_CONTENT' AND (" +
           "            LOWER(r.email.emailTitle) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "            LOWER(r.email.emailContent) LIKE LOWER(CONCAT('%', :keyword, '%'))" +
           "        ))" +
           "    )" +
           ") " +
           "ORDER BY r.email.emailSentTime DESC, r.email.reservedAt DESC")
    Page<EmailRecipient> findInboxExcludingTrash(
        @Param("emailRecipientAddress") String emailRecipientAddress,
        @Param("emailRecipientType") List<String> emailRecipientType,
        Pageable pageable,
        @Param("searchType") String searchType,
        @Param("keyword") String keyword
    );

    // 오늘의 메일(휴지통/삭제 제외)
    @Query("SELECT r FROM EmailRecipient r " +
           "WHERE r.emailRecipientAddress = :emailRecipientAddress " +
           "AND r.emailRecipientType IN :emailRecipientType " +
           "AND r.email.emailSentTime IS NOT NULL " +
           "AND r.email.emailSentTime BETWEEN :start AND :end " +
           "AND r.email.emailStatus NOT IN ('TRASH', 'DELETED') " +
           "AND (r.deleted IS NULL OR r.deleted = false) " +
           "AND (" +
           "    :keyword IS NULL OR :keyword = '' OR (" +
           "        (:searchType = 'TITLE' AND LOWER(r.email.emailTitle) LIKE LOWER(CONCAT('%', :keyword, '%'))) OR " +
           "        (:searchType = 'CONTENT' AND LOWER(r.email.emailContent) LIKE LOWER(CONCAT('%', :keyword, '%'))) OR " +
           "        (:searchType = 'TITLE_CONTENT' AND (" +
           "            LOWER(r.email.emailTitle) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "            LOWER(r.email.emailContent) LIKE LOWER(CONCAT('%', :keyword, '%'))" +
           "        ))" +
           "    )" +
           ") " +
           "ORDER BY r.email.emailSentTime DESC")
    Page<EmailRecipient> findTodayInboxExcludingTrash(
        @Param("emailRecipientAddress") String emailRecipientAddress,
        @Param("emailRecipientType") List<String> emailRecipientType,
        @Param("start") LocalDateTime start,
        @Param("end") LocalDateTime end,
        Pageable pageable,
        @Param("searchType") String searchType,
        @Param("keyword") String keyword
    );

    // 안읽은만(휴지통/삭제 제외) - emailReadYn이 false이거나 null인 경우
    @Query("SELECT r FROM EmailRecipient r " +
           "WHERE r.emailRecipientAddress = :emailRecipientAddress " +
           "AND r.emailRecipientType IN :emailRecipientType " +
           "AND (r.emailReadYn = false OR r.emailReadYn IS NULL) " +
           "AND r.email.emailStatus NOT IN ('TRASH', 'DELETED', 'DRAFT', 'RESERVED') " +
           "AND (r.deleted IS NULL OR r.deleted = false) " +
           "AND (" +
           "    :keyword IS NULL OR :keyword = '' OR (" +
           "        (:searchType = 'TITLE' AND LOWER(r.email.emailTitle) LIKE LOWER(CONCAT('%', :keyword, '%'))) OR " +
           "        (:searchType = 'CONTENT' AND LOWER(r.email.emailContent) LIKE LOWER(CONCAT('%', :keyword, '%'))) OR " +
           "        (:searchType = 'TITLE_CONTENT' AND (" +
           "            LOWER(r.email.emailTitle) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "            LOWER(r.email.emailContent) LIKE LOWER(CONCAT('%', :keyword, '%'))" +
           "        ))" +
           "    )" +
           ") " +
           "ORDER BY r.email.emailSentTime DESC, r.email.reservedAt DESC")
    Page<EmailRecipient> findUnreadInboxExcludingTrash(
        @Param("emailRecipientAddress") String emailRecipientAddress,
        @Param("emailRecipientType") List<String> emailRecipientType,
        Pageable pageable,
        @Param("searchType") String searchType,
        @Param("keyword") String keyword
    );

    // 중요 메일 조회 (수신한 메일 중 중요 표시된 것만), SENT 상태만 조회
    @Query("SELECT r FROM EmailRecipient r " +
           "WHERE r.emailRecipientAddress = :emailRecipientAddress " +
           "AND r.emailRecipientType IN :emailRecipientType " +
           "AND r.email.favoriteStatus = true " +
           "AND r.email.emailStatus = 'SENT' " +
           "AND r.email.emailStatus NOT IN ('TRASH', 'DELETED') " +
           "AND (r.deleted IS NULL OR r.deleted = false) " +
           "AND r.email.emailSentTime IS NOT NULL " +
           "AND (" +
           "    :keyword IS NULL OR :keyword = '' OR (" +
           "        (:searchType = 'TITLE' AND LOWER(r.email.emailTitle) LIKE LOWER(CONCAT('%', :keyword, '%'))) OR " +
           "        (:searchType = 'CONTENT' AND LOWER(r.email.emailContent) LIKE LOWER(CONCAT('%', :keyword, '%'))) OR " +
           "        (:searchType = 'TITLE_CONTENT' AND (" +
           "            LOWER(r.email.emailTitle) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "            LOWER(r.email.emailContent) LIKE LOWER(CONCAT('%', :keyword, '%'))" +
           "        ))" +
           "    )" +
           ") " +
           "ORDER BY r.email.emailSentTime DESC")
    Page<EmailRecipient> findFavoriteInboxExcludingTrash(
        @Param("emailRecipientAddress") String emailRecipientAddress,
        @Param("emailRecipientType") List<String> emailRecipientType,
        Pageable pageable,
        @Param("searchType") String searchType,
        @Param("keyword") String keyword
    );
}