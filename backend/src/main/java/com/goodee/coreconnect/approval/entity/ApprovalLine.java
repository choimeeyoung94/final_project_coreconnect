package com.goodee.coreconnect.approval.entity;

import java.time.LocalDateTime;

import com.goodee.coreconnect.approval.enums.ApprovalLineStatus;
import com.goodee.coreconnect.user.entity.User;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;

@Entity
@Getter
@Table(name = "approval_line")
public class ApprovalLine {
  
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  @Column(name = "line_id")
  private Long id;
  
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "doc_id", nullable = false)
  private Document document;
  
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "user_id", nullable = false)
  private User user;
  
  @Column(name = "line_order")
  private int approvalLineOrder;
  
  @Column(name = "line_type")
  private String approvalLineType;
  
  @Enumerated(EnumType.STRING)
  @Column(name = "line_status", nullable = false, length = 20)
  private ApprovalLineStatus status = ApprovalLineStatus.WAITING;  // 대기 (스키마 기본값) - WAITING, 승인 - APPROVED, 반려 - REJECTED
  
  @Column(name = "line_comment", length = 255)
  private String approvalLineComment;
  
  @Column(name = "line_processed_at")
  private LocalDateTime approvalLineProcessedAt;
  
  protected ApprovalLine() {};
  
  public static ApprovalLine createApprovalLine(Document document, User user, int approvalLineOrder) {
    ApprovalLine a = new ApprovalLine();
    a.document = document;
    a.user = user;
    a.approvalLineOrder = approvalLineOrder;
    return a;
  }

}
