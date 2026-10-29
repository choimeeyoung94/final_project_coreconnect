package com.goodee.coreconnect.approval.controller;

import java.io.InputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

import org.springframework.core.io.InputStreamResource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
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
import com.goodee.coreconnect.approval.entity.File;
import com.goodee.coreconnect.approval.repository.FileRepository;
import com.goodee.coreconnect.approval.service.ApprovalService;
import com.goodee.coreconnect.approval.service.FileStorageService;
import com.goodee.coreconnect.security.userdetails.CustomUserDetails;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@Tag(name = "Approval API", description = "전자결재 관련 기능 API")
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/approvals") // API 기본 경로
@SecurityRequirement(name = "bearerAuth")
public class ApprovalController {

  private final ApprovalService approvalService;
  private final FileRepository fileRepository;
  private final FileStorageService fileStorageService;

  /**
   * 1. 새 결재 문서 상신 (파일 첨부 포함)
   * [POST] /api/v1/approvals
   * - Content-Type: multipart/form-data
   */
  @Operation(summary = "문서 생성", description = "새 결재 문서 상신")
  @PostMapping
  public ResponseEntity<Integer> createDocument(
      @Valid @RequestPart("dto") DocumentCreateRequestDTO requestDTO, // (1) JSON 데이터
      @RequestPart(value = "files", required = false) List<MultipartFile> files, // (2) 파일 데이터 (없을 수도 있음)
      @AuthenticationPrincipal CustomUserDetails user // (3) 인증된 사용자
      ) {
    
    String email = user.getEmail();

    // 서비스 호출 시 email을 그대로 넘겨줍니다.
    Integer documentId = approvalService.createDocument(requestDTO, files, email);

    // 생성 성공 시 201 Created 상태와 문서 ID 반환
    return ResponseEntity.status(HttpStatus.CREATED).body(documentId);
  }

  /**
   * 1-1. 결재 문서 임시저장
   * [POST] /api/v1/approvals/drafts
   * - Content-Type: multipart/form-data
   */
  @Operation(summary = "문서 임시저장", description = "결재 문서를 임시저장합니다. (DRAFT 상태로 저장)")
  @PostMapping("/drafts")
  public ResponseEntity<Integer> createDraft(
      @Valid @RequestPart("dto") DocumentDraftRequestDTO requestDTO, // (1) 임시저장용 DTO
      @RequestPart(value = "files", required = false) List<MultipartFile> files, // (2) 파일 데이터 (없을 수도 있음)
      @AuthenticationPrincipal CustomUserDetails user // (3) 인증된 사용자
      ) {
    
    String email = user.getEmail();
    Integer documentId = approvalService.createDraft(requestDTO, files, email);

    // 생성 성공 시 201 Created 상태와 문서 ID 반환
    return ResponseEntity.status(HttpStatus.CREATED).body(documentId);
  }
  
  /**
   * 1-2. 임시저장 문서 수정
   * [PUT] /api/v1/approvals/drafts/{documentId}
   * @param documentId
   * @param requestDTO
   * @param files
   * @param user
   * @return
   */
  @PutMapping("/drafts/{documentId}")
  public ResponseEntity<Integer> updateDraft(
      @PathVariable("documentId") Integer documentId,
      @RequestPart("dto") DocumentUpdateRequestDTO requestDTO,
      @RequestPart(value = "files", required = false) List<MultipartFile> files,
      @AuthenticationPrincipal CustomUserDetails user
      ) {
    String email = user.getEmail();
    Integer updatedDocumentId = approvalService.updateDraft(documentId, requestDTO, files, email);
    return ResponseEntity.ok(updatedDocumentId);
    
  }
  
  @PutMapping("/{documentId}")
  public ResponseEntity<Integer> updateAndSubmitDocument(
      @PathVariable("documentId") Integer documentId,
      @Valid @RequestPart("dto") DocumentUpdateRequestDTO requestDTO,
      @RequestPart(value = "files", required = false) List<MultipartFile> files,
      @AuthenticationPrincipal CustomUserDetails user
      ) {
    String email = user.getEmail();
    Integer submittedDocumentId = approvalService.updateAndSubmitDocument(documentId, requestDTO, files, email);
    return ResponseEntity.ok(submittedDocumentId);
  }

