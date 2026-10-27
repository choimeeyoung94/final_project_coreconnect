package com.goodee.coreconnect.attendance.entity;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

import com.goodee.coreconnect.attendance.enums.AttendanceStatus;
import com.goodee.coreconnect.dashboard.entity.Dashboard;
import com.goodee.coreconnect.user.entity.User;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED) 
@Table(
    name = "attendance",
    // 같은 사용자의 같은 날 출근 기록은 1건만 허용 (동시 요청이 와도 DB가 중복 저장을 막음)
    uniqueConstraints = @UniqueConstraint(
        name = "uk_attendance_user_work_date",
        columnNames = {"user_id", "att_work_date"}
    )
)
public class Attendance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "att_id")
    private Integer attId;

    @Column(name = "att_check_in", nullable = false)
    private LocalDateTime checkIn;

    @Column(name = "att_check_out")
    private LocalDateTime checkOut;

    @Enumerated(EnumType.STRING)
    @Column(name = "att_status", length = 20, nullable = false)
    private AttendanceStatus status; // PRESENT, LATE, ABSENT, LEAVE_EARLY

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dash_id")
    private Dashboard dashboard;
    
    @Column(name = "att_work_date", nullable = false)
    private LocalDate workDate;
    
    @Column(name = "att_created_at")
    private LocalDateTime createdAt;
    
    @Column(name = "att_updated_at")
    private LocalDateTime updatedAt;


    // 정적 팩토리 메서드
    public static Attendance createAttendance(User user, 
                                              AttendanceStatus status, 
                                              Dashboard dashboard,
                                              LocalDateTime checkInTime) {
        Attendance attendance = new Attendance();
        attendance.user = user;
        attendance.status = status;
        attendance.dashboard = dashboard;
        attendance.checkIn = LocalDateTime.now(); 
        return attendance;
    }

    // 도메인 행위 (업무 로직)

    /** 퇴근 처리 */
    public void checkOut(LocalTime endTime) {
        this.checkOut = LocalDateTime.now();
        LocalTime nowTime = this.checkOut.toLocalTime();
        if(nowTime.isBefore(endTime)) {
          this.status = AttendanceStatus.LEAVE_EARLY;
        } else {
          this.status = AttendanceStatus.COMPLETED;
        }

    }

    /** 상태 강제 변경 (예: 결근, 조퇴 등) */
    public void updateStatus(AttendanceStatus newStatus) {
        this.status = newStatus;
    }
    
    /** 근무일 설정 */
    public void setWorkDate(LocalDate workDate) {
      this.workDate = workDate;
    }
    /** 작성일 설정 */
    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
    /** 수정일 설정 */
    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
  }
}
