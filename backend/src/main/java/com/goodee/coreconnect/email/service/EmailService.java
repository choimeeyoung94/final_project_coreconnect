package com.goodee.coreconnect.email.service;

import java.io.IOException;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.web.multipart.MultipartFile;

import com.goodee.coreconnect.email.dto.request.DeleteMailsRequest;
import com.goodee.coreconnect.email.dto.request.EmailSendRequestDTO;
import com.goodee.coreconnect.email.dto.response.DeleteMailsResponse;
import com.goodee.coreconnect.email.dto.response.EmailResponseDTO;
import com.goodee.coreconnect.email.entity.Email;

public interface EmailService {

	/**
     * 이메일을 전송(발송)합니다.
     * @param requestDTO 이메일 전송 요청 DTO (제목/내용/수신자/참조/숨은참조/첨부/답신정보 등)
     * @return EmailResponseDTO 발송된 이메일 상세정보/상태/결과
     */
	EmailResponseDTO sendEmail(EmailSendRequestDTO requestDTO, List<MultipartFile> attachments) throws IOException; 
	
	/**
     * 특정 이메일의 상세 정보를 조회합니다.
     * @param emailId 이메일 고유 ID
     * @return EmailResponseDTO 해당 이메일의 상세 정보 (제목/내용/첨부/참조자/답신 등)
     */
	EmailResponseDTO getEmailDetail(Integer emailId, String viewerEmail);
	
	
	/**
     * 발신함(보낸메일함) 리스트를 페이징으로 조회합니다.
     * @param userId 사용자 고유 ID (로그인된 사용자)
     * @param page 페이징 페이지 번호
     * @param size 한 페이지당 아이템 수
     * @return Page<EmailResponseDTO> 페이징된 EmailResponseDTO 리스트
     */
	Page<EmailResponseDTO> getInbox(String userEmail, int page, int size,  String filter, String searchType, String keyword);
	
	/**
     * 발신함(보낸메일함) 리스트를 페이징으로 조회합니다.
     * @param userId 사용자 고유 ID (로그인된 사용자)
     * @param page 페이징 페이지 번호
     * @param size 한 페이지당 아이템 수
     * @return Page<EmailResponseDTO> 페이징된 EmailResponseDTO 리스트
     */
	Page<EmailResponseDTO> getSentbox(String userEmail, int page, int size, String searchType, String keyword);
	
	 /**
     * 반송함(실패/반송된 메일함) 리스트를 페이징으로 조회합니다.
     * @param userId 사용자 고유 ID
     * @param page 페이징 페이지 번호
     * @param size 한 페이지당 아이템 수
     * @return Page<EmailResponseDTO> 페이징된 EmailResponseDTO 리스트
     */
	Page<EmailResponseDTO> getBounceBox(Integer userId, int page, int size);

	// [NEW] 개별 메일 읽음 처리 (상세조회 외에도 별도 PATCH 호출 대응)
		boolean markMailAsRead(Integer emailId, String userEmail);

	// [NEW] 개별 메일 중요 표시 토글
		boolean toggleFavoriteStatus(Integer emailId, String userEmail);

		 // ------------- [Draft(임시저장)] 기능용 추가 메서드 -------------

	    /**
	     * 임시저장(임시보관함) 메일 저장 (등록 및 수정)
	     * @param requestDTO 임시저장할 메일 데이터 DTO
	     * @param attachments 첨부파일 리스트
	     * @return EmailResponseDTO 저장된 임시메일 정보
	     */
	    EmailResponseDTO saveDraft(EmailSendRequestDTO requestDTO, List<MultipartFile> attachments) throws IOException;

	    /**
	     * 임시보관함(임시저장 메일함) 목록 페이징 조회
	     * @param userEmail 발신자(본인)
	     * @param page page 번호
	     * @param size 페이지 크기
	     * @return Page<EmailResponseDTO>
	     */
	    Page<EmailResponseDTO> getDraftbox(String userEmail, int page, int size);

	    /**
	     * 임시보관함 개수 조회 (캐싱/RDB/레디스 등 활용)
	     * @param userEmail 발신자(본인)
	     * @return long 임시저장메일 개수
	     */
	    long getDraftCount(String userEmail);

