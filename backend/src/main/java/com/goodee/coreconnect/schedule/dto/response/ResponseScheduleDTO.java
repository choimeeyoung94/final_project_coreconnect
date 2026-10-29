package com.goodee.coreconnect.schedule.dto.response;

import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.goodee.coreconnect.schedule.entity.Schedule;
import com.goodee.coreconnect.schedule.enums.ScheduleVisibility;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.ToString;

@NoArgsConstructor
@Getter
@ToString
public class ResponseScheduleDTO {
  
  private Integer id;
  
  private String title;
  
  private String content;
  
  private String location;

  @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd HH:mm:ss")
  private LocalDateTime startDateTime;
  
  @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd HH:mm:ss")
  private LocalDateTime endDateTime;
  
  private ScheduleVisibility visibility;
  
  private Integer userId;
  
  private String userEmail;
  
  private String userName;
  
  private Integer categoryId;
  
  private String categoryName;
  
  private Integer meetingRoomId;

  private String meetingRoomName;
  
  @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd HH:mm:ss")
  private LocalDateTime createdAt;
  
  /** Entity → DTO 변환 */
  public static ResponseScheduleDTO toDTO(Schedule entity) {
    ResponseScheduleDTO dto = new ResponseScheduleDTO();
    dto.id = entity.getId();
    dto.title = entity.getTitle();
    dto.content = entity.getContent();
    dto.location = entity.getLocation();
    dto.startDateTime = entity.getStartDateTime();
    dto.endDateTime = entity.getEndDateTime();
    dto.visibility = entity.getVisibility();
    dto.userId = entity.getUser().getId();
    dto.userEmail = entity.getUser().getEmail();
    dto.createdAt = entity.getCreatedAt();

    if (entity.getUser() != null) {
      dto.userId = entity.getUser().getId();
      dto.userEmail = entity.getUser().getEmail();
      dto.userName = entity.getUser().getName();
    }
    
    if (entity.getCategory() != null) {
      dto.categoryId = entity.getCategory().getId();
      dto.categoryName = entity.getCategory().getName();
    }
    
    if (entity.getMeetingRoom() != null) {
      dto.meetingRoomId = entity.getMeetingRoom().getId();
      dto.meetingRoomName = entity.getMeetingRoom().getName();
    }

    return dto;
  }

  /** 남의 비공개 일정을 볼 때 제목 대신 보여 줄 문구 */
  public static final String PRIVATE_TITLE = "비공개 약속";

  /**
   * 보는 사람(viewerId)에 따라 변환
   * - PUBLIC 일정, 작성자, (삭제되지 않은) 참여자 → 전부 보여 줌
   * - 그 외(관리자 포함) → 제목은 "비공개 약속", 시작·끝 시간과 작성자·회의실만 남기고 내용·장소·카테고리는 비움
   */
  public static ResponseScheduleDTO toDTOFor(Schedule entity, Integer viewerId) {
    ResponseScheduleDTO dto = toDTO(entity);
    if (entity.getVisibility() != ScheduleVisibility.PRIVATE || canSeeDetail(entity, viewerId)) {
      return dto;
    }
    dto.title = PRIVATE_TITLE;
    dto.content = null;
    dto.location = null;
    dto.categoryId = null;
    dto.categoryName = null;
    return dto;
  }

  private static boolean canSeeDetail(Schedule entity, Integer viewerId) {
    if (viewerId == null) {
      return false;
    }
    if (entity.getUser() != null && viewerId.equals(entity.getUser().getId())) {
      return true;
    }
    return entity.getParticipants().stream()
        .anyMatch(p -> !Boolean.TRUE.equals(p.getDeletedYn()) && p.getUser() != null && viewerId.equals(p.getUser().getId()));
  }

}
