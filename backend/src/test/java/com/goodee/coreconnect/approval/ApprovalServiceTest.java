package com.goodee.coreconnect.approval;

import com.goodee.coreconnect.department.entity.Department;
import com.goodee.coreconnect.department.repository.DepartmentRepository;
import com.goodee.coreconnect.support.AbstractIntegrationTest;
import com.goodee.coreconnect.user.enums.JobGrade;
import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.domain.Page;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.goodee.coreconnect.approval.dto.request.ApprovalLineRequestDTO;
import com.goodee.coreconnect.approval.dto.request.ApprovalRejectRequestDTO;
import com.goodee.coreconnect.approval.dto.request.ApprovalApproveRequestDTO;
import com.goodee.coreconnect.approval.dto.request.DocumentCreateRequestDTO;
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

import com.goodee.coreconnect.approval.repository.ApprovalLineRepository;
import com.goodee.coreconnect.approval.repository.DocumentRepository;
import com.goodee.coreconnect.approval.repository.TemplateRepository;
import com.goodee.coreconnect.approval.service.ApprovalService;
import com.goodee.coreconnect.common.service.S3Service;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.enums.Role;
import com.goodee.coreconnect.user.repository.UserRepository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityNotFoundException;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Transactional
public class ApprovalServiceTest extends AbstractIntegrationTest {

  @Autowired
  private ApprovalService approvalService;

  // Service의 의존성 주입
  @Autowired
  private DocumentRepository documentRepository;
  @Autowired
  private TemplateRepository templateRepository;
  @Autowired
  private UserRepository userRepository;
  @Autowired
  private ApprovalLineRepository approvalLineRepository;
  @Autowired
  private DepartmentRepository departmentRepository;

  @Autowired
  private EntityManager em; // 영속성 컨텍스트 관리를 위해 주입

  // S3Service를 Mock(가짜) Bean으로 대체
  @MockBean
  private S3Service s3Service;

  // 테스트용 공통 데이터
  private User drafter;
  private User approver1;
  private User approver2;
  private Template template;
  private Document testDocument;

  @BeforeEach
  void setUp() {
    // 1. 테스트용 사용자 생성 (User.createUser 사용)
    // User.createUser(password, name, role, email, phone, department)
    // 결재선·문서 상세 DTO가 부서명과 직급을 읽으므로 둘 다 채워서 생성
    Department dept = departmentRepository.save(Department.createDepartment("개발부", 1));
    drafter = User.createUser("password123", "기안자", Role.USER, "drafter@test.com", "010-1111-1111", dept, JobGrade.STAFF, null);
    approver1 = User.createUser("password123", "결재자1", Role.USER, "approver1@test.com", "010-2222-2222", dept, JobGrade.MANAGER, null);
    approver2 = User.createUser("password123", "결재자2", Role.USER, "approver2@test.com", "010-3333-3333", dept, JobGrade.DIRECTOR, null);

    userRepository.saveAll(List.of(drafter, approver1, approver2));

    // 2. 테스트용 양식 생성 (Template.createTemplate 사용)
    // Template.createTemplate(templateName, templateContent, user)
    // (기본 activeYn = true로 생성됨)
    template = Template.createTemplate("테스트 양식", "<div>양식 내용</div>", "테스트 양식", drafter);
    templateRepository.save(template);

    // 3. 테스트용 문서 및 결재선 생성 (Document.createDocument, ApprovalLine.createApprovalLine 사용)
    testDocument = Document.createDocument(template, drafter, "기본 테스트 문서", "문서 내용");

    // ApprovalLine.createApprovalLine(document, approver, order, type, status)
    // createApprovalLine 내부에서 document.addApprovalLine(a)이 호출됨
    ApprovalLine.createApprovalLine(testDocument, approver1, 1, ApprovalLineType.APPROVE);
    ApprovalLine.createApprovalLine(testDocument, approver2, 2, ApprovalLineType.APPROVE);

    // Document.submit() 호출 (DRAFT -> IN_PROGRESS)
    testDocument.submit();

    // CascadeType.ALL로 인해 Document 저장 시 ApprovalLine도 함께 저장됨
    documentRepository.save(testDocument);

    // ID 생성을 위해 영속성 컨텍스트 flush
    em.flush();
    em.clear();

    log.info("--- 테스트 데이터 준비 완료 ---");
  }

