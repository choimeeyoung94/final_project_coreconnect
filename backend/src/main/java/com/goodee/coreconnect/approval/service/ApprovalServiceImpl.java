package com.goodee.coreconnect.approval.service;

import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring6.SpringTemplateEngine;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.goodee.coreconnect.approval.dto.request.ApprovalApproveRequestDTO;
import com.goodee.coreconnect.approval.dto.request.ApprovalLineRequestDTO;
import com.goodee.coreconnect.approval.dto.request.ApprovalRejectRequestDTO;
import com.goodee.coreconnect.approval.dto.request.DocumentCreateRequestDTO;
import com.goodee.coreconnect.approval.dto.request.DocumentDraftRequestDTO;
import com.goodee.coreconnect.approval.dto.request.DocumentUpdateRequestDTO;
import com.goodee.coreconnect.approval.dto.response.DocumentDetailResponseDTO;
import com.goodee.coreconnect.approval.dto.response.DocumentSimpleResponseDTO;
import com.goodee.coreconnect.approval.dto.response.TemplateDetailResponseDTO;
import com.goodee.coreconnect.approval.dto.response.TemplateSimpleResponseDTO;
import com.goodee.coreconnect.approval.entity.ApprovalLine;
import com.goodee.coreconnect.approval.entity.Document;
import com.goodee.coreconnect.approval.entity.File;
import com.goodee.coreconnect.approval.entity.Template;
import com.goodee.coreconnect.approval.enums.ApprovalLineStatus;
import com.goodee.coreconnect.approval.enums.ApprovalLineType;
import com.goodee.coreconnect.approval.enums.DocumentStatus;
import com.goodee.coreconnect.common.exception.FileUploadException;
import com.goodee.coreconnect.approval.repository.ApprovalLineRepository;
import com.goodee.coreconnect.approval.repository.DocumentRepository;
import com.goodee.coreconnect.approval.repository.TemplateRepository;
import com.goodee.coreconnect.chat.repository.NotificationRepository;
import com.goodee.coreconnect.common.entity.Notification;
import com.goodee.coreconnect.common.notification.dto.NotificationPayload;
import com.goodee.coreconnect.common.notification.enums.NotificationType;
import com.goodee.coreconnect.common.notification.service.WebSocketDeliveryService;
import com.goodee.coreconnect.common.service.S3Service;
import com.goodee.coreconnect.leave.enums.LeaveType;
import com.goodee.coreconnect.leave.service.LeaveService;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.repository.UserRepository;

import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * 결재 서비스 구현체
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ApprovalServiceImpl implements ApprovalService {

  private final DocumentRepository documentRepository;
  private final TemplateRepository templateRepository;
  private final UserRepository userRepository;
  private final ApprovalLineRepository approvalLineRepository;
  private final S3Service s3Service;
  private final WebSocketDeliveryService webSocketDeliveryService;
  private final NotificationRepository notificationRepository;
  private final SpringTemplateEngine templateEngine;
  private final ObjectMapper objectMapper;
  private final LeaveService leaveService;
  
  private static final Integer LEAVE_TEMPLATE_ID= 1;

  /**
   * 새 결재 문서를 상신합니다.
   */
  @Override
  @Transactional
  public Integer createDocument(DocumentCreateRequestDTO requestDTO, List<MultipartFile> files, String email) {
    log.info("[ApprovalServiceImpl] ===== createDocument 메서드 시작 ===== email={}, templateId={}, approvalLinesCount={}", 
            email, requestDTO != null ? requestDTO.getTemplateId() : "null", 
            requestDTO != null && requestDTO.getApprovalLines() != null ? requestDTO.getApprovalLines().size() : 0);

    // 1. 기안자(User) 및 양식(Template) 조회
    User drafter = findUserByEmail(email);
    log.info("[ApprovalServiceImpl] 기안자 조회 완료: drafterId={}, drafterName={}", drafter.getId(), drafter.getName());
    
    Template template = findTemplateById(requestDTO.getTemplateId());
    log.info("[ApprovalServiceImpl] 템플릿 조회 완료: templateId={}, templateName={}", template.getId(), template.getName());
    
    if (isLeaveTemplate(template)) {
      validateLeaveOverlap(drafter, template, requestDTO.getDocumentDataJson(), null);
    }

    // 2. 문서 엔티티 생성
    Document document = requestDTO.toEntity(template, drafter);
    
    // 3. 결재선 엔티티 생성 (N+1 해결)
    List<ApprovalLineRequestDTO> approvalLines = requestDTO.getApprovalLines(); // DTO에서 순서가 보장된 ID List
    // 객체 리스트에서 UserId 리스트를 추출
    List<Integer> approvalIds = approvalLines.stream()
        .map(ApprovalLineRequestDTO::getUserId) 
        .collect(Collectors.toList());

    // 3-1. ID 목록으로 User 목록을 *한 번에* 조회 (쿼리 1번)
    Map<Integer, User> approverMap = userRepository.findAllById(approvalIds).stream()
        .collect(Collectors.toMap(User::getId, Function.identity()));

    AtomicInteger order = new AtomicInteger(1); // 결재 순서 (1부터 시작)

    // 3-2. '순서가 보장된 (ID+Type) DTO List'를 기준으로 루프
    approvalLines.forEach(lines -> {

      // 3-3. Map에서 ID로 User를 조회 (DB 쿼리 X, 메모리 조회)
      User approver = approverMap.get(lines.getUserId());

      // 3-4. (방어 코드) 혹시 Map에 사용자가 없는 경우
      if (approver == null) {
        throw new EntityNotFoundException("결재선에 포함된 사용자를 찾을 수 없습니다. ID: " + lines.getUserId());
      }

      lines.toEntity(document, approver, order.getAndIncrement());
    });

    // 4. 첨부파일 처리 (S3 업로드)
    if (files != null && !files.isEmpty()) {
      try {
        for (MultipartFile file : files) {
          if (file == null || file.isEmpty()) continue;

          String fileUrl = s3Service.uploadApprovalFile(file); // S3 업로드

          File.createFile(
              document,
              file.getOriginalFilename(),
              fileUrl, // S3 URL
              file.getSize()
              );
        }
      } catch (IOException e) {
        throw new FileUploadException("파일 업로드 중 오류가 발생했습니다.", e);
      }
    }

    // 5. 문서 상신 (DRAFT -> IN_PROGRESS)
    document.submit();

    // 6. 문서 저장 (CascadeType.ALL로 인해 ApprovalLines도 함께 저장됨)
    Document savedDocument = documentRepository.save(document);
    
    // 휴가 템플릿이면 휴가 DB에 저장하는 로직
    if(isLeaveTemplate(template)) {
      try {
        // documentDataJson 파싱
        TypeReference<Map<String, Object>> typeRef = new TypeReference<>() {};
        Map<String, Object> data = objectMapper.readValue(requestDTO.getDocumentDataJson(), typeRef);

        String type = (String) data.get("vacationType");
        String reason = (String) data.get("reason");
        String start = (String) data.get("startDate");
        String end = (String) data.get("endDate");

        LocalDate startDate = LocalDate.parse(start);
        LocalDate endDate = LocalDate.parse(end);

        leaveService.createLeaveFromApproval(savedDocument, drafter, startDate, endDate, type, reason);
      } catch (Exception e) {
        throw new IllegalStateException("휴가 데이터 파싱 중 오류 발생", e);
      }
    }


    // --- 알림 전송 로직 (첫번째 결재자에게) ---
    log.info("[ApprovalServiceImpl] ===== 알림 전송 로직 시작 ===== documentId={}, drafterId={}", 
            savedDocument.getId(), drafter.getId());
    
    // 7. 첫번째 결재자 찾기
    ApprovalLine firstLine = savedDocument.getApprovalLines().stream()
        .filter(line -> line.getApprovalLineStatus() == ApprovalLineStatus.WAITING) // WAITING 상태인 사람 중에서
        .min(Comparator.comparing(ApprovalLine::getApprovalLineOrder)) // 가장 순서가 빠른 사람
        .orElse(null); // (모두 참조일 경우 null이 될 수 있으나, submit()에서 방어됨)

    log.info("[ApprovalServiceImpl] 첫 번째 결재자 찾기 결과: firstLine={}, approvalLines.size()={}", 
            firstLine != null ? "존재" : "null", savedDocument.getApprovalLines().size());

    if (firstLine != null) {
      User firstApprover = firstLine.getApprover();
      String message = drafter.getName() + "님으로부터 새로운 결재 요청이 도착했습니다.";
      log.info("[ApprovalServiceImpl] 첫 번째 결재자에게 알림 전송 시작: firstApproverId={}, drafterId={}, documentId={}", 
              firstApprover.getId(), drafter.getId(), savedDocument.getId());

      // 7-1. 페이로드 생성
      NotificationPayload payload = createNotificationPayload(
          firstApprover.getId(), // 받는사람 (첫 결재자)
          drafter.getId(),           // 보낸사람 (기안자)
          drafter.getName(),
          message,
          savedDocument.getId()
          );

      // 7-2. DB에 알림 저장
      log.info("[ApprovalServiceImpl] 첫 번째 결재자 알림 DB 저장 시작: saveNotificationToDB 호출");
      saveNotificationToDB(payload, firstApprover, savedDocument);
      log.info("[ApprovalServiceImpl] 첫 번째 결재자 알림 DB 저장 완료");

      // 7-3. 실시간 알림 전송
      webSocketDeliveryService.sendToUser(firstApprover.getId(), payload);
      log.info("[ApprovalServiceImpl] 첫 번째 결재자 WebSocket 전송 완료: firstApproverId={}", firstApprover.getId());
    } else {
      log.warn("[ApprovalServiceImpl] ⚠️ 첫 번째 결재자를 찾을 수 없습니다. 알림이 전송되지 않습니다. documentId={}", savedDocument.getId());
    }
    
    // --- 상신 시 기안자 본인에게도 알림 전송 (선택사항) ---
    // 기안자 본인에게 "결재 상신 완료" 알림 전송
    log.info("[ApprovalServiceImpl] 기안자 본인에게 알림 전송 시작: drafterId={}, documentId={}", 
            drafter.getId(), savedDocument.getId());
    
    String drafterMessage = "결재 상신이 완료되었습니다.";
    NotificationPayload drafterPayload = createNotificationPayload(
        drafter.getId(),     // 받는사람 (기안자 본인)
        drafter.getId(),     // 보낸사람 (기안자 본인)
        drafter.getName(),
        drafterMessage,
        savedDocument.getId()
    );
    
    log.info("[ApprovalServiceImpl] 기안자 본인 알림 DB 저장 시작: saveNotificationToDB 호출");
    saveNotificationToDB(drafterPayload, drafter, savedDocument);
    log.info("[ApprovalServiceImpl] 기안자 본인 알림 DB 저장 완료");
    
    webSocketDeliveryService.sendToUser(drafter.getId(), drafterPayload);
    log.info("[ApprovalServiceImpl] 기안자 본인 WebSocket 전송 완료: drafterId={}", drafter.getId());
    
    log.info("[ApprovalServiceImpl] ===== 알림 전송 로직 완료 ===== documentId={}", savedDocument.getId());

    return savedDocument.getId();
  }

  /**
   * 결재 문서를 임시저장합니다. (DRAFT 상태)
   */
  @Override
  @Transactional
  public Integer createDraft(DocumentDraftRequestDTO requestDTO, List<MultipartFile> files, String email) {

    // 1. 기안자(User) 및 양식(Template) 조회
    User drafter = findUserByEmail(email);
    Template template = findTemplateById(requestDTO.getTemplateId());

    // 2. 문서 엔티티 생성 (기본 상태: DRAFT)
    Document document = requestDTO.toEntity(template, drafter);
    
    // 3. 결재선 엔티티 생성 (결재선이 DTO에 포함된 경우에만)
    // DTO에서 (ID+Type) 객체 리스트를 가져옴
    List<ApprovalLineRequestDTO> approvalLineDTOs = requestDTO.getApprovalLines(); 

    // 결재선이 null이 아니고 비어있지 않다면 결재선 생성
    if (approvalLineDTOs != null && !approvalLineDTOs.isEmpty()) { 
      // 객체 리스트에서 UserId 리스트를 추출
      List<Integer> approvalIds = approvalLineDTOs.stream()
          .map(ApprovalLineRequestDTO::getUserId)
          .collect(Collectors.toList());

      Map<Integer, User> approverMap = userRepository.findAllById(approvalIds).stream()
          .collect(Collectors.toMap(User::getId, Function.identity()));

      AtomicInteger order = new AtomicInteger(1); 

      // '순서가 보장된 (ID+Type) DTO List'를 기준으로 루프
      approvalLineDTOs.forEach(lineDTO -> {
        User approver = approverMap.get(lineDTO.getUserId());
        if (approver == null) {
          throw new EntityNotFoundException("결재선에 포함된 사용자를 찾을 수 없습니다. ID: " + lineDTO.getUserId());
        }
        lineDTO.toEntity(document, approver, order.getAndIncrement());
      });
    }

    // 4. 첨부파일 처리 (S3 업로드)
    if (files != null && !files.isEmpty()) {
      try {
        for (MultipartFile file : files) {
          if (file == null || file.isEmpty()) continue;
          String fileUrl = s3Service.uploadApprovalFile(file); 
          File.createFile(
              document,
              file.getOriginalFilename(),
              fileUrl,
              file.getSize()
              );
        }
      } catch (IOException e) {
        throw new FileUploadException("파일 업로드 중 오류가 발생했습니다.", e);
      }
    }

    // 5. 문서 저장 (DRAFT 상태로 저장됨)
    Document savedDocument = documentRepository.save(document);

    return savedDocument.getId();
  }
  
  /**
   * 1-2. 임시저장 문서 수정
   */
  @Transactional
  @Override
  public Integer updateDraft(Integer documentId, DocumentUpdateRequestDTO requestDTO, List<MultipartFile> files,
      String email) {
    User drafter = findUserByEmail(email);
    Document document = documentRepository.findDocumentDetailById(documentId)
        .orElseThrow(() -> new EntityNotFoundException("문서를 찾을 수 없습니다."));
    
    validateDocumentUpdateAuthority(document, drafter);
    document.updateDraftDetails(requestDTO.getDocumentTitle(), requestDTO.getDocumentDataJson());
    updateApprovalLines(document, requestDTO.getApprovalLines());
    addFilesToDocument(document, files);
    Document savedDocument = documentRepository.save(document);
    return savedDocument.getId();
  }
  
  /**
   * 1-3. 임시저장 문서 수정 후 상신
   */
  @Override
  @Transactional
  public Integer updateAndSubmitDocument(Integer documentId, DocumentUpdateRequestDTO requestDTO,
      List<MultipartFile> files, String email) {
    User drafter = findUserByEmail(email);
    Document document = documentRepository.findDocumentDetailById(documentId)
        .orElseThrow(() -> new EntityNotFoundException("문서를 찾을 수 없습니다."));
    
    if (isLeaveTemplate(document.getTemplate())) {
      validateLeaveOverlap(drafter, document.getTemplate(), requestDTO.getDocumentDataJson(), documentId);
    }
    
    validateDocumentUpdateAuthority(document, drafter);
    document.updateDraftDetails(requestDTO.getDocumentTitle(), requestDTO.getDocumentDataJson());
    updateApprovalLines(document, requestDTO.getApprovalLines());
    addFilesToDocument(document, files);
    document.submit();
    Document savedDocument = documentRepository.save(document);
    if (isLeaveTemplate(document.getTemplate())) {
      log.warn("휴가 신청서가 수정 후 산싱되었습니다.");
    }
    sendNotificationToFirstApprover(savedDocument, drafter);
    return savedDocument.getId();
  }

  /**
   * 내 상신함(내가 작성한 문서) 목록을 조회합니다.
   */
  @Override
  public Page<DocumentSimpleResponseDTO> getMyDocuments(String email, Pageable pageable) {
    User user = findUserByEmail(email);

    // 1. 리포지토리에서 조회
    Page<Document> documentPage = documentRepository.findByUserAndDocDeletedYnOrderByCreatedAtDesc(user, false, pageable);

    // 2. DTO로 변환
    return documentPage.map(DocumentSimpleResponseDTO::toDTO);
  }

  /**
   * 임시저장함(내가 작성한 DRAFT 문서) 목록을 조회합니다.
   */
  @Override
  public List<DocumentSimpleResponseDTO> getMyDraftBox(String email) {
    User user = findUserByEmail(email);

    // 1. 레파지토리에서 'DRAFT' 상태의 문서만 조회 (새 쿼리 메소드 사용)
    List<Document> documents = documentRepository.findByUserAndDocumentStatusAndDocDeletedYnOrderByCreatedAtDesc(
        user, 
        DocumentStatus.DRAFT, 
        false
        );

    // 2. DTO로 변환
    return documents.stream()
        .map(DocumentSimpleResponseDTO::toDTO)
        .collect(Collectors.toList());
  }

  /**
   * 내 결재함(내가 결재할 문서) 목록을 조회합니다.
   */
  @Override
  public List<DocumentSimpleResponseDTO> getMyTasks(String email) {
    User approver = findUserByEmail(email);

    // 1. "현재 내 차례"인 결재선만 정확히 조회
    List<ApprovalLine> currentTurnLines = approvalLineRepository.findMyCurrentTasks(
        approver,
        ApprovalLineStatus.WAITING,
        DocumentStatus.IN_PROGRESS
        );

    // 2. 조회된 결재선에서 문서를 추출 ("내 차례"만 필터링됨)
    return currentTurnLines.stream()
        .map(ApprovalLine::getDocument) // 문서를 가져옴 (Fetch Join됨)
        .distinct() // 문서 중복 제거
        .map(DocumentSimpleResponseDTO::toDTO)
        .collect(Collectors.toList());
  }
  
  /**
   * 전자결재 홈에 표시할 기안 진행 문서
   */
  @Override
  public List<DocumentSimpleResponseDTO> getMyPendingDocuments(String email) {
    User user = findUserByEmail(email);
    
    // 1. "진행중" 상태 정의 (임시저장, 진행중)
    List<DocumentStatus> pendingStatuses = Arrays.asList(
        DocumentStatus.IN_PROGRESS
    );

    // 2. N+1이 해결된 쿼리로 조회
    List<Document> documents = documentRepository.findByUserAndStatusInWithJoins(
        user,
        pendingStatuses,
        false
    );

    // 3. DTO로 변환 (목록이므로 SimpleDTO 사용)
    return documents.stream()
        .map(DocumentSimpleResponseDTO::toDTO)
        .collect(Collectors.toList());
  }
  
  @Override
  public List<DocumentSimpleResponseDTO> getMyReferenceDocuments(String email) {
    User approver = findUserByEmail(email);
    
    List<Document> referenceDocuments = approvalLineRepository.findDocumentsByApproverAndType(
        approver,
        ApprovalLineType.REFER
        );
    
    return referenceDocuments.stream()
        .distinct()
        .map(DocumentSimpleResponseDTO::toDTO)
        .collect(Collectors.toList());
  }

  /**
   * 전자결재 홈에 표시할 완료 문서
   */
  @Override
  public List<DocumentSimpleResponseDTO> getMyCompletedDocuments(String email) {
    User user = findUserByEmail(email);
    
    // 1. "완료" 상태 정의 (완료, 반려)
    List<DocumentStatus> completedStatuses = Arrays.asList(
        DocumentStatus.COMPLETED, 
        DocumentStatus.REJECTED
    );

    // 2. N+1이 해결된 쿼리로 조회
    List<Document> documents = documentRepository.findByUserAndStatusInWithJoins(
        user,
        completedStatuses,
        false
    );

    // 3. DTO로 변환 (목록이므로 SimpleDTO 사용)
    return documents.stream()
        .map(DocumentSimpleResponseDTO::toDTO)
        .collect(Collectors.toList());
  }

  /**
   * 문서 상세 내용을 조회합니다.
   */
  @Override
  public DocumentDetailResponseDTO getDocumentDetail(Integer documentId, String email) {

    // (N+1이 해결된 findDocumentDetailById 쿼리를 사용)
    Document document = documentRepository.findDocumentDetailById(documentId)
        .orElseThrow(() -> new EntityNotFoundException("문서를 찾을 수 없습니다. ID: " + documentId));

    // Soft Delete 체크
    if (document.getDocDeletedYn() != null && document.getDocDeletedYn()) {
      throw new EntityNotFoundException("삭제된 문서입니다. ID: " + documentId);
    }

    User currentUser = findUserByEmail(email);
    Integer currentUserId = currentUser.getId();

    // 열람 권한 확인 (기안자 또는 결재선에 포함된 사용자인지)
    boolean isDrafter = document.getUser().getId().equals(currentUserId);

    // (Fetch Join이 적용되어 Lazy Loading 아님)
    boolean isApprover = document.getApprovalLines().stream() 
        .anyMatch(line -> line.getApprover().getId().equals(currentUserId));

    if (!isDrafter && !isApprover) {
      throw new IllegalStateException("문서를 열람할 권한이 없습니다.");
    }
    
    DocumentDetailResponseDTO responseDTO = DocumentDetailResponseDTO.toDTO(document);
    
    boolean isMyTurn = false;
    
    if (document.getDocumentStatus() == DocumentStatus.IN_PROGRESS) {
      ApprovalLine currentTurnLine = document.getApprovalLines().stream()
          .filter(line -> line.getApprovalLineStatus() == ApprovalLineStatus.WAITING)
          .min(Comparator.comparing(ApprovalLine::getApprovalLineOrder))
          .orElse(null);

      if (currentTurnLine != null && currentTurnLine.getApprover().getId().equals(currentUserId))
        isMyTurn = true;
    }
    
    responseDTO.setMyTurnApprove(isMyTurn);
    
    String templateKey = document.getTemplate().getTemplateKey();
    String htmlTemplate = document.getTemplate().getTemplateHtmlContent();
    String jsonData = document.getDocumentDataJson();
    
    try {
      
      TypeReference<Map<String, Object>> typeRef = new TypeReference<>() {};
      Map<String, Object> data = objectMapper.readValue(jsonData, typeRef);
      
      String processedHtml;
      
      if ("EXPENSE".equals(templateKey)) {
        
        String tempHtml = htmlTemplate;
        for (Map.Entry<String, Object> entry : data.entrySet()) {
          if (!(entry.getValue() instanceof Map) && !(entry.getValue() instanceof List)) {
            String key = entry.getKey();
            String value = String.valueOf(entry.getValue());
            tempHtml = tempHtml.replace("${" + key + "}", value);
          }
        }
        
        Context context = new Context();
        context.setVariables(data);
        processedHtml = templateEngine.process(tempHtml, context);
      } else {
        processedHtml = htmlTemplate;
        for (Map.Entry<String, Object> entry : data.entrySet()) {
          String key = entry.getKey();
          String value = String.valueOf(entry.getValue());
          
          if ("vacationType".equals(key)) {
            value = LeaveType.getKoreanByCode(value);
          }
          
          if (entry.getValue() instanceof Map || entry.getValue() instanceof java.util.List) {
            continue;
          }
          processedHtml = processedHtml.replace("${" + key + "}", value);
        }
      }
      
      responseDTO.setProcessedHtmlContent(processedHtml);
      
    } catch (Exception e) {
      log.error("문서 상세 HTML 템플릿 처리 중 오류 발생. documentId: {}", documentId, e);
      responseDTO.setProcessedHtmlContent(htmlTemplate);
    }

    return responseDTO;
  }

  /**
   * 문서를 승인합니다.
   */
  @Override
  @Transactional
  public void approveDocument(Integer documentId, ApprovalApproveRequestDTO requestDTO, String email) {

    // (비관적 락이 적용된 findByIdForUpdate 쿼리를 사용)
    Document document = documentRepository.findByIdForUpdate(documentId)
        .orElseThrow(() -> new EntityNotFoundException("문서를 찾을 수 없습니다. ID: " + documentId));

    // Soft Delete 체크 로직
    if (document.getDocDeletedYn() != null && document.getDocDeletedYn()) {
      throw new EntityNotFoundException("삭제된 문서입니다. ID: " + documentId);
    }

    if (document.getDocumentStatus() != DocumentStatus.IN_PROGRESS) {
      throw new IllegalStateException("진행 중인 문서만 결재할 수 있습니다.");
    }

    User currentUser = findUserByEmail(email);
    Integer currentUserId = currentUser.getId();

    // 현재 결재할 차례인 결재선(ApprovalLine) 찾기 (순차 결재 가정)
    ApprovalLine currentLine = document.getApprovalLines().stream()
        .filter(line -> line.getApprovalLineStatus() == ApprovalLineStatus.WAITING)
        .min(Comparator.comparing(ApprovalLine::getApprovalLineOrder))
        .orElseThrow(() -> new IllegalStateException("결재 대기 중인 항목을 찾을 수 없습니다."));

    // 결재 권한 확인 (내 차례가 맞는지)
    if (!currentLine.getApprover().getId().equals(currentUserId)) {
      throw new IllegalStateException("현재 사용자의 결재 차례가 아닙니다.");
    }

    // 결재선 엔티티 로직 호출 (상태: WAITING -> APPROVED)
    currentLine.approve(requestDTO.getApprovalComment());

    // 문서 엔티티 로직 호출 (모든 결재 완료 시 문서 상태 'COMPLETED'로 변경)
    document.updateStatusAfterApproval();
    
    // 문서가 최종 승인(COMPLETED) && 휴가 템플릿이면 휴가 승인 처리
    if(document.getDocumentStatus() == DocumentStatus.COMPLETED && isLeaveTemplate(document.getTemplate())) {
      leaveService.handleApprovedLeave(document, requestDTO.getApprovalComment());
    }


    // --- 알림 전송 로직 (다음 결재자 또는 기안자에게) ---

    // CASE 1: 결재가 완료된 경우 (최종 승인)
    if (document.getDocumentStatus() == DocumentStatus.COMPLETED) {
      User drafter = document.getUser(); // 기안자
      String message = "상신하신 결재가 최종 승인되었습니다.";

      NotificationPayload payload = createNotificationPayload(
          drafter.getId(),     // 받는사람 (기안자)
          currentUserId,       // 보낸사람 (마지막 결재자)
          currentUser.getName(),
          message,
          document.getId()
          );

      saveNotificationToDB(payload, drafter, document);
      webSocketDeliveryService.sendToUser(drafter.getId(), payload);

    } 
    // CASE 2: 아직 진행 중인 경우 (다음 결재자에게 알림)
    else if (document.getDocumentStatus() == DocumentStatus.IN_PROGRESS) {
      // 다음 결재자 찾기
      ApprovalLine nextLine = document.getApprovalLines().stream()
          .filter(line -> line.getApprovalLineStatus() == ApprovalLineStatus.WAITING)
          .min(Comparator.comparing(ApprovalLine::getApprovalLineOrder))
          .orElse(null); // 다음 결재자가 없으면 null

      if (nextLine != null) {
        User nextApprover = nextLine.getApprover();
        User drafter = document.getUser(); // 기안자
        String message = drafter.getName() + "님으로부터 새로운 결재 요청이 도착했습니다.";

        NotificationPayload payload = createNotificationPayload(
            nextApprover.getId(), // 받는사람 (다음 결재자)
            drafter.getId(),      // 보낸사람 (기안자)
            drafter.getName(),
            message,
            document.getId()
            );

        saveNotificationToDB(payload, nextApprover, document);
        webSocketDeliveryService.sendToUser(nextApprover.getId(), payload);
      }
    }
  }

  /**
   * 문서를 반려합니다.
   */
  @Override
  @Transactional
  public void rejectDocument(Integer documentId, ApprovalRejectRequestDTO requestDTO, String email) {

    // (비관적 락이 적용된 findByIdForUpdate 쿼리를 사용)
    Document document = documentRepository.findByIdForUpdate(documentId)
        .orElseThrow(() -> new EntityNotFoundException("문서를 찾을 수 없습니다. ID: " + documentId));

    if (document.getDocDeletedYn() != null && document.getDocDeletedYn()) {
      throw new EntityNotFoundException("삭제된 문서입니다. ID: " + documentId);
    }

    if (document.getDocumentStatus() != DocumentStatus.IN_PROGRESS) {
      throw new IllegalStateException("진행 중인 문서만 결재할 수 있습니다.");
    }

    User currentUser = findUserByEmail(email);
    Integer currentUserId = currentUser.getId();

    ApprovalLine currentLine = document.getApprovalLines().stream()
        .filter(line -> line.getApprovalLineStatus() == ApprovalLineStatus.WAITING)
        .min(Comparator.comparing(ApprovalLine::getApprovalLineOrder))
        .orElseThrow(() -> new IllegalStateException("결재 대기 중인 항목을 찾을 수 없습니다."));

    if (!currentLine.getApprover().getId().equals(currentUserId)) {
      throw new IllegalStateException("현재 사용자의 결재 차례가 아닙니다.");
    }

    ApprovalLineType currentType = currentLine.getApprovalLineType();

    // 결재선 엔티티 로직 호출 (WAITING -> REJECTED)
    currentLine.reject(requestDTO.getApprovalComment());

    if (currentType == ApprovalLineType.APPROVE) {
      document.reject();
      
      // 휴가 템플릿인지 검사하고 휴가 반려 처리
      if(isLeaveTemplate(document.getTemplate())) {
        leaveService.handleRejectedLeave(document, requestDTO.getApprovalComment());
      }
      
      // --- 알림 전송 로직 (기안자에게) ---
      User drafter = document.getUser(); // 기안자
      String message = "상신하신 결재가 반려되었습니다.";

      NotificationPayload payload = createNotificationPayload(
          drafter.getId(),     // 받는사람 (기안자)
          currentUserId,       // 보낸사람 (반려한 결재자)
          currentUser.getName(),
          message,
          document.getId()
          );

      saveNotificationToDB(payload, drafter, document);
      webSocketDeliveryService.sendToUser(drafter.getId(), payload);
    } else if (currentType == ApprovalLineType.AGREE) {
      // === '합의' 반려(비합의) 로직 ===
      // '합의'자가 반려(비합의)해도 문서는 중단되지 않고 계속 진행됩니다.
      // (document.reject()를 호출하지 않음)

      // '승인' 로직과 동일하게, 다음 결재자가 있는지 확인
      // Document.updateStatusAfterApproval()가 '합의' 비합의를 처리
      document.updateStatusAfterApproval();

      // --- 알림 전송 로직 (다음 결재자 또는 기안자에게) ---

      // CASE 1: '합의'자 반려(비합의) 후 결재가 완료된 경우
      if (document.getDocumentStatus() == DocumentStatus.COMPLETED) {
        User drafter = document.getUser(); // 기안자
        // '비합의'가 포함된 완료 알림 메시지
        String message = "상신하신 결재가 최종 승인되었습니다. (" + currentUser.getName() + "님 비합의)";

        NotificationPayload payload = createNotificationPayload(
            drafter.getId(),     // 받는사람 (기안자)
            currentUserId,       // 보낸사람 (비합의한 합의자)
            currentUser.getName(),
            message,
            document.getId()
            );

        saveNotificationToDB(payload, drafter, document);
        webSocketDeliveryService.sendToUser(drafter.getId(), payload);
      } else if (document.getDocumentStatus() == DocumentStatus.IN_PROGRESS) {
        // 다음 결재자 찾기
        ApprovalLine nextLine = document.getApprovalLines().stream()
            .filter(line -> line.getApprovalLineStatus() == ApprovalLineStatus.WAITING)
            .min(Comparator.comparing(ApprovalLine::getApprovalLineOrder))
            .orElse(null); // 다음 결재자가 없으면 null

        if (nextLine != null) {
          User nextApprover = nextLine.getApprover();
          User drafter = document.getUser(); // 기안자
          String message = drafter.getName() + "님으로부터 새로운 결재 요청이 도착했습니다.";

          NotificationPayload payload = createNotificationPayload(
              nextApprover.getId(), // 받는사람 (다음 결재자)
              drafter.getId(),      // 보낸사람 (기안자)
              drafter.getName(),
              message,
              document.getId()
              );

          saveNotificationToDB(payload, nextApprover, document);
          webSocketDeliveryService.sendToUser(nextApprover.getId(), payload);
        }
      } 
    }
  }

  /**
   * 활성화된 모든 양식(템플릿) 목록을 조회합니다.
   */
  @Override
  public List<TemplateSimpleResponseDTO> getActiveTemplates() {
    // (제공해주신 Repository/DTO의 'toDTO' 메소드 사용)
    List<Template> templates = templateRepository.findByActiveYnTrueOrderByTemplateNameAsc();
    return templates.stream()
        .map(TemplateSimpleResponseDTO::toDTO)
        .collect(Collectors.toList());
  }

  /**
   * 특정 양식(템플릿)의 상세 내용을 조회합니다.
   */
  @Override
  public TemplateDetailResponseDTO getTemplateDetail(Integer templateId) {
    Template template = findTemplateById(templateId);

    return TemplateDetailResponseDTO.toDTO(template);
  }

  // --- Helper Methods ---

  private User findUserByEmail(String email) {
    return userRepository.findByEmail(email)
        .orElseThrow(() -> new EntityNotFoundException("사용자를 찾을 수 없습니다. Email: " + email));
  }
  
  private Template findTemplateById(Integer templateId) {
    Template template = templateRepository.findById(templateId)
        .orElseThrow(() -> new EntityNotFoundException("템플릿(양식)을 찾을 수 없습니다. ID: " + templateId));
    if (!template.isActiveYn()) {
      log.warn("비활성화된 템플릿(ID: {})에 대한 접근 시도가 차단되었습니다.", templateId);
      throw new EntityNotFoundException("활성화된 템플릿(양식)을 찾을 수 없습니다. ID: " + templateId);
    }
    return template;
  }
  
  // 문서 수정 권한 검사 헬퍼 메소드
  private void validateDocumentUpdateAuthority(Document document, User drafter) {
    if (!document.getUser().getId().equals(drafter.getId())) {
      throw new IllegalStateException("문서를 수정할 권한이 없습니다. (기안자 불일치)");
    }
    if (document.getDocumentStatus() != DocumentStatus.DRAFT) {
      throw new IllegalStateException("임시저장(DRAFT) 상태의 문서만 수정할 수 있습니다.");
    }
  }
  
  private void updateApprovalLines(Document document, List<ApprovalLineRequestDTO> approvalLineDTOs) {    
    document.getApprovalLines().clear();
    
    if (approvalLineDTOs != null && !approvalLineDTOs.isEmpty()) {
      List<Integer> approvalIds = approvalLineDTOs.stream()
          .map(ApprovalLineRequestDTO::getUserId)
          .collect(Collectors.toList());
      Map<Integer, User> approverMap = userRepository.findAllById(approvalIds).stream()
          .collect(Collectors.toMap(User::getId, Function.identity()));
      
      AtomicInteger order = new AtomicInteger(1);
      
      approvalLineDTOs.forEach(lineDTO -> {
        User approver = approverMap.get(lineDTO.getUserId());
        if (approver == null) {
          throw new EntityNotFoundException("결재선에 포함된 사용자를 찾을 수 없습니다.");
        }
        lineDTO.toEntity(document, approver, order.getAndIncrement());
      });
    }
  }
  
  private void addFilesToDocument(Document document, List<MultipartFile> files) {
    if (files != null && !files.isEmpty()) {
      try {
        for (MultipartFile file : files) {
          if (file == null || file.isEmpty()) continue;
          String fileUrl = s3Service.uploadApprovalFile(file);
          File.createFile(document, file.getName(), fileUrl, file.getSize());
        }
      } catch (IOException e) {
        throw new FileUploadException("파일 업로드 중 오류가 발생했습니다.", e);
      }
    }
  }
  
  private void sendNotificationToFirstApprover(Document savedDocument, User drafter) {
    ApprovalLine firstLine = savedDocument.getApprovalLines().stream()
        .filter(line -> line.getApprovalLineStatus() == ApprovalLineStatus.WAITING)
        .min(Comparator.comparing(ApprovalLine::getApprovalLineOrder))
        .orElse(null);
    if (firstLine != null ) {
      User firstApprover = firstLine.getApprover();
      String message = drafter.getName() + "님으로부터 새로운 결재 요청이 도착했습니다";
      NotificationPayload payload = createNotificationPayload(firstApprover.getId(), drafter.getId(), drafter.getName(), message, savedDocument.getId());
      saveNotificationToDB(payload, firstApprover, savedDocument);
      webSocketDeliveryService.sendToUser(firstApprover.getId(), payload);
    }
  }


  // --- 알림 페이로드 생성 헬퍼 메서드 ---
  private NotificationPayload createNotificationPayload(Integer recipientId, Integer senderId, String senderName, String message, Integer documentId) {

    NotificationPayload payload = new NotificationPayload();
    payload.setRecipientId(recipientId);
    payload.setSenderId(senderId);
    payload.setSenderName(senderName);
    payload.setMessage(message);
    payload.setNotificationType(NotificationType.APPROVAL.name()); 
    payload.setCreatedAt(LocalDateTime.now());
    // (필요 시) payload.setDocumentId(documentId);

    return payload;
  }

  /**
   * 알림 페이로드(DTO)를 Notification 엔티티로 변환하여 DB에 저장합니다.
   */
  private void saveNotificationToDB(NotificationPayload payload, User recipient, Document document) {
    log.info("[ApprovalServiceImpl] ===== saveNotificationToDB 시작 ===== recipientId={}, senderId={}, documentId={}", 
            recipient.getId(), payload.getSenderId(), document.getId());
    try {
      User senderUser = userRepository.findById(payload.getSenderId()).orElse(null); // sender 정보 조회
      if (senderUser == null) {
        log.error("[ApprovalServiceImpl] ⚠️ senderUser를 찾을 수 없습니다. senderId={}", payload.getSenderId());
      }
      
      log.info("[ApprovalServiceImpl] senderUser 조회 완료: senderId={}, senderName={}", 
              payload.getSenderId(), senderUser != null ? senderUser.getName() : "null");
      
      // (Notification 팩토리 메소드 정상 사용 확인)
      Notification notification = Notification.createNotification(
          recipient, 
          NotificationType.APPROVAL, 
          payload.getMessage(), 
          null,     // Chat
          document, // Document
          null,     // Board
          null,     // Schedule
          false,    // readYn - 명시적으로 false 설정
          true,     // sentYn
          false,    // deletedYn
          LocalDateTime.now(),     // sentAt
          null,      // readAt
          senderUser // sender
          );

      // 알림 생성 직후 readYn 확인
      log.info("[ApprovalServiceImpl] ✅ 알림 생성 직후 상태: recipientId={}, senderId={}, readYn={}, sentYn={}, deletedYn={}, notificationType={}", 
              recipient.getId(), payload.getSenderId(), notification.getNotificationReadYn(), 
              notification.getNotificationSentYn(), notification.getNotificationDeletedYn(), notification.getNotificationType());

      // saveAndFlush를 사용하여 즉시 DB에 반영하고 flush
      log.info("[ApprovalServiceImpl] DB 저장 시작: saveAndFlush 호출 전, readYn={}", notification.getNotificationReadYn());
      Notification savedNotification = notificationRepository.saveAndFlush(notification);
      
      // 저장 직후 readYn 확인 (JPA 엔티티 상태)
      log.info("[ApprovalServiceImpl] ✅ 알림 저장 직후 상태 (JPA 엔티티): notificationId={}, readYn={}, sentYn={}, deletedYn={}", 
              savedNotification.getId(), savedNotification.getNotificationReadYn(), 
              savedNotification.getNotificationSentYn(), savedNotification.getNotificationDeletedYn());
      
      // flush 후 영속성 컨텍스트를 새로 시작하여 DB에서 실제 값을 조회
      notificationRepository.flush();
      Notification dbNotification = notificationRepository.findById(savedNotification.getId()).orElse(null);
      
      if (dbNotification != null) {
        log.info("[ApprovalServiceImpl] ✅ DB 재조회 결과: notificationId={}, readYn={}, sentYn={}, deletedYn={}", 
                dbNotification.getId(), dbNotification.getNotificationReadYn(), 
                dbNotification.getNotificationSentYn(), dbNotification.getNotificationDeletedYn());
        
        // 만약 DB에서 조회한 readYn이 true라면 강제로 false로 업데이트
        if (Boolean.TRUE.equals(dbNotification.getNotificationReadYn())) {
          log.error("[ApprovalServiceImpl] ❌❌❌ DB에 저장된 readYn이 true입니다! false로 강제 업데이트합니다. notificationId={}", 
                  dbNotification.getId());
          dbNotification.markUnread(); // markUnread() 메서드 사용
          dbNotification = notificationRepository.saveAndFlush(dbNotification);
          
          // 다시 조회하여 확인
          Notification reVerified = notificationRepository.findById(dbNotification.getId()).orElse(null);
          if (reVerified != null) {
            log.info("[ApprovalServiceImpl] ✅ 강제 업데이트 후 재조회: notificationId={}, readYn={}", 
                    reVerified.getId(), reVerified.getNotificationReadYn());
            savedNotification = reVerified;
          }
        } else {
          log.info("[ApprovalServiceImpl] ✅ DB에 readYn=false로 정상 저장되었습니다. notificationId={}", dbNotification.getId());
        }
      } else {
        log.error("[ApprovalServiceImpl] ❌ DB에서 알림을 찾을 수 없습니다! notificationId={}", savedNotification.getId());
      }
      
      payload.setNotificationId(savedNotification.getId());
      log.info("[ApprovalServiceImpl] ===== saveNotificationToDB 완료 ===== notificationId={}, readYn={}", 
              savedNotification.getId(), savedNotification.getNotificationReadYn());

    } catch (Exception e) {
      log.error("[ApprovalServiceImpl] ❌❌❌ 알림 DB 저장 실패. (Recipient: {}, Document: {}). Error: {}", 
          recipient.getId(), 
          document.getId(), 
          e.getMessage(), 
          e); // 예외 스택 트레이스도 출력
      e.printStackTrace();
    }
  }
  
  private void validateLeaveOverlap(User user, Template template, String jsonData, Integer currentDocId) {
    try {
      TypeReference<Map<String, Object>> typeRef = new TypeReference<>() {};
      Map<String, Object> requestData = objectMapper.readValue(jsonData, typeRef);
      
      String startStr = (String) requestData.get("startDate");
      String endStr = (String) requestData.get("endDate");
      
      // null 또는 빈 문자열 체크
      if (startStr == null || endStr == null || startStr.trim().isEmpty() || endStr.trim().isEmpty()) {
        log.warn("validateLeaveOverlap: 날짜 필드가 null이거나 비어있습니다. startDate={}, endDate={}", startStr, endStr);
        return;
      }
      
      LocalDate newStart = LocalDate.parse(startStr.trim());
      LocalDate newEnd = LocalDate.parse(endStr.trim());
      
      List<DocumentStatus> activeStatuses = Arrays.asList(
          DocumentStatus.IN_PROGRESS,
          DocumentStatus.COMPLETED
          );
      
      List<Document> existingDocs = documentRepository.findByUserAndTemplateIdAndStatusIn(user, template.getId(), activeStatuses);
      
      for (Document doc : existingDocs) {
        if (currentDocId != null && doc.getId().equals(currentDocId)) {
          continue;
        }
        
        Map<String, Object> docData = objectMapper.readValue(doc.getDocumentDataJson(), typeRef);
        String docStartStr = (String) docData.get("startDate");
        String docEndStr = (String) docData.get("endDate");
        
        // null 또는 빈 문자열 체크
        if (docStartStr != null && docEndStr != null 
            && !docStartStr.trim().isEmpty() && !docEndStr.trim().isEmpty()) {
          LocalDate oldStart = LocalDate.parse(docStartStr.trim());
          LocalDate oldEnd = LocalDate.parse(docEndStr.trim());
          
          if (!newStart.isAfter(oldEnd) && !newEnd.isBefore(oldStart)) {
            throw new IllegalStateException("이미 해당 기간에 신청된 휴가가 존재합니다. ("
                + docStartStr + " ~ " + docEndStr + ")");
          }
        }
      }
      
    } catch (IOException e) {
      log.error("중복 검사 중 JSON 파싱 오류", e);
    } catch (IllegalStateException e) {
      throw e;
    } catch (Exception e) {
      log.error("중복 검사 중 알 수 없는 오류", e);
    }
  }
  
  /** 휴가 템플릿인지 판별하는 메소드 */
  private boolean isLeaveTemplate(Template template) {
    return template.getId().equals(LEAVE_TEMPLATE_ID);
  }
}