package com.goodee.coreconnect.approval;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.goodee.coreconnect.approval.entity.ApprovalLine;
import com.goodee.coreconnect.approval.entity.Document;
import com.goodee.coreconnect.approval.entity.Template;
import com.goodee.coreconnect.approval.enums.ApprovalLineType;
import com.goodee.coreconnect.approval.repository.DocumentRepository;
import com.goodee.coreconnect.approval.repository.TemplateRepository;
import com.goodee.coreconnect.department.entity.Department;
import com.goodee.coreconnect.department.repository.DepartmentRepository;
import com.goodee.coreconnect.security.jwt.JwtProvider;
import com.goodee.coreconnect.support.AbstractIntegrationTest;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.enums.JobGrade;
import com.goodee.coreconnect.user.enums.Role;
import com.goodee.coreconnect.user.repository.UserRepository;

import jakarta.servlet.http.Cookie;

/**
 * 부서나 직급이 없는 사용자가 결재 문서에 들어갔을 때의 재현 테스트
 *
 * 관리자 사용자 생성(CreateUserReqDTO)은 deptId와 jobGrade를 비워도 통과한다.
 * - 요청은 MockMvc로 보내고 실제 로그인과 같은 access_token 쿠키를 붙여, 응답 코드까지 확인한다.
 * - "200이어야 한다" 테스트는 수정 전 코드에서 실패하는 것이 정상이다(= 문제가 실제로 있다는 증거).
 * - 마지막 테스트는 수정 전·후 모두 통과해야 한다(= 부서가 있는 사용자의 응답이 그대로라는 증거).
 */