  // --- createDocument ---

  @Test
  @DisplayName("새 결재 문서 상신 - 성공 (파일 포함)")
  void createDocument_Success_WithFiles() throws IOException {
    // Arrange (Given)
    DocumentCreateRequestDTO requestDTO = new DocumentCreateRequestDTO();
    requestDTO.setTemplateId(template.getId());
    requestDTO.setDocumentTitle("새로운 상신 문서");
    requestDTO.setDocumentDataJson("내용입니다.");
    // 1. 결재선에 담을 DTO 객체들을 생성합니다.
    ApprovalLineRequestDTO line1 = new ApprovalLineRequestDTO();
    line1.setUserId(approver1.getId());
    line1.setType(ApprovalLineType.APPROVE); // (예: 1번 결재자)

    ApprovalLineRequestDTO line2 = new ApprovalLineRequestDTO();
    line2.setUserId(approver2.getId());
    line2.setType(ApprovalLineType.APPROVE); // (예: 2번 결재자)

    // 2. DTO에 List<ApprovalLineRequestDTO>를 설정합니다.
    requestDTO.setApprovalLines(List.of(line1, line2));

    MockMultipartFile file1 = new MockMultipartFile("files", "test.txt", "text/plain", "Hello World".getBytes());
    List<MultipartFile> files = List.of(file1);

    String expectedFileUrl = "http://s3.test.com/test.txt";

    // S3Service Mocking 설정: S3 업로드가 호출되면 expectedFileUrl을 반환하도록 설정
    when(s3Service.uploadApprovalFile(any(MultipartFile.class))).thenReturn(expectedFileUrl);

    // Act (When)
    Integer newDocumentId = approvalService.createDocument(requestDTO, files, drafter.getEmail());

    // Assert (Then)
    assertThat(newDocumentId).isNotNull();

    em.flush(); // DB 반영
    em.clear(); // 영속성 컨텍스트 초기화 (DB에서 다시 불러오기 위함)

    // findDocumentDetailById (Service에서 사용하는 쿼리)로 검증
    Document foundDoc = documentRepository.findDocumentDetailById(newDocumentId).orElseThrow();
    assertThat(foundDoc.getDocumentTitle()).isEqualTo("새로운 상신 문서");
    assertThat(foundDoc.getDocumentStatus()).isEqualTo(DocumentStatus.IN_PROGRESS);
    assertThat(foundDoc.getUser().getId()).isEqualTo(drafter.getId());

    // 결재선 검증 (Entity의 createApprovalLine이 document.addApprovalLine을 호출했는지 확인)
    List<ApprovalLine> lines = foundDoc.getApprovalLines();
    assertThat(lines).hasSize(2);
    assertThat(lines.get(0).getApprover().getId()).isEqualTo(approver1.getId());
    assertThat(lines.get(0).getApprovalLineOrder()).isEqualTo(1);
    assertThat(lines.get(1).getApprover().getId()).isEqualTo(approver2.getId());
    assertThat(lines.get(1).getApprovalLineOrder()).isEqualTo(2);

    // 파일 검증 (Entity의 createFile이 document.getFiles().add()를 호출했는지 확인)
    assertThat(foundDoc.getFiles()).hasSize(1);
    File savedFile = foundDoc.getFiles().iterator().next(); 
    assertThat(savedFile.getFileUrl()).isEqualTo(expectedFileUrl);

    // S3 서비스가 1번 호출되었는지 검증
    verify(s3Service, times(1)).uploadApprovalFile(any(MultipartFile.class));
  }

