package com.goodee.coreconnect.admin.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.lang.reflect.Method;
import java.util.Optional;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.AnnotationUtils;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.goodee.coreconnect.department.config.DepartmentSeeder;
import com.goodee.coreconnect.department.entity.Department;
import com.goodee.coreconnect.department.repository.DepartmentRepository;
import com.goodee.coreconnect.department.service.DepartmentService;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.repository.UserRepository;
import com.goodee.coreconnect.user.service.EmployeeNumberService;

/** 시드 실행 순서와 관리자 부서 지정 테스트 */
class AdminSeederTest {

  private static final String ROOT_DEPT = "코어커넥트 1.0";

  private final UserRepository userRepository = mock(UserRepository.class);
  private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
  private final DepartmentRepository departmentRepository = mock(DepartmentRepository.class);
  private final EmployeeNumberService employeeNumberService = mock(EmployeeNumberService.class);
  private final AdminSeeder seeder =
      new AdminSeeder(userRepository, passwordEncoder, departmentRepository, employeeNumberService);

  @Test
  @DisplayName("부서 시드는 관리자 시드보다 먼저 실행되도록 순서가 정해져 있다")
  void seedOrder_departmentBeforeAdmin() throws Exception {
    Method department = DepartmentSeeder.class.getMethod("initDepartments", DepartmentService.class);
    Method admin = AdminSeeder.class.getDeclaredMethod("seedAdminRunner");

    Order departmentOrder = AnnotationUtils.findAnnotation(department, Order.class);
    Order adminOrder = AnnotationUtils.findAnnotation(admin, Order.class);

    assertThat(departmentOrder).isNotNull();
    assertThat(adminOrder).isNotNull();
    assertThat(departmentOrder.value()).isLessThan(adminOrder.value());
    assertThat(CommandLineRunner.class).isAssignableFrom(admin.getReturnType());
  }

  @Test
  @DisplayName("최상위 부서를 찾지 못하면 만들어서 관리자를 소속시킨다")
  void seed_rootDepartmentMissing_createsAndAssigns() {
    given(userRepository.existsByEmail(anyString())).willReturn(false);
    given(departmentRepository.findByDeptName(ROOT_DEPT)).willReturn(Optional.empty());
    given(departmentRepository.save(any(Department.class))).willAnswer(call -> call.getArgument(0));

    seeder.seedAdminIfNeeded();

    assertThat(savedAdmin().getDepartment().getDeptName()).isEqualTo(ROOT_DEPT);
  }

  @Test
  @DisplayName("최상위 부서가 있으면 새로 만들지 않고 그 부서에 소속시킨다")
  void seed_rootDepartmentExists_usesIt() {
    Department root = Department.createDepartment(ROOT_DEPT, 10);
    given(userRepository.existsByEmail(anyString())).willReturn(false);
    given(departmentRepository.findByDeptName(ROOT_DEPT)).willReturn(Optional.of(root));

    seeder.seedAdminIfNeeded();

    assertThat(savedAdmin().getDepartment()).isSameAs(root);
    verify(departmentRepository, never()).save(any(Department.class));
  }

  private User savedAdmin() {
    ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
    verify(userRepository).save(saved.capture());
    return saved.getValue();
  }
}
