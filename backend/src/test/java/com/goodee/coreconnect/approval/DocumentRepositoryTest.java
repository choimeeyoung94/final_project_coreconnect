package com.goodee.coreconnect.approval;

import com.goodee.coreconnect.support.AbstractIntegrationTest;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
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
import com.goodee.coreconnect.department.entity.Department; // Department 임포트
import com.goodee.coreconnect.department.repository.DepartmentRepository; // DepartmentRepository 임포트
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.enums.Role;
import com.goodee.coreconnect.user.repository.UserRepository;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Transactional
public class DocumentRepositoryTest extends AbstractIntegrationTest {

    @Autowired private DocumentRepository documentRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private TemplateRepository templateRepository;
    @Autowired private ApprovalLineRepository approvalLineRepository;
    @Autowired private DepartmentRepository departmentRepository; // User 생성을 위해

    // 테스트 데이터
    private User drafter1; // 주인공 기안자
    private User drafter2; // 노이즈 데이터용 기안자
    private User approver1; // 결재자
    private Template template;
    private Document doc1_draft; // drafter1 작성 (DRAFT, 가장 오래됨)
    private Document doc2_inprogress; // drafter1 작성 (IN_PROGRESS, 중간)
    private Document doc3_completed; // drafter1 작성 (COMPLETED, 최신)
    private Document doc4_noise; // drafter2 작성 (IN_PROGRESS, 노이즈)

    @BeforeEach
    void setUp() throws InterruptedException {
        
        // --- 1. 부서, 유저, 템플릿 생성 ---
        Department devDept = departmentRepository.save(Department.createDepartment("개발부", 1));
        
        drafter1 = userRepository.save(User.createUser("pw123", "기안자1", Role.USER, "drafter1@example.com", "010-1111-1111", devDept, null, null));
        drafter2 = userRepository.save(User.createUser("pw123", "기안자2", Role.USER, "drafter2@example.com", "010-2222-2222", devDept, null, null));
        approver1 = userRepository.save(User.createUser("pw123", "결재자1", Role.USER, "approver1@example.com", "010-3333-3333", devDept, null, null));
        
        template = templateRepository.save(Template.createTemplate("테스트 양식", "내용","테스트 양식", drafter1));

        // --- 2. 문서 생성 (시나리오) ---
        // 순서: doc1 (가장 오래됨) -> doc2 -> doc4 -> doc3 (가장 최신)
        doc1_draft = Document.createDocument(template, drafter1, "문서1 (DRAFT)", "내용");
        documentRepository.save(doc1_draft); // DRAFT 상태 (기본값)
        
        Thread.sleep(10);
        doc2_inprogress = Document.createDocument(template, drafter1, "문서2 (IN_PROGRESS)", "내용");
        documentRepository.save(doc2_inprogress);

        Thread.sleep(10);
        doc4_noise = Document.createDocument(template, drafter2, "문서4 (다른 작성자)", "내용");
        documentRepository.save(doc4_noise);
        
        Thread.sleep(10);
        doc3_completed = Document.createDocument(template, drafter1, "문서3 (COMPLETED)", "내용");
        doc3_completed = Document.createDocument(template, drafter1, "문서3 (DRAFT, 최신)", "내용");
        documentRepository.save(doc3_completed); // DRAFT 상태
        
        
        // --- 3. 결재선 생성 ---
        // doc2 (drafter1, IN_PROGRESS) -> approver1이 결재
        ApprovalLine line1 = ApprovalLine.createApprovalLine(doc2_inprogress, approver1, 1, ApprovalLineType.APPROVE);
        // doc4 (drafter2, IN_PROGRESS) -> approver1이 결재
        ApprovalLine line2 = ApprovalLine.createApprovalLine(doc4_noise, approver1, 1, ApprovalLineType.APPROVE);
        
        approvalLineRepository.saveAll(List.of(line1, line2));
        approvalLineRepository.flush();
        doc2_inprogress.submit();
        doc4_noise.submit(); // IN_PROGRESS 상태로 변경

        log.info("테스트 데이터 설정 완료");
    }