  @Test
  @DisplayName("새 결재 문서 상신 - 성공 (파일 없음)")
  void createDocument_Success_NoFiles() throws IOException {
    // Arrange
    DocumentCreateRequestDTO requestDTO = new DocumentCreateRequestDTO();

    ApprovalLineRequestDTO line1 = new ApprovalLineRequestDTO();
    line1.setUserId(approver1.getId());
    line1.setType(ApprovalLineType.APPROVE);

    requestDTO.setTemplateId(template.getId());
    requestDTO.setDocumentTitle("파일 없는 상신 문서");
    requestDTO.setDocumentDataJson("내용입니다.");
    requestDTO.setApprovalLines(List.of(line1));

    List<MultipartFile> files = null; // 파일 없음

    // Act
    Integer newDocumentId = approvalService.createDocument(requestDTO, files, drafter.getEmail());

    // Assert
    assertThat(newDocumentId).isNotNull();
    Document foundDoc = documentRepository.findById(newDocumentId).orElseThrow();
    assertThat(foundDoc.getDocumentTitle()).isEqualTo("파일 없는 상신 문서");
    assertThat(foundDoc.getFiles()).isEmpty();

    // S3 서비스가 호출되지 않았는지 검증
    verify(s3Service, times(0)).uploadApprovalFile(any(MultipartFile.class));
  }

  @Test
  @DisplayName("새 결재 문서 상신 - 실패 (존재하지 않는 템플릿)")
  void createDocument_Fail_TemplateNotFound() {
    // Arrange
    DocumentCreateRequestDTO requestDTO = new DocumentCreateRequestDTO();

    ApprovalLineRequestDTO line1 = new ApprovalLineRequestDTO();
    line1.setUserId(approver1.getId());
    line1.setType(ApprovalLineType.APPROVE);

    requestDTO.setTemplateId(99999); // 존재하지 않는 ID
    requestDTO.setApprovalLines(List.of(line1));

    // Act & Assert
    assertThrows(EntityNotFoundException.class, () -> {
      approvalService.createDocument(requestDTO, null, drafter.getEmail());
    }, "해당 템플릿을 찾을 수 없습니다.");
  }

  @Test
  @DisplayName("새 결재 문서 상신 - 실패 (존재하지 않는 결재자)")
  void createDocument_Fail_ApproverNotFound() {
    // Arrange
    DocumentCreateRequestDTO requestDTO = new DocumentCreateRequestDTO();

    ApprovalLineRequestDTO line1 = new ApprovalLineRequestDTO();
    line1.setUserId(99999);
    line1.setType(ApprovalLineType.APPROVE);

    requestDTO.setTemplateId(template.getId());
    requestDTO.setApprovalLines(List.of(line1)); // 존재하지 않는 결재자 ID

    // Act & Assert
    assertThrows(EntityNotFoundException.class, () -> {
      approvalService.createDocument(requestDTO, null, drafter.getEmail());
    }, "사용자를 찾을 수 없습니다.");
  }

  // --- getMyDrafts ---

  @Test
  @DisplayName("내 상신함 조회 - 성공")
  void getMyDrafts_Success() {
    // Arrange (Given)
    // @BeforeEach에서 'drafter'가 'testDocument'를 생성함

    // Act (When)
    Page<DocumentSimpleResponseDTO> drafts = approvalService.getMyDocuments(drafter.getEmail(), null);

    // Assert (Then)
    assertThat(drafts).isNotNull();
    assertThat(drafts).hasSize(1);
    DocumentSimpleResponseDTO draft = drafts.getContent().get(0);
    assertThat(draft.getDocumentId()).isEqualTo(testDocument.getId());
    assertThat(draft.getDocumentTitle()).isEqualTo("기본 테스트 문서");
  }

