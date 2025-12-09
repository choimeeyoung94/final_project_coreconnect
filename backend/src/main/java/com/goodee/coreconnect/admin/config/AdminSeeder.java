package com.goodee.coreconnect.admin.config;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import com.goodee.coreconnect.department.entity.Department;
import com.goodee.coreconnect.department.repository.DepartmentRepository;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.enums.JobGrade;
import com.goodee.coreconnect.user.enums.Role;
import com.goodee.coreconnect.user.repository.UserRepository;
import com.goodee.coreconnect.user.service.EmployeeNumberService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * AdminSeeder
 * - 애플리케이션 최초 실행 시 시스템 관리자 계정을 자동으로 생성하는 설정 클래스.
 * - DB에 관리자가 없을 경우, 기본 관리자 유저를 1회 생성한다. 
 */
@Configuration
@RequiredArgsConstructor
@Slf4j
public class AdminSeeder {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final DepartmentRepository departmentRepository;
    private final EmployeeNumberService employeeNumberService; 

    private static final String ADMIN_EMAIL = "admin@coreconnect.io.kr";
    private static final String ADMIN_NAME  = "관리자";
    private static final String ADMIN_PHONE = "010-0000-0000";
    private static final String ADMIN_RAW_PASSWORD = "1"; 
    private static final String ADMIN_DEPT_NAME = "코어커넥트 1.0"; 

    /** Spring Boot 시작 시 자동 실행되는 CommandLineRunner Bean. */
    @Bean
    CommandLineRunner seedAdminRunner() {
      return args -> seedAdminIfNeeded();
    }

    /** 관리자 계정이 존재하지 않는 경우만 실행 */
    @Transactional
    protected void seedAdminIfNeeded() {
        if (userRepository.existsByEmail(ADMIN_EMAIL)) {
            return; 
        }

        Department dept = null;
        if (ADMIN_DEPT_NAME != null) {
            dept = departmentRepository.findByDeptName(ADMIN_DEPT_NAME)
                    .orElse(null);
        }
        
        // 비밀번호 암호화
        String encoded = passwordEncoder.encode(ADMIN_RAW_PASSWORD);

        // 사번 자동 생성 (연도 4자리 + 자동 증가 3자리)
        String employeeNumber = employeeNumberService.generateEmployeeNumber();

        User admin = User.createUser(
                encoded,               
                ADMIN_NAME,             
                Role.ADMIN,             
                ADMIN_EMAIL,           
                ADMIN_PHONE,           
                dept,                   
                JobGrade.PRESIDENT,
                employeeNumber
        );

        userRepository.save(admin);
    }
}