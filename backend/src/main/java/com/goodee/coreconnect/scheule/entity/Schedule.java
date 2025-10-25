package com.goodee.coreconnect.scheule.entity;

import java.time.LocalDateTime;

import com.goodee.coreconnect.scheule.enums.ScheduleVisibility;
import com.goodee.coreconnect.user.entity.User;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "schedule")
@Getter
@Setter
public class Schedule {
  
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  @Column(name = "sch_id")
  private Long id;

  @Column(name = "sch_title", length = 100, nullable = false)
  private String title;

  @Column(name = "sch_content", columnDefinition = "TEXT")
  private String content;

  @Column(name = "sch_start_datetime")
  private LocalDateTime startDateTime;

  @Column(name = "sch_end_datetime")
  private LocalDateTime endDateTime;

  @Column(name = "sch_location", length = 100)
  private String location;

  @Enumerated(EnumType.STRING)
  @Column(name = "sch_visibility", length = 20)
  private ScheduleVisibility visibility; // PUBLIC / PRIVATE

  @Column(name = "sch_deleted_yn")
  private Boolean deletedYn;

  @Column(name = "sch_created_at")
  private LocalDateTime createdAt;

  @Column(name = "sch_updated_at")
  private LocalDateTime updatedAt;

  // N:1 (user 테이블과 매핑)
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "user_id")
  private User user;
 
  
  protected Schedule() {};
  
  public static Schedule createSchedule(User user,
                                          String title,
                                          String content,
                                          LocalDateTime start,
                                          LocalDateTime end,
                                          String location,
                                          ScheduleVisibility visibility) {
  Schedule schedule = new Schedule();
  schedule.user = user;
  schedule.title = title;
  schedule.content = content;
  schedule.startDateTime = start;
  schedule.endDateTime = end;
  schedule.location = location;
  schedule.visibility = visibility;
  schedule.deletedYn = false;
  schedule.createdAt = LocalDateTime.now();
  return schedule;
  }
  
}
