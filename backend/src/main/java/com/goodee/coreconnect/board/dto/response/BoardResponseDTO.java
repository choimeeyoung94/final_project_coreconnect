package com.goodee.coreconnect.board.dto.response;

import java.time.LocalDateTime;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.goodee.coreconnect.board.entity.Board;
import com.goodee.coreconnect.department.dto.response.OrganizationTreeDTO;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
/**
 * 게시글 응답 DTO
 */
public class BoardResponseDTO {

    private Integer id;                
    private String title;              
    private String content;            
    private Boolean noticeYn;        
    private Boolean pinned;
    private Boolean privateYn;         
    private Integer viewCount;
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss", timezone = "Asia/Seoul")
    private LocalDateTime createdAt;
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss", timezone = "Asia/Seoul")
    private LocalDateTime updatedAt;
    private Boolean deletedYn;
    private String writerName;
    private String writerEmail;
    private String categoryName;       
    private Integer replyCount;
    private Boolean hasImage;
    private Integer fileCount;
    private Integer categoryId;
    private String writerJobGrade;
    private String writerProfileImageUrl;

    private List<BoardFileResponseDTO> files;    
    private List<BoardReplyResponseDTO> replies; 


    /**
     * Entity -> DTO 변환
     */
    public static BoardResponseDTO toDTO(Board board) {
        if (board == null) return null;
        
        // S3 URL 생성을 위한 값
        String defaultProfile = "/default-profile.png";
        String profileImageUrl = defaultProfile;
        
        if (board.getUser() != null && board.getUser().getProfileImageKey() != null) { 
            // OrganizationTreeDTO 와 동일한 URL 생성 방식
            profileImageUrl = String.format("https://%s.s3.%s.amazonaws.com/%s",
                                            OrganizationTreeDTO.BUCKET,                                           
                                            OrganizationTreeDTO.REGION,                                           
                                            board.getUser().getProfileImageKey());
        }

        return BoardResponseDTO.builder().id(board.getId())
                                          .title(board.getTitle())
                                          .content(board.getContent())
                                          .noticeYn(board.getNoticeYn())
                                          .pinned(board.getPinned())
                                          .privateYn(board.getPrivateYn())
                                          .viewCount(board.getViewCount())
                                          .createdAt(board.getCreatedAt())
                                          .updatedAt(board.getUpdatedAt())
                                          .deletedYn(board.getDeletedYn())
                                          .writerName(board.getUser() != null ? board.getUser().getName() : null)
                                          .writerEmail(board.getUser() != null ? board.getUser().getEmail() : null)
                                          .categoryName(board.getCategory() != null ? board.getCategory().getName() : null)
                                          .files(List.of())
                                          .hasImage(false)
                                          .replies(board.getReplies().stream()
                                                                     .map(reply -> BoardReplyResponseDTO.toDTO(reply))
                                                                     .toList())
                                          .replyCount((int) board.getReplies().stream() 
                                                                  .filter(r -> !Boolean.TRUE.equals(r.getDeletedYn()))
                                                                  .count())
                                          .fileCount((int) board.getFiles().stream()
                                                                 .filter(f -> !Boolean.TRUE.equals(f.getDeletedYn()))
                                                                 .count())
                                          .categoryId(board.getCategory() != null ? board.getCategory().getId() : null)
                                          .writerJobGrade(board.getUser().getJobGrade() != null ? board.getUser()
                                                                                                       .getJobGrade()
                                                                                                       .name() : null)
                                          .writerProfileImageUrl(profileImageUrl)
                                          .build();
    }
}