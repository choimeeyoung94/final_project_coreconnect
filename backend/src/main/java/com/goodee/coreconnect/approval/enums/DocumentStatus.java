package com.goodee.coreconnect.approval.enums;

public enum DocumentStatus {
  DRAFT,       // 임시저장 (스키마 기본값)
  IN_PROGRESS, // 진행중
  COMPLETED,   // 완료 (승인)
  REJECTED     // 반려
}
