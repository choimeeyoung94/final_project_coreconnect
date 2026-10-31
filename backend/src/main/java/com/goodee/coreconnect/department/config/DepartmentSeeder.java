package com.goodee.coreconnect.department.config;

import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;

import com.goodee.coreconnect.department.service.DepartmentService;

/**
 * 애플리케이션 시작 시 기본 부서 데이터를 초기화하는 설정 클래스.
 * 부서 테이블이 비어 있을 경우, 기본 조직 구조를 자동으로 생성한다. 
 */
@Configuration
public class DepartmentSeeder {
  
  @Bean
  @Order(1) // 관리자 시드가 부서를 찾을 수 있도록 먼저 실행
  public CommandLineRunner initDepartments(DepartmentService departmentService) {
    return args -> {
      // 부서가 비어 있을 때만 실행
      if(departmentService.getDepartmentTree().isEmpty()) {
        // 최상위: 회사 또는 대표이사실
        Integer root = departmentService.create("코어커넥트 1.0", 10, null);
        
        // 대표: 대표이사 자리 역할
        Integer ceoOffice = departmentService.create("대표이사실", 20, root);
        
        // 1차 하위 부서들
        // create(부서이름, orderNo(같은 상위 부서 안에서의 정렬 순서), 상위부서)
        Integer mgmt = departmentService.create("경영", 10, ceoOffice);
        Integer collab = departmentService.create("협업팀", 20, ceoOffice); 
        Integer dev = departmentService.create("개발", 30, ceoOffice);
        Integer design = departmentService.create("디자인", 40, ceoOffice);
        Integer security = departmentService.create("전산/보안", 50, ceoOffice);
      }
    };
  }
}
