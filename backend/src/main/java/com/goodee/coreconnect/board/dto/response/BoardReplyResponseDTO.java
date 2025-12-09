package com.goodee.coreconnect.board.dto.response;

import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.goodee.coreconnect.board.entity.BoardReply;
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
 * 댓글/대댓글 응답 DTO
 */
public class BoardReplyResponseDTO {

    private Integer id;
    private String content;
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss", timezone = "Asia/Seoul")
    private LocalDateTime createdAt;
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss", timezone = "Asia/Seoul")
    private LocalDateTime updatedAt;
    private Boolean deletedYn;       
    private String writerName; 
    private String writerEmail; 
    private Integer parentReplyId;    // 부모 댓글 ID (대댓글일 경우)
    private String writerJobGrade;
    private String writerProfileImageUrl;

    /**
     * Entity -> DTO 변환
     */
    public static BoardReplyResponseDTO toDTO(BoardReply reply) {
        if (reply == null) return null;
        
        // S3 URL 생성을 위한 값
        String defaultProfile = "/default-profile.png";
        String profileImageUrl = defaultProfile;
        
        if (reply.getUser() != null && reply.getUser().getProfileImageKey() != null) { 
            // OrganizationTreeDTO 와 동일한 URL 생성 방식
            profileImageUrl = String.format("https://%s.s3.%s.amazonaws.com/%s",
                                            OrganizationTreeDTO.BUCKET,    
                                            OrganizationTreeDTO.REGION, 
                                            reply.getUser().getProfileImageKey());
        }

        return BoardReplyResponseDTO.builder().id(reply.getId())
                                               .content(reply.getContent())
                                               .createdAt(reply.getCreatedAt())
                                               .updatedAt(reply.getUpdatedAt())
                                               .deletedYn(reply.getDeletedYn())
                                               .writerName(reply.getUser() != null ? reply.getUser().getName() : null)
                                               .writerEmail(reply.getUser() != null ? reply.getUser().getEmail() : null)
                                               .parentReplyId(reply.getParentReply() != null ? reply.getParentReply().getId() : null)
                                               .writerJobGrade(reply.getUser().getJobGrade() != null ? reply.getUser()
                                                                                                            .getJobGrade()
                                                                                                            .name() : null)
                                               .writerProfileImageUrl(profileImageUrl)
                                               .build();
    }
}
