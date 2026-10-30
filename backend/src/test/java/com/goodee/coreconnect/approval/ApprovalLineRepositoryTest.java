package com.goodee.coreconnect.approval;

import com.goodee.coreconnect.support.AbstractIntegrationTest;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import com.goodee.coreconnect.approval.entity.ApprovalLine;
import com.goodee.coreconnect.approval.entity.Document;
import com.goodee.coreconnect.approval.entity.Template;
import com.goodee.coreconnect.approval.enums.ApprovalLineStatus;
import com.goodee.coreconnect.approval.enums.ApprovalLineType;
import com.goodee.coreconnect.approval.enums.DocumentStatus;
import com.goodee.coreconnect.approval.repository.ApprovalLineRepository;
import com.goodee.coreconnect.approval.repository.DocumentRepository;
import com.goodee.coreconnect.approval.repository.TemplateRepository;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.enums.Role;
import com.goodee.coreconnect.user.repository.UserRepository;

import jakarta.persistence.EntityNotFoundException;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Transactional
public class ApprovalLineRepositoryTest extends AbstractIntegrationTest {

  @Autowired
  private ApprovalLineRepository approvalLineRepository;

  @Autowired
  private UserRepository userRepository;

  @Autowired
  private DocumentRepository documentRepository;

  @Autowired
  private TemplateRepository templateRepository;

  private User drafter;
  private User approver1;
  private User approver2;
  private Document doc1;
  private Document doc2;
  private Document doc3;
  private Template template;

  @BeforeEach
  void setUp() throws InterruptedException {
    // 테스트 데이터 설정
    drafter = userRepository.save(User.createUser("password0", "기안자", Role.ADMIN, "drafter111@example.com", "010-0000-0000", null, null, null));
    approver1 = userRepository.save(User.createUser("password1", "결재자1", Role.USER, "approver111@example.com", "010-1111-1111", null, null, null));
    approver2 = userRepository.save(User.createUser("password2", "결재자2", Role.USER, "approver221@example.com", "010-2222-2222", null, null, null));
    template = templateRepository.save(Template.createTemplate("테스트 양식", "테스트 양식내용입니다.","테스트 양식", drafter));
    doc1 = documentRepository.save(Document.createDocument(template, drafter, "테스트 문서1 (가장 오래됨)", "테스트 문서 내용1"));
    Thread.sleep(10);
    doc2 = documentRepository.save(Document.createDocument(template, drafter, "테스트 문서2 (중간)", "테스트 문서 내용2"));
    Thread.sleep(10);
    doc3 = documentRepository.save(Document.createDocument(template, drafter, "테스트 문서3 (가장 최신)", "테스트 문서 내용3"));
    userRepository.flush();
    documentRepository.flush();
    templateRepository.flush();
    User email = userRepository.findByEmail("drafter111@example.com").orElseThrow(() -> new EntityNotFoundException("~~~~~이메일을 찾을 수 없습니다.~~~~"));
    log.info("email: {}" ,email.getEmail());
    
    // --- 결재선 생성 시나리오 ---
    ApprovalLine line_doc2_app1 = ApprovalLine.createApprovalLine(doc2, approver1, 1, ApprovalLineType.APPROVE);
    ApprovalLine line_doc1_app1 = ApprovalLine.createApprovalLine(doc1, approver1, 1, ApprovalLineType.APPROVE); 

    ApprovalLine line_doc3_app1_approved = ApprovalLine.createApprovalLine(doc3, approver1, 1, ApprovalLineType.APPROVE);
    line_doc3_app1_approved.approve("테스트 승인"); 

    ApprovalLine line_doc3_app2 = ApprovalLine.createApprovalLine(doc3, approver2, 2, ApprovalLineType.APPROVE);

    approvalLineRepository.saveAll(List.of(
        line_doc2_app1, 
        line_doc1_app1, 
        line_doc3_app1_approved, 
        line_doc3_app2
        ));
    approvalLineRepository.flush();

    log.info("테스트 데이터 설정 완료");
  }

  @Test
  @DisplayName("내가 결재할 문서(WAITING) 조회 - 문서 생성일 오름차순 정렬")
  void findByApproverAndApprovalLineStatusOrderByDocumentCreatedAt() {

    // --- 1. 실행 (Act) ---
    List<ApprovalLine> results = approvalLineRepository.findMyCurrentTasks(
        approver1, 
        ApprovalLineStatus.WAITING,
        DocumentStatus.DRAFT
        );

    // --- 2. 검증 (Assert) ---
    log.info("조회된 결재선 개수: {}", results.size());
    results.forEach(line -> log.info(
        "문서 ID: {}, 문서 생성일: {}", line.getDocument().getId(), line.getDocument().getCreatedAt())
        );

    assertThat(results).hasSize(2);
    assertThat(results).allMatch(line -> line.getApprover().equals(approver1));
    assertThat(results).allMatch(line -> line.getApprovalLineStatus() == ApprovalLineStatus.WAITING);
    assertThat(results).extracting(ApprovalLine::getDocument) 
    .containsExactly(doc1, doc2); // doc1, doc2 순서 검증
  }

  @Test
  @DisplayName("특정 문서의 결재선 조회 - 결재 순서(order) 오름차순 정렬")
  void findByDocumentOrderByApprovalLineOrderAsc() {

    // --- 1. 실행 (Act) ---
    List<ApprovalLine> results = approvalLineRepository.findByDocumentOrderByApprovalLineOrderAsc(doc3);

    // --- 2. 검증 (Assert) ---
    log.info("doc3의 결재선 개수: {}", results.size());

    assertThat(results).hasSize(2);
    assertThat(results).extracting(ApprovalLine::getApprovalLineOrder)
    .containsExactly(1, 2); // 순서 1, 2 검증
    assertThat(results.get(0).getApprover()).isEqualTo(approver1);
    assertThat(results.get(1).getApprover()).isEqualTo(approver2);
  }

}
