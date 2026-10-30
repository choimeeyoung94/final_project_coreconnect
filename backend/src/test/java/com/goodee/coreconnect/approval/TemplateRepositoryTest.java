package com.goodee.coreconnect.approval;

import com.goodee.coreconnect.support.AbstractIntegrationTest;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import com.goodee.coreconnect.approval.entity.Template;
import com.goodee.coreconnect.approval.repository.TemplateRepository;
import com.goodee.coreconnect.department.entity.Department;
import com.goodee.coreconnect.department.repository.DepartmentRepository;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.enums.Role;
import com.goodee.coreconnect.user.repository.UserRepository;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Transactional
public class TemplateRepositoryTest extends AbstractIntegrationTest {

    @Autowired
    private TemplateRepository templateRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    // 테스트 데이터
    private User creator;
    private Template templateA_active;
    private Template templateB_inactive;
    private Template templateC_active;

    @BeforeEach
    void setUp() throws InterruptedException {

        // --- 1. 의존성 데이터 생성 (부서, 유저) ---
        Department testDept = departmentRepository.save(Department.createDepartment("테스트부", 1));
        creator = userRepository.save(User.createUser("pw123", "양식작성자", Role.USER, "creator@example.com", "010-9999-9999", testDept, null, null));
        userRepository.flush();

        // --- 2. 템플릿 데이터 생성 시나리오 ---
        // (시나리오)
        // 1. "C-양식" (활성)
        // 2. "A-양식" (활성)
        // 3. "B-양식" (비활성)
        // -> 조회 결과는 [A-양식, C-양식] 순서여야 함

        templateC_active = Template.createTemplate("C-양식", "내용C", "C-양식", creator);
        templateRepository.save(templateC_active);
        
        Thread.sleep(10); // 생성 순서 보장

        templateA_active = Template.createTemplate("A-양식", "내용A", "A-양식", creator);
        templateRepository.save(templateA_active);

        Thread.sleep(10);

        templateB_inactive = Template.createTemplate("B-양식", "내용B", "B-양식", creator);
        templateRepository.save(templateB_inactive);
        
        // (가정) Template 엔티티에 activeYn을 false로 바꾸는 메서드가 있다고 가정
        // 만약 없다면, setActiveYn(false) 같은 세터를 사용해야 합니다.
        templateB_inactive.deactivate(); // 'B-양식'을 비활성화
        templateRepository.save(templateB_inactive); // 변경 사항 저장

        templateRepository.flush();
        log.info("테스트 데이터 설정 완료");
    }

    @Test
    @DisplayName("활성화된 템플릿 조회 - 이름 오름차순 정렬")
    void findByActiveYnTrueOrderByTemplateNameAsc() {

        // --- 1. 실행 (Act) ---
        List<Template> results = templateRepository.findByActiveYnTrueOrderByTemplateNameAsc();

        // --- 2. 검증 (Assert) ---
        log.info("조회된 활성 템플릿 개수: {}", results.size());
        results.forEach(t -> log.info("템플릿명: {}, 활성상태: {}", t.getTemplateName(), t.isActiveYn()));

        // (검증 1) 활성화된 템플릿은 2개여야 한다. (A, C)
        assertThat(results).hasSize(2);

        // (검증 2) 조회된 모든 템플릿은 activeYn이 true여야 한다.
        assertThat(results).allMatch(template -> template.isActiveYn() == true);
        // (allMatch의 다른 표현)
        // assertThat(results).extracting(Template::getActiveYn).containsOnly(true);

        // (검증 3) (핵심!) 템플릿 이름(templateName) 기준 오름차순(A -> C)이어야 한다.
        assertThat(results).extracting(Template::getTemplateName)
            .containsExactly("A-양식", "C-양식");
        
        // (참고: ID로도 순서 검증 가능)
        assertThat(results).extracting(Template::getId)
            .containsExactly(templateA_active.getId(), templateC_active.getId());
    }
}