@AutoConfigureMockMvc
@TestPropertySource(properties = "security.mode=secure")
class ApprovalNoDepartmentUserTest extends AbstractIntegrationTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private JwtProvider jwtProvider;
  @Autowired private UserRepository userRepository;
  @Autowired private DepartmentRepository departmentRepository;
  @Autowired private TemplateRepository templateRepository;
  @Autowired private DocumentRepository documentRepository;

  @Test
  @DisplayName("부서 없는 기안자의 문서를 상세조회하면 200이고 기안자 부서명은 비어 있다")
  void detail_drafterWithoutDepartment_ok() throws Exception {
    User drafter = newUser("drafter", null, JobGrade.STAFF);
    User approver = newUser("approver", newDepartment(), JobGrade.MANAGER);
    Document document = submittedDocument(drafter, approver);

    mockMvc.perform(as(drafter, get("/api/v1/approvals/{id}", document.getId())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.drafter.userName").value("drafter"))
        .andExpect(jsonPath("$.drafter.deptName").isEmpty());
  }

  @Test
  @DisplayName("결재자에게 부서가 없어도 문서 상세조회는 200이고 그 결재선의 부서명은 비어 있다")
  void detail_approverWithoutDepartment_ok() throws Exception {
    User drafter = newUser("drafter", newDepartment(), JobGrade.STAFF);
    User approver = newUser("approver", null, JobGrade.MANAGER);
    Document document = submittedDocument(drafter, approver);

    mockMvc.perform(as(drafter, get("/api/v1/approvals/{id}", document.getId())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.approvalLines[0].name").value("approver"))
        .andExpect(jsonPath("$.approvalLines[0].deptName").isEmpty());
  }

  @Test
  @DisplayName("부서 없는 결재자가 내 결재함 목록을 열면 200이고 문서가 보인다")
  void myTasks_approverWithoutDepartment_ok() throws Exception {
    User drafter = newUser("drafter", newDepartment(), JobGrade.STAFF);
    User approver = newUser("approver", null, JobGrade.MANAGER);
    Document document = submittedDocument(drafter, approver);

    mockMvc.perform(as(approver, get("/api/v1/approvals/my-tasks")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].documentId").value(document.getId()));
  }

  @Test
  @DisplayName("결재자에게 부서가 없어도 기안자의 내 문서함 목록은 200이고 문서가 보인다")
  void myDocuments_approverWithoutDepartment_ok() throws Exception {
    User drafter = newUser("drafter", newDepartment(), JobGrade.STAFF);
    User approver = newUser("approver", null, JobGrade.MANAGER);
    Document document = submittedDocument(drafter, approver);

    mockMvc.perform(as(drafter, get("/api/v1/approvals/my-documents")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].documentId").value(document.getId()))
        .andExpect(jsonPath("$.content[0].approvalLines[0].deptName").isEmpty());
  }

  @Test
  @DisplayName("기안자에게 부서가 없어도 내 문서함 목록은 200이고 문서가 보인다")
  void myDocuments_drafterWithoutDepartment_ok() throws Exception {
    User drafter = newUser("drafter", null, JobGrade.STAFF);
    User approver = newUser("approver", newDepartment(), JobGrade.MANAGER);
    Document document = submittedDocument(drafter, approver);

    mockMvc.perform(as(drafter, get("/api/v1/approvals/my-documents")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].documentId").value(document.getId()))
        .andExpect(jsonPath("$.content[0].deptName").isEmpty());
  }

  @Test
  @DisplayName("결재자에게 직급이 없어도 내 문서함 목록은 200이고 문서가 보인다")
  void myDocuments_approverWithoutJobGrade_ok() throws Exception {
    User drafter = newUser("drafter", newDepartment(), JobGrade.STAFF);
    User approver = newUser("approver", newDepartment(), null);
    Document document = submittedDocument(drafter, approver);

    mockMvc.perform(as(drafter, get("/api/v1/approvals/my-documents")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content[0].documentId").value(document.getId()))
        .andExpect(jsonPath("$.content[0].approvalLines[0].positionName").isEmpty());
  }

  @Test
  @DisplayName("부서 없는 사용자가 참조자여도 참조자의 참조함은 200이고 문서가 보인다")
  void referenceDocs_refererWithoutDepartment_ok() throws Exception {
    User drafter = newUser("drafter", newDepartment(), JobGrade.STAFF);
    User approver = newUser("approver", newDepartment(), JobGrade.MANAGER);
    User referer = newUser("referer", null, null);
    Document document = submittedDocument(drafter, approver, referer);

    mockMvc.perform(as(referer, get("/api/v1/approvals/my-reference-docs")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].documentId").value(document.getId()));
  }

  @Test
  @DisplayName("임시저장 문서의 결재자에게 부서·직급이 없어도 임시저장함은 200이고 문서가 보인다")
  void drafts_approverWithoutDepartmentAndJobGrade_ok() throws Exception {
    User drafter = newUser("drafter", newDepartment(), JobGrade.STAFF);
    User approver = newUser("approver", null, null);
    Document document = draftDocument(drafter, approver);

    mockMvc.perform(as(drafter, get("/api/v1/approvals/drafts")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].documentId").value(document.getId()));
  }

  @Test
  @DisplayName("결재자에게 부서·직급이 없어도 진행 문서 목록은 200이고 문서가 보인다")
  void pendingDocuments_approverWithoutDepartmentAndJobGrade_ok() throws Exception {
    User drafter = newUser("drafter", newDepartment(), JobGrade.STAFF);
    User approver = newUser("approver", null, null);
    Document document = submittedDocument(drafter, approver);

    mockMvc.perform(as(drafter, get("/api/v1/approvals/my-documents/pending")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].documentId").value(document.getId()));
  }

  @Test
  @DisplayName("결재자에게 부서·직급이 없어도 완료 문서 목록은 200이고 문서가 보인다")
  void completedDocuments_approverWithoutDepartmentAndJobGrade_ok() throws Exception {
    User drafter = newUser("drafter", newDepartment(), JobGrade.STAFF);
    User approver = newUser("approver", null, null);
    Document document = draftDocument(drafter, approver);
    document.submit();
    document.complete();
    documentRepository.save(document);

    mockMvc.perform(as(drafter, get("/api/v1/approvals/my-documents/completed")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].documentId").value(document.getId()));
  }

  @Test
  @DisplayName("결재자에게 직급이 없어도 문서 상세조회는 200이고 그 결재선의 직급은 비어 있다")
  void detail_approverWithoutJobGrade_ok() throws Exception {
    User drafter = newUser("drafter", newDepartment(), JobGrade.STAFF);
    User approver = newUser("approver", newDepartment(), null);
    Document document = submittedDocument(drafter, approver);

    mockMvc.perform(as(drafter, get("/api/v1/approvals/{id}", document.getId())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.approvalLines[0].positionName").isEmpty());
  }

  @Test
  @DisplayName("부서와 직급이 모두 있으면 문서 상세조회 응답에 그 값이 그대로 나온다")
  void detail_withDepartmentAndJobGrade_keepsValues() throws Exception {
    User drafter = newUser("drafter", newDepartment(), JobGrade.STAFF);
    User approver = newUser("approver", newDepartment(), JobGrade.MANAGER);
    Document document = submittedDocument(drafter, approver);

    mockMvc.perform(as(drafter, get("/api/v1/approvals/{id}", document.getId())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.drafter.deptName").value("개발부"))
        .andExpect(jsonPath("$.drafter.positionName").value("STAFF"))
        .andExpect(jsonPath("$.approvalLines[0].deptName").value("개발부"))
        .andExpect(jsonPath("$.approvalLines[0].positionName").value("MANAGER"));
  }

  private MockHttpServletRequestBuilder as(User user, MockHttpServletRequestBuilder request) {
    String token = jwtProvider.createAccess(user.getEmail(), user.getRole(), 30);
    return request.cookie(new Cookie("access_token", token));
  }

  private Department newDepartment() {
    return departmentRepository.save(Department.createDepartment("개발부", 1));
  }

  private User newUser(String name, Department department, JobGrade jobGrade) {
    String email = name + "-" + UUID.randomUUID() + "@test.com";
    return userRepository.save(User.createUser("pw", name, Role.USER, email, null, department, jobGrade, null));
  }

  /** 기안자가 상신해서 결재자 차례(IN_PROGRESS, WAITING)가 된 문서 */
  private Document submittedDocument(User drafter, User approver) {
    Document document = draftDocument(drafter, approver);
    document.submit();
    return documentRepository.save(document);
  }

  /** 상신한 문서에 참조자를 넣은 문서 */
  private Document submittedDocument(User drafter, User approver, User referer) {
    Document document = newDocument(drafter);
    ApprovalLine.createApprovalLine(document, approver, 1, ApprovalLineType.APPROVE);
    ApprovalLine.createApprovalLine(document, referer, 2, ApprovalLineType.REFER);
    document.submit();
    return documentRepository.save(document);
  }

  /** 결재선만 지정하고 상신하지 않은 문서(DRAFT) */
  private Document draftDocument(User drafter, User approver) {
    Document document = newDocument(drafter);
    ApprovalLine.createApprovalLine(document, approver, 1, ApprovalLineType.APPROVE);
    return documentRepository.save(document);
  }

  private Document newDocument(User drafter) {
    Template template = templateRepository.save(
        Template.createTemplate("일반", "<p></p>", "GENERAL-" + UUID.randomUUID(), drafter));
    return Document.createDocument(template, drafter, "테스트 문서", "{}");
  }
}
