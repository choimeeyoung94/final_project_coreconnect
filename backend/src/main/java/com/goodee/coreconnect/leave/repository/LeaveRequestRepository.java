package com.goodee.coreconnect.leave.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.goodee.coreconnect.leave.entity.LeaveRequest;
import com.goodee.coreconnect.leave.enums.LeaveStatus;
import com.goodee.coreconnect.leave.enums.LeaveType;
import com.goodee.coreconnect.user.entity.User;

public interface LeaveRequestRepository extends JpaRepository<LeaveRequest, Integer> {
  
  // 로그인한 사용자의 휴가 신청 내역(최근 시작일 기준 정렬)
  List<LeaveRequest> findByUser_EmailOrderByCreatedAtDesc(String email);
  
  // 문서 ID 기준 조회
  Optional<LeaveRequest> findByDocumentId(Integer documentId);
  
  // 해당 연도에 해당하는 연차 조회(JPQL 사용)
  @Query("SELECT l from LeaveRequest l " + 
         "WHERE l.user = :user " + 
         "AND l.status = :status " + 
         "AND l.type = :type " + 
         "AND year(l.startDate) = :year")
  List<LeaveRequest> findByUserAndStatusAndTypeAndYear(
      @Param("user") User user,
      @Param("status") LeaveStatus status,
      @Param("type") LeaveType type,
      @Param("year") Integer year
  );
  
  /**
   * 주 단위 휴가자 수 조회
   * 특정 기간 내에 승인된 휴가가 있는 날짜별 휴가자 수를 반환
   * 각 날짜에 휴가 기간이 겹치는 모든 휴가를 카운트
   */
  @Query("""
      SELECT l.startDate, l.endDate, l.user.id
      FROM LeaveRequest l
      WHERE l.status = 'APPROVED'
        AND l.startDate <= :endDate
        AND l.endDate >= :startDate
      ORDER BY l.startDate
      """)
  List<Object[]> findLeavesByDateRange(
      @Param("startDate") LocalDate startDate,
      @Param("endDate") LocalDate endDate
  );
  
  /**
   * 전사 휴가 상세 목록 조회 (필터, 페이지네이션)
   */
  @Query("""
      SELECT l FROM LeaveRequest l
      JOIN FETCH l.user u
      LEFT JOIN FETCH u.department d
      WHERE l.status = 'APPROVED'
        AND l.startDate <= :endDate
        AND l.endDate >= :startDate
        AND (:leaveTypeFilter IS NULL OR 
             (:leaveTypeFilter = 'ANNUAL' AND l.type = :annualType) OR
             (:leaveTypeFilter = 'ETC' AND l.type != :annualType))
      ORDER BY l.startDate DESC, u.name ASC
      """)
  Page<LeaveRequest> findCompanyLeaves(
      @Param("startDate") LocalDate startDate,
      @Param("endDate") LocalDate endDate,
      @Param("leaveTypeFilter") String leaveTypeFilter,
      @Param("annualType") LeaveType annualType,
      Pageable pageable
  );
  
  /**
   * 특정 사용자의 특정 기간 내 승인된 휴가 조회
   */
  @Query("SELECT l FROM LeaveRequest l " +
         "WHERE l.user = :user " +
         "AND l.status = :status " +
         "AND l.startDate <= :endDate " +
         "AND l.endDate >= :startDate")
  List<LeaveRequest> findByUserAndStatusAndDateRange(
      @Param("user") User user,
      @Param("status") LeaveStatus status,
      @Param("startDate") LocalDate startDate,
      @Param("endDate") LocalDate endDate
  );
}