	    /**
	     * 임시저장 메일 상세 조회
	     * @param draftId 임시메일 id
	     * @param userEmail 소유자 이메일
	     * @return EmailResponseDTO
	     */
	    EmailResponseDTO getDraftDetail(Integer draftId, String userEmail);

	    /**
	     * 임시저장 메일 삭제
	     * @param draftId 메일id
	     * @return boolean 삭제성공/실패
	     */
	    boolean deleteDraft(Integer draftId);	
		

	    /**
	     * 임시저장 메일 상세 조회 (for MailWritePage)
	     * @param draftId 임시메일 id
	     * @param userEmail 소유자 이메일
	     * @return EmailResponseDTO
	     */
	    EmailResponseDTO getDraftMailDetail(Integer draftId, String userEmail);
		
	    /**
	     * 임시저장 메일 삭제 
	     * */
	    void deleteDraftMail(Integer draftId);
	    

	    /**
	     * 예약메일 실제 발송(예약 스케줄러 등에서 호출)
	     * @param reservedEmail 예약된 Email 엔티티(RESERVED 상태)
	     * @param attachments   (일반적으로 예약 저장 시 이미 등록되므로 null 가능)
	     */
	    void sendActualMail(Email reservedEmail, List<MultipartFile> attachments);
	    
	    /**
	     * 선택된 이메일들을 휴지통(TRASH) 상태로 변경한다.
	     * 요청한 사용자가 해당 이메일의 발신자이거나 수신자(EmailRecipient)에 포함되어 있는지 최소한 검증 후 변경.
	     * @param emailIds emailId 리스트
	     * @param userEmail 요청자 이메일
	     */
	    void moveEmailsToTrash(List<Integer> emailIds, String userEmail);
	    
	    /**
	     * 휴지통에서 선택된 이메일들을 복원한다.
	     * 발신자인 경우 emailStatus를 원래 상태로 복원하고, 수신자인 경우 EmailRecipient.deleted를 false로 설정한다.
	     * @param emailIds emailId 리스트
	     * @param userEmail 요청자 이메일
	     */
	    void restoreEmailsFromTrash(List<Integer> emailIds, String userEmail);
	    
	    /**
	     * 받은메일함에서 선택된 이메일들을 삭제 처리한다.
	     * EmailRecipient의 deleted 플래그를 true로 설정하여 받은메일함에서 조회되지 않게 함.
	     * @param emailIds emailId 리스트
	     * @param userEmail 요청자 이메일
	     */
	    void deleteInboxMails(List<Integer> emailIds, String userEmail);

	    /**
	     * 요청자(userEmail)의 휴지통(TRASH) 상태인 모든 메일을 삭제 상태(DELETED)로 변경(휴지통 비우기)
	     * - 발신자이거나 수신자(EmailRecipient)에 포함된 이메일만 대상으로 함
	     */
	    void emptyTrash(String userEmail);
	    
	    /**
	     * 현재 인증된 사용자 기준으로 전달된 mailIds를 '휴지통(삭제)' 처리
	     *
	     * @param req DeleteMailsRequest (mailIds)
	     * @return DeleteMailsResponse 삭제 처리된 mailIds 목록
	     */
	    DeleteMailsResponse deleteMailsForCurrentUser(DeleteMailsRequest req);
	    
	    Page<EmailResponseDTO> getTrashMails(String userEmail, int page, int size);
	    
	    Page<EmailResponseDTO> getScheduledMails(String userEmail, int page, int size);
	    
	    /**
	     * 중요 메일 목록 조회 (발신/수신 모두 포함)
	     * @param userEmail 사용자 이메일
	     * @param page 페이지 번호
	     * @param size 페이지 크기
	     * @param searchType 검색 타입 (TITLE/CONTENT/TITLE_CONTENT)
	     * @param keyword 검색 키워드
	     * @return Page<EmailResponseDTO> 중요 메일 목록
	     */
	    Page<EmailResponseDTO> getFavoriteMails(String userEmail, int page, int size, String searchType, String keyword);
	    
	    EmailResponseDTO sendEmailViaSendGrid(EmailSendRequestDTO requestDTO, List<MultipartFile> attachments) throws IOException;
}