  /**
   * 2. 내 상신함 (내가 작성한 문서) 목록 조회
   * [GET] /api/v1/approvals/my-documents
   */
  @Operation(summary = "목록 조회", description = "내가 작성한 문서 목록 조회")
  @GetMapping("/my-documents")
  public ResponseEntity<Page<DocumentSimpleResponseDTO>> getMyDrafts(
      @AuthenticationPrincipal CustomUserDetails user,
      @PageableDefault(page = 0, size = 10) Pageable pageable
      ) {
    String email = user.getEmail();
    Page<DocumentSimpleResponseDTO> myDrafts = approvalService.getMyDocuments(email, pageable);
    return ResponseEntity.ok(myDrafts);
  }

  /**
   * 2-1. 임시저장함 (DRAFT 상태) 목록 조회
   * [GET] /api/v1/approvals/drafts
   */
  @Operation(summary = "임시저장함 조회", description = "내가 임시저장한(DRAFT 상태) 문서 목록 조회")
  @GetMapping("/drafts")
  public ResponseEntity<List<DocumentSimpleResponseDTO>> getMyDraftBox(
      @AuthenticationPrincipal CustomUserDetails user,
      @PageableDefault(page = 0, size = 10) Pageable pageable
      ) {
    String email = user.getEmail();
    List<DocumentSimpleResponseDTO> myDrafts = approvalService.getMyDraftBox(email);
    return ResponseEntity.ok(myDrafts);
  }

  /**
   * 3. 내 결재함 (내가 결재할 문서) 목록 조회
   * [GET] /api/v1/approvals/my-tasks
   */
  @Operation(summary = "목록 조회", description = "내가 결재할 문서 목록 조회")
  @GetMapping("/my-tasks")
  public ResponseEntity<List<DocumentSimpleResponseDTO>> getMyTasks(
      @AuthenticationPrincipal CustomUserDetails user
      ) {
    String email = user.getEmail();
    List<DocumentSimpleResponseDTO> myTasks = approvalService.getMyTasks(email);
    return ResponseEntity.ok(myTasks);
  }
  
  /**
   * 3-1. 내 참조함 (내가 참조자로 지정된 문서) 목록 조회
   * @param user
   * @return
   */
  @Operation(summary = "내 참조함 조회", description = "내가 참조자로 지정된 문서 목록을 조회합니다.")
  @GetMapping("/my-reference-docs")
  public ResponseEntity<List<DocumentSimpleResponseDTO>> getMyReferenceDocuments(
      @AuthenticationPrincipal CustomUserDetails user
      ) {
    String email = user.getEmail();
    List<DocumentSimpleResponseDTO> refDocs = approvalService.getMyReferenceDocuments(email);
    return ResponseEntity.ok(refDocs);
  }

  /**
   * 전자 결재 홈에 표시할 기안 진행 문서
   * @param email
   * @return
   */
  @Operation(summary = "홈 - 내 상신함 (진행중)", description = "홈 대시보드용. 내가 작성한 문서 중 진행중(DRAFT, IN_PROGRESS)인 문서 목록 조회")
  @GetMapping("/my-documents/pending")
  public ResponseEntity<List<DocumentSimpleResponseDTO>> getMyPendingDocuments(
      @AuthenticationPrincipal CustomUserDetails user
      ) {
    String email = user.getEmail();

    List<DocumentSimpleResponseDTO> pendingDocs = approvalService.getMyPendingDocuments(email);
    return ResponseEntity.ok(pendingDocs);
  }

  /**
   * 전자 결재 홈에 표시할 완료 문서
   * @param email
   * @return
   */
  @Operation(summary = "홈 - 내 상신함 (완료/반려)", description = "홈 대시보드용. 내가 작성한 문서 중 완료(COMPLETED, REJECTED)된 문서 목록 조회")
  @GetMapping("/my-documents/completed")
  public ResponseEntity<List<DocumentSimpleResponseDTO>> getMyCompletedDocuments(
      @AuthenticationPrincipal CustomUserDetails user
      ) {
    String email = user.getEmail();

    List<DocumentSimpleResponseDTO> completedDocs = approvalService.getMyCompletedDocuments(email);
    return ResponseEntity.ok(completedDocs);
  }