  @Test
  @DisplayName("내 상신함 조회 - 성공 (삭제된 문서 제외)")
  void getMyDrafts_Success_ExcludeDeleted() {
    // Arrange
    // (주의) 영속성 컨텍스트에 있는 testDocument를 수정하면 안 됨
    // DB에서 불러와서 수정해야 함
    Document docToUpdate = documentRepository.findById(testDocument.getId()).orElseThrow();
    docToUpdate.markDeleted(true); // 엔티티의 markDeleted(true) 사용
    documentRepository.saveAndFlush(docToUpdate);

    // Act
    Page<DocumentSimpleResponseDTO> drafts = approvalService.getMyDocuments(drafter.getEmail(), null);

    // Assert
    // Service의 리포지토리 쿼리(findByUserAndDocDeletedYnOrderByCreatedAtDesc(user, false))가
    // docDeletedYn = false 인 것만 가져오므로 0건이어야 함.
    assertThat(drafts).isEmpty();
  }

  // --- getMyTasks ---

  @Test
  @DisplayName("내 결재함 조회 - 성공 (결재할 문서 1건)")
  void getMyTasks_Success() {
    // Arrange (Given)
    // 'testDocument'는 'approver1'이 첫 번째 결재자(WAITING)임

    // Act (When)
    List<DocumentSimpleResponseDTO> tasks = approvalService.getMyTasks(approver1.getEmail());

    // Assert (Then)
    assertThat(tasks).isNotNull();
    assertThat(tasks).hasSize(1);
    assertThat(tasks.get(0).getDocumentId()).isEqualTo(testDocument.getId());
    assertThat(tasks.get(0).getDocumentStatus()).isEqualTo(DocumentStatus.IN_PROGRESS);
  }

  @Test
  @DisplayName("내 결재함 조회 - 성공 (결재할 문서 0건 - 내 차례 아님)")
  void getMyTasks_Empty_NotMyTurn() {
    // Arrange
    // 'approver2'는 두 번째 결재자임

    // Act
    List<DocumentSimpleResponseDTO> tasks = approvalService.getMyTasks(approver2.getEmail());

    // Assert
    assertThat(tasks).isNotNull();
    assertThat(tasks).isEmpty();
  }

  @Test
  @DisplayName("내 결재함 조회 - 성공 (결재할 문서 0건 - 문서가 REJECTED 상태)")
  void getMyTasks_Empty_DocumentRejected() {
    // Arrange
    Document docToUpdate = documentRepository.findById(testDocument.getId()).orElseThrow();
    docToUpdate.reject(); // 엔티티의 reject() 사용
    documentRepository.saveAndFlush(docToUpdate);

    // Act
    // Service의 리포지토리 쿼리(findMyTasks)가 IN_PROGRESS 상태만 조회함
    List<DocumentSimpleResponseDTO> tasks = approvalService.getMyTasks(approver1.getEmail());

    // Assert
    assertThat(tasks).isEmpty();
  }

  // --- getDocumentDetail ---

  @Test
  @DisplayName("문서 상세 조회 - 성공 (기안자)")
  void getDocumentDetail_Success_AsDrafter() {
    // Arrange
    Integer docId = testDocument.getId();
    String email = drafter.getEmail();

    // Act
    DocumentDetailResponseDTO detail = approvalService.getDocumentDetail(docId, email);

    // Assert
    assertThat(detail).isNotNull();
    assertThat(detail.getDocumentId()).isEqualTo(docId);
    assertThat(detail.getDrafter().getUserName()).isEqualTo(drafter.getName()); // 엔티티 필드명 'name'
    assertThat(detail.getApprovalLines()).hasSize(2);
  }

  @Test
  @DisplayName("문서 상세 조회 - 성공 (결재자)")
  void getDocumentDetail_Success_AsApprover() {
    // Arrange
    Integer docId = testDocument.getId();
    String email = approver1.getEmail(); // 결재선에 포함됨

    // Act
    DocumentDetailResponseDTO detail = approvalService.getDocumentDetail(docId, email);

    // Assert
    assertThat(detail).isNotNull();
    assertThat(detail.getDocumentId()).isEqualTo(docId);
  }

  @Test
  @DisplayName("문서 상세 조회 - 실패 (권한 없음)")
  void getDocumentDetail_Fail_NoPermission() {
    // Arrange
    User otherUser = User.createUser("pass123", "외부인", Role.USER, "other@test.com", "010-4444-4444", null, null, null);
    userRepository.save(otherUser);

    Integer docId = testDocument.getId();
    String email = otherUser.getEmail(); // 기안자도, 결재자도 아님

    // Act & Assert
    assertThrows(IllegalStateException.class, () -> {
      approvalService.getDocumentDetail(docId, email);
    }, "문서를 열람할 권한이 없습니다.");
  }

