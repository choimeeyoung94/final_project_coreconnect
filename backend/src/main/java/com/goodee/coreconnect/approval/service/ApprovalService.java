package com.goodee.coreconnect.approval.service;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.web.multipart.MultipartFile;

import com.goodee.coreconnect.approval.dto.request.ApprovalApproveRequestDTO;
import com.goodee.coreconnect.approval.dto.request.ApprovalRejectRequestDTO;
import com.goodee.coreconnect.approval.dto.request.DocumentCreateRequestDTO;
import com.goodee.coreconnect.approval.dto.request.DocumentDraftRequestDTO;
import com.goodee.coreconnect.approval.dto.request.DocumentUpdateRequestDTO;
import com.goodee.coreconnect.approval.dto.response.DocumentDetailResponseDTO;
import com.goodee.coreconnect.approval.dto.response.DocumentSimpleResponseDTO;
import com.goodee.coreconnect.approval.dto.response.TemplateDetailResponseDTO;
import com.goodee.coreconnect.approval.dto.response.TemplateSimpleResponseDTO;

public interface ApprovalService {

  /**
   * 새 결재 문서를 상신합니다.
   * @param requestDTO 문서 생성 요청
   * @param email 상신하는 사용자 email
   * @return 생성된 문서 ID
   */
  Integer createDocument(DocumentCreateRequestDTO requestDTO, List<MultipartFile> files, String email);

  /**
   * 결재 문서를 임시저장합니다. (DRAFT 상태)
   * @param requestDTO 문서 임시저장 요청
   * @param files 첨부 파일
   * @param email 작성자 email
   * @return 생성된 문서 ID
   */
  Integer createDraft(DocumentDraftRequestDTO requestDTO, List<MultipartFile> files, String email);

  /**
   * 임시저장 문서를 수정합니다.
   * @param documentId
   * @param requestDTO
   * @param files
   * @param email
   * @return
   */
  Integer updateDraft(Integer documentId, DocumentUpdateRequestDTO requestDTO, List<MultipartFile> files, String email);
  
  /**
   * 임시저장 문서를 수정 후 상신합니다.
   * @param documentId
   * @param requestDTO
   * @param files
   * @param email
   * @return
   */
  Integer updateAndSubmitDocument(Integer documentId, DocumentUpdateRequestDTO requestDTO, List<MultipartFile> files, String email);
  
  /**
   * 임시저장함(내가 작성한 DRAFT 문서) 목록을 조회합니다.
   * @param email 현재 사용자 email
   * @return DRAFT 상태의 문서 목록
   */
  List<DocumentSimpleResponseDTO> getMyDraftBox(String email);

  /**
   * 내 상신함(내가 작성한 *모든* 문서) 목록을 조회합니다.
   * @param email 현재 사용자 email
   * @return 문서 목록
   */
  Page<DocumentSimpleResponseDTO> getMyDocuments(String email, Pageable pageable);

  /**
   * 내 결재함(내가 결재할 문서) 목록을 조회합니다.
   * @param email 현재 사용자 email
   * @return 문서 목록
   */
  List<DocumentSimpleResponseDTO> getMyTasks(String email);
  
  /**
   * 내 참조함(내가 참조자로 지정된 문서) 목록을 조회합니다.
   * @param email
   * @return
   */
  List<DocumentSimpleResponseDTO> getMyReferenceDocuments(String email);

  /**
   * 문서 상세 내용을 조회합니다.
   * @param documentId 조회할 문서 ID
   * @param email 현재 사용자 email (열람 권한 확인용)
   * @return 문서 상세 DTO
   */
  DocumentDetailResponseDTO getDocumentDetail(Integer documentId, String email);

  /**
   * 문서 열람 권한 확인 (첨부 다운로드처럼 문서 내용 없이 권한만 필요할 때)
   * 기안자 또는 결재선에 포함된 사용자가 아니면 AccessDeniedException(403)
   */
  void assertCanViewDocument(Integer documentId, String email);

  /**
   * 문서를 승인합니다.
   * @param documentId 승인할 문서 ID
   * @param requestDTO 결재 의견 DTO
   * @param email 승인하는 사용자 email
   */
  void approveDocument(Integer documentId, ApprovalApproveRequestDTO requestDTO, String email);

  /**
   * 문서를 반려합니다.
   * @param documentId 반려할 문서 ID
   * @param requestDTO 결재 의견 DTO
   * @param email 반려하는 사용자 email
   */
  void rejectDocument(Integer documentId, ApprovalRejectRequestDTO requestDTO, String email);

  /**
   * 활성화된 모든 양식(템플릿) 목록을 조회합니다.
   * @return 템플릿 목록
   */
  List<TemplateSimpleResponseDTO> getActiveTemplates();

  /**
   * 특정 양식(템플릿)의 상세 내용을 조회합니다.
   * @param templateId 템플릿 ID
   * @return 템플릿 상세 DTO
   */
  TemplateDetailResponseDTO getTemplateDetail(Integer templateId);
  
  /**
   * 전자결재 홈에 표시할 기안 진행 문서
   * @param email 현재 사용자 email
   * @return DRAFT, IN_PROGRESS 상태의 문서 목록
   */
  List<DocumentSimpleResponseDTO> getMyPendingDocuments(String email);
  
  /**
   * 전자결재 홈에 표시할 완료 문서
   * @param email 현재 사용자 email
   * @return COMPLETED, REJECTED 상태의 문서 목록
   */
  List<DocumentSimpleResponseDTO> getMyCompletedDocuments(String email);

}
