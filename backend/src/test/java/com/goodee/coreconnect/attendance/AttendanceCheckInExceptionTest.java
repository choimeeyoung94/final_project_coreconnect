package com.goodee.coreconnect.attendance;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;

import java.sql.SQLIntegrityConstraintViolationException;
import java.time.LocalDate;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import com.goodee.coreconnect.attendance.repository.AttendanceRepository;
import com.goodee.coreconnect.attendance.service.AttendanceServiceImpl;
import com.goodee.coreconnect.leave.repository.LeaveRequestRepository;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.enums.Role;
import com.goodee.coreconnect.user.repository.UserRepository;

/**
 * checkIn()의 제약 위반 예외 변환 단위 테스트 (DB 없이 Mockito로 저장 실패 상황을 흉내 냄)
 *
 * 출근 중복 제약 위반만 "이미 출근" 안내로 바꾸고, 다른 제약 위반은 그대로 던지는지 확인
 */
@ExtendWith(MockitoExtension.class)
class AttendanceCheckInExceptionTest {

  private static final String EMAIL = "user@test.com";

  @Mock
  private AttendanceRepository attendanceRepository;

  @Mock
  private UserRepository userRepository;

  @Mock
  private LeaveRequestRepository leaveRequestRepository;

  @InjectMocks
  private AttendanceServiceImpl attendanceService;

  @BeforeEach
  void setUp() {
    // 사전 조회는 통과(오늘 기록 없음)하고, 사용자는 존재하는 상황
    given(attendanceRepository.findByUser_EmailAndWorkDate(EMAIL, LocalDate.now())).willReturn(Optional.empty());
    given(userRepository.findByEmail(EMAIL))
        .willReturn(Optional.of(User.createUser("pw", "테스터", Role.USER, EMAIL, null, null, null, null)));
  }

  @Test
  @DisplayName("출근 중복 유니크 제약 위반은 '이미 오늘 출근 기록이 있습니다' 예외로 바뀐다")
  void duplicateConstraint_isTranslated() {
    DataIntegrityViolationException duplicate = violation(
        "Duplicate entry '1-2026-10-27' for key 'attendance.uk_attendance_user_work_date'");
    given(attendanceRepository.saveAndFlush(any())).willThrow(duplicate);

    assertThatThrownBy(() -> attendanceService.checkIn(EMAIL))
        .isInstanceOf(IllegalStateException.class)
        .hasMessage("이미 오늘 출근 기록이 있습니다.")
        .hasCause(duplicate);
  }

  @Test
  @DisplayName("다른 제약 위반은 출근 중복으로 바꾸지 않고 그대로 던진다")
  void otherConstraint_isRethrown() {
    DataIntegrityViolationException other = violation(
        "Cannot add or update a child row: a foreign key constraint fails");
    given(attendanceRepository.saveAndFlush(any())).willThrow(other);

    assertThatThrownBy(() -> attendanceService.checkIn(EMAIL))
        .isSameAs(other);
  }

  /** MySQL이 던지는 것과 같은 모양(원인 예외에 DB 메시지)의 제약 위반 예외를 만듦 */
  private DataIntegrityViolationException violation(String mysqlMessage) {
    return new DataIntegrityViolationException("could not execute statement",
        new SQLIntegrityConstraintViolationException(mysqlMessage));
  }
}