  @Test
  @DisplayName("문서 상세 조회 - 실패 (삭제된 문서)")
  void getDocumentDetail_Fail_DeletedDocument() {
    // Arrange
    Document docToUpdate = documentRepository.findById(testDocument.getId()).orElseThrow();
    docToUpdate.markDeleted(true); // 엔티티의 markDeleted(true) 사용
    documentRepository.saveAndFlush(docToUpdate);

    em.clear(); // 영속성 컨텍스트 초기화

    Integer docId = testDocument.getId();

    // Act & Assert
    // 서비스 로직에서 docDeletedYn == true 이면 EntityNotFoundException 발생시킴
    assertThrows(EntityNotFoundException.class, () -> {
      approvalService.getDocumentDetail(docId, drafter.getEmail()); 
    }, "삭제된 문서입니다.");
  }

  // --- approveDocument ---

  @Test
  @DisplayName("문서 승인 - 성공 (중간 결재자)")
  void approveDocument_Success_FirstApprover() {
    // Arrange
    ApprovalApproveRequestDTO requestDTO = new ApprovalApproveRequestDTO();
    requestDTO.setApprovalComment("승인합니다.");

    Integer docId = testDocument.getId();
    String email = approver1.getEmail();

    // Act
    approvalService.approveDocument(docId, requestDTO, email);

    em.flush();
    em.clear();

    // Assert
    Document updatedDoc = documentRepository.findById(docId).orElseThrow();
    // 결재선은 Lazy Loading이므로 ID로 다시 조회
    ApprovalLine line1 = approvalLineRepository.findById(updatedDoc.getApprovalLines().get(0).getId()).orElseThrow();

    assertThat(line1.getApprovalLineStatus()).isEqualTo(ApprovalLineStatus.APPROVED);
    assertThat(line1.getApprovalLineComment()).isEqualTo("승인합니다.");
    assertThat(line1.getApprovalLineProcessedAt()).isNotNull();

    // 아직 approver2가 남았으므로 IN_PROGRESS
    assertThat(updatedDoc.getDocumentStatus()).isEqualTo(DocumentStatus.IN_PROGRESS);
  }

  @Test
  @DisplayName("문서 승인 - 성공 (최종 결재자 -> 완료)")
  void approveDocument_Success_FinalApprover() {
    // Arrange
    Integer docId = testDocument.getId();

    // 1. 첫 번째 결재자가 먼저 승인
    approvalService.approveDocument(docId, new ApprovalApproveRequestDTO(), approver1.getEmail());

    // 2. 최종 결재자 DTO 준비
    ApprovalApproveRequestDTO finalRequest = new ApprovalApproveRequestDTO();
    finalRequest.setApprovalComment("최종 승인");

    String email = approver2.getEmail();

    // Act
    approvalService.approveDocument(docId, finalRequest, email);

    em.flush();
    em.clear();

    // Assert
    Document completedDoc = documentRepository.findById(docId).orElseThrow();
    ApprovalLine line2 = approvalLineRepository.findById(completedDoc.getApprovalLines().get(1).getId()).orElseThrow();

    assertThat(line2.getApprovalLineStatus()).isEqualTo(ApprovalLineStatus.APPROVED);

    // 서비스의 document.updateStatusAfterApproval()가 엔티티의 complete()를 호출했는지 검증
    assertThat(completedDoc.getDocumentStatus()).isEqualTo(DocumentStatus.COMPLETED);
  }

  @Test
  @DisplayName("문서 승인 - 실패 (권한 없음 - 순서 아님)")
  void approveDocument_Fail_WrongTurn() {
    // Arrange
    ApprovalApproveRequestDTO requestDTO = new ApprovalApproveRequestDTO();

    Integer docId = testDocument.getId();
    String email = approver2.getEmail(); // 아직 approver1 차례임

    // Act & Assert
    assertThrows(IllegalStateException.class, () -> {
      approvalService.approveDocument(docId, requestDTO, email);
    }, "현재 사용자의 결재 차례가 아닙니다.");
  }