  /**
   * 4. 문서 상세 조회
   * [GET] /api/v1/approvals/{documentId}
   */
  @Operation(summary = "문서 상세 조회", description = "문서 상세 조회")
  @GetMapping("/{documentId}")
  public ResponseEntity<DocumentDetailResponseDTO> getDocumentDetail(
      @PathVariable("documentId") Integer documentId,
      @AuthenticationPrincipal CustomUserDetails user
      ) {
    String email = user.getEmail();
    DocumentDetailResponseDTO documentDetail = approvalService.getDocumentDetail(documentId, email);
    return ResponseEntity.ok(documentDetail);
  }

  /**
   * 5. 문서 승인
   * [POST] /api/v1/approvals/{documentId}/approve
   */
  @Operation(summary = "문서 승인", description = "문서를 승인합니다.")
  @PostMapping("/{documentId}/approve")
  public ResponseEntity<String> approveDocument(
      @PathVariable("documentId") Integer documentId,
      @RequestBody ApprovalApproveRequestDTO requestDTO, // 결재 의견
      @AuthenticationPrincipal CustomUserDetails user
      ) {
    String email = user.getEmail();
    approvalService.approveDocument(documentId, requestDTO, email);
    return ResponseEntity.ok("결재가 승인되었습니다.");
  }

  /**
   * 6. 문서 반려
   * [POST] /api/v1/approvals/{documentId}/reject
   */
  @Operation(summary = "문서 반려", description = "문서를 반려합니다.")
  @PostMapping("/{documentId}/reject")
  public ResponseEntity<String> rejectDocument(
      @PathVariable("documentId") Integer documentId,
      @Valid @RequestBody ApprovalRejectRequestDTO requestDTO, // 반려 사유
      @AuthenticationPrincipal CustomUserDetails user
      ) {
    String email = user.getEmail();
    approvalService.rejectDocument(documentId, requestDTO, email);
    return ResponseEntity.ok("결재가 반려되었습니다.");
  }

  /**
   * 7. 활성화된 양식(템플릿) 목록 조회
   * [GET] /api/v1/approvals/templates
   */
  @Operation(summary = "양식 목록 조회", description = "활성화된 양식 목록 조회")
  @GetMapping("/templates")
  public ResponseEntity<List<TemplateSimpleResponseDTO>> getActiveTemplates() {
    List<TemplateSimpleResponseDTO> templates = approvalService.getActiveTemplates();
    return ResponseEntity.ok(templates);
  }

  /**
   * 8. 특정 양식(템플릿) 상세 조회
   * [GET] /api/v1/approvals/templates/{templateId}
   */
  @Operation(summary = "양식 상세 조회", description = "특정 양식 상세 조회")
  @GetMapping("/templates/{templateId}")
  public ResponseEntity<TemplateDetailResponseDTO> getTemplateDetail(
      @PathVariable("templateId") Integer templateId
      ) {
    TemplateDetailResponseDTO templateDetail = approvalService.getTemplateDetail(templateId);
    return ResponseEntity.ok(templateDetail);
  }
  
  @GetMapping("/file/download/{fileId}")
  public ResponseEntity<InputStreamResource> downloadAttachment(@PathVariable("fileId") Integer fileId,
      @AuthenticationPrincipal CustomUserDetails user, HttpServletResponse response) {
      // 1. DB에서 첨부파일 엔티티 조회
      File file = fileRepository.findById(fileId)
          .orElseThrow(() -> new RuntimeException("첨부파일 정보를 찾을 수 없습니다."));

      // 1-1. 문서를 열람할 수 있는 사람(기안자·결재선)만 다운로드 가능 (아니면 403)
      approvalService.assertCanViewDocument(file.getDocument().getId(), user.getEmail());

      // 2. 실파일(InputStream 등) 읽기 (S3스토리지/로컬 구현에 따라 분기)
      InputStream inputStream = fileStorageService.loadFileAsInputStream(file);

      // 3. Content-Disposition 헤더(filename 인코딩 주의)
      String encodedFilename = URLEncoder.encode(file.getFileName(), StandardCharsets.UTF_8)
                                         .replaceAll("\\+", "%20");
      HttpHeaders headers = new HttpHeaders();
      headers.add(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encodedFilename);

      // 4. Content-Type (기본 바이너리, 혹은 확장자별 지정)
      MediaType contentType = MediaType.APPLICATION_OCTET_STREAM;

      return ResponseEntity.ok()
              .headers(headers)
              .contentLength(file.getFileSize())
              .contentType(contentType)
              .body(new InputStreamResource(inputStream));
  }
}