    @Test
    @DisplayName("내가 작성한 문서 목록 조회 - 생성일 내림차순 정렬")
    void findByUserOrderByCreatedAtDesc() {
        
        // --- 1. 실행 (Act) ---
        // drafter1이 작성한 문서를 조회 (임시저장 doc1·doc3는 상신함에서 빠지므로 doc2만)
        Page<Document> results = documentRepository.findByUserAndDocDeletedYnOrderByCreatedAtDesc(drafter1, false, null);

        // --- 2. 검증 (Assert) ---
        log.info("drafter1이 작성한 문서 개수: {}", results.getSize());

        // (검증 1) 쿼리가 DRAFT를 제외하므로 drafter1의 문서는 1개여야 한다. (doc4_noise 제외)
        assertThat(results).hasSize(1);
        
        // (검증 2) 모든 문서의 작성자는 drafter1이어야 한다.
        assertThat(results).allMatch(doc -> doc.getUser().equals(drafter1));

        assertThat(results).extracting(Document::getId)
                           .containsExactly(doc2_inprogress.getId());
    }

    @Test
    @DisplayName("특정 상태의 문서 목록 조회 - 생성일 내림차순 정렬")
    void findByDocumentStatusOrderByCreatedAtDesc() {
        
        // --- 1. 실행 (Act) ---
        // 상태가 'IN_PROGRESS'인 문서를 조회 (doc2, doc4)
        List<Document> results = documentRepository.findByDocumentStatusOrderByCreatedAtDesc(DocumentStatus.IN_PROGRESS);

        // --- 2. 검증 (Assert) ---
        log.info("IN_PROGRESS 상태 문서 개수: {}", results.size());

        // (검증 1) IN_PROGRESS 상태 문서는 총 2개여야 한다.
        assertThat(results).hasSize(2);
        
        // (검증 2) 모든 문서의 상태는 IN_PROGRESS여야 한다.
        assertThat(results).allMatch(doc -> doc.getDocumentStatus() == DocumentStatus.IN_PROGRESS);

        // (검증 3) (핵심!) createdAt 내림차순(최신순)으로 정렬되어야 한다.
        // 순서: doc4 (최신) -> doc2 (오래됨)
        assertThat(results).extracting(Document::getId)
                           .containsExactly(doc4_noise.getId(), doc2_inprogress.getId());
    }

    @Test
    @DisplayName("내가 결재할 문서 목록 조회 (결재선 IN 활용)")
    void findByApprovalLinesIn() {
        
        // --- 1. 준비 (Arrange) ---
        // approver1이 결재할 'WAITING' 상태인 결재선 목록을 먼저 조회
        List<ApprovalLine> linesForApprover1 = approvalLineRepository
            .findMyCurrentTasks(approver1, ApprovalLineStatus.WAITING, DocumentStatus.IN_PROGRESS);
        
        // (준비 검증) approver1은 2개의 결재선(doc2, doc4)을 가지고 있어야 함
        assertThat(linesForApprover1).hasSize(2);
        log.info("approver1이 결재할 결재선 {}개 조회됨", linesForApprover1.size());

        // --- 2. 실행 (Act) ---
        // 이 결재선 목록(linesForApprover1)에 포함된 문서들을 조회
        List<Document> results = documentRepository.findByApprovalLinesIn(linesForApprover1);

        // --- 3. 검증 (Assert) ---
        log.info("결재선 목록으로 조회된 문서 개수: {}", results.size());
        
        // (검증 1) 조회된 문서는 2개여야 한다. (doc2, doc4)
        assertThat(results).hasSize(2);

        // (검증 2) (핵심!) 조회된 문서가 doc2와 doc4가 맞는지 확인
        // (findBy...In 쿼리는 순서를 보장하지 않으므로, Set으로 변환하여 내용만 비교)
        Set<Integer> resultDocIds = results.stream()
                                           .map(Document::getId)
                                           .collect(Collectors.toSet());
                                           
        assertThat(resultDocIds).containsExactlyInAnyOrder(
            doc2_inprogress.getId(), 
            doc4_noise.getId()
        );
    }
}