  // --- rejectDocument ---

  @Test
  @DisplayName("문서 반려 - 성공")
  void rejectDocument_Success() {
    // Arrange
    ApprovalRejectRequestDTO requestDTO = new ApprovalRejectRequestDTO();
    requestDTO.setApprovalComment("반려합니다. 사유: ...");

    Integer docId = testDocument.getId();
    String email = approver1.getEmail(); // 첫 번째 결재자

    // Act
    approvalService.rejectDocument(docId, requestDTO, email);

    em.flush();
    em.clear();

    // Assert
    Document rejectedDoc = documentRepository.findById(docId).orElseThrow();
    ApprovalLine line1 = approvalLineRepository.findById(rejectedDoc.getApprovalLines().get(0).getId()).orElseThrow();

    // ApprovalLine 엔티티의 reject() 호출 검증
    assertThat(line1.getApprovalLineStatus()).isEqualTo(ApprovalLineStatus.REJECTED);
    assertThat(line1.getApprovalLineComment()).isEqualTo("반려합니다. 사유: ...");

    // Document 엔티티의 reject() 호출 검증
    assertThat(rejectedDoc.getDocumentStatus()).isEqualTo(DocumentStatus.REJECTED);
  }

  @Test
  @DisplayName("문서 반려 - 실패 (진행중인 문서 아님)")
  void rejectDocument_Fail_NotInProgress() {
    // Arrange
    Document doc = documentRepository.findById(testDocument.getId()).orElseThrow();
    doc.reject(); // 엔티티의 reject()로 이미 반려 상태로 만듦
    documentRepository.saveAndFlush(doc);
    em.clear();

    ApprovalRejectRequestDTO requestDTO = new ApprovalRejectRequestDTO();
    Integer docId = testDocument.getId();
    String email = approver1.getEmail();

    // Act & Assert
    assertThrows(IllegalStateException.class, () -> {
      approvalService.rejectDocument(docId, requestDTO, email);
    }, "진행 중인 문서만 결재할 수 있습니다.");
  }

  // --- Template Methods ---

  @Test
  @DisplayName("활성 양식 목록 조회 - 성공")
  void getActiveTemplates_Success() {
    // Arrange
    // 'template' (active=true)은 @BeforeEach에서 생성됨
    Template inactiveTemplate = Template.createTemplate("비활성 양식", "내용", "비활성 양식", drafter);
    inactiveTemplate.deactivate(); // 엔티티의 deactivate() 사용
    templateRepository.save(inactiveTemplate);

    em.flush();
    em.clear();

    // Act
    List<TemplateSimpleResponseDTO> templates = approvalService.getActiveTemplates();

    // Assert
    // 리포지토리 쿼리(findByActiveYnTrue...)가 활성 양식만 가져와야 함
    assertThat(templates).extracting(TemplateSimpleResponseDTO::getTemplateName)
        .contains("테스트 양식")
        .doesNotContain("비활성 양식");
  }

  @Test
  @DisplayName("양식 상세 조회 - 성공")
  void getTemplateDetail_Success() {
    // Arrange
    Integer templateId = template.getId();

    // Act
    TemplateDetailResponseDTO detail = approvalService.getTemplateDetail(templateId);

    // Assert
    assertThat(detail).isNotNull();
    assertThat(detail.getTemplateId()).isEqualTo(templateId);
    assertThat(detail.getTemplateHtmlContent()).isEqualTo("<div>양식 내용</div>");
  }

  @Test
  @DisplayName("양식 상세 조회 - 실패 (ID 없음)")
  void getTemplateDetail_Fail_NotFound() {
    // Act & Assert
    assertThrows(EntityNotFoundException.class, () -> {
      approvalService.getTemplateDetail(99999);
    });
  }
}