package com.goodee.coreconnect.email.service;

import com.goodee.coreconnect.email.sendGrid.SendGridEmailSender;
import java.io.IOException;
import java.nio.file.Files;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import java.util.Optional;
import java.util.List;
import java.util.ArrayList;
import java.util.Map;
import java.util.HashMap;
import java.util.Comparator;
import java.util.stream.Collectors;
import com.sendgrid.*;
import java.util.stream.Collectors;
import java.time.LocalDateTime;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import com.goodee.coreconnect.common.notification.enums.NotificationType;
import com.goodee.coreconnect.common.notification.service.NotificationService;
import com.goodee.coreconnect.common.service.S3Service;
import com.goodee.coreconnect.email.dto.request.DeleteMailsRequest;
import com.goodee.coreconnect.email.dto.request.EmailAttachmentRequestDTO;
import com.goodee.coreconnect.email.dto.request.EmailSendRequestDTO;
import com.goodee.coreconnect.email.dto.response.DeleteMailsResponse;
import com.goodee.coreconnect.email.dto.response.EmailResponseDTO;
import com.goodee.coreconnect.email.dto.response.EmailResponseDTO.AttachmentDTO;
import com.goodee.coreconnect.email.entity.Email;
import com.goodee.coreconnect.email.entity.EmailFile;
import com.goodee.coreconnect.email.entity.EmailRecipient;
import com.goodee.coreconnect.email.entity.MailUserVisibility;
import com.goodee.coreconnect.email.enums.EmailStatusEnum;
import com.goodee.coreconnect.email.repository.EmailFileRepository;
import com.goodee.coreconnect.email.repository.EmailRecipientRepository;
import com.goodee.coreconnect.email.repository.EmailRepository;
import com.goodee.coreconnect.email.repository.MailRepository;
import com.goodee.coreconnect.email.repository.MailUserVisibilityRepository;
import com.goodee.coreconnect.security.userdetails.CustomUserDetails;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.repository.UserRepository;



import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

// SendGrid 관련 import
import com.sendgrid.*;
import com.sendgrid.helpers.mail.Mail;
import com.sendgrid.helpers.mail.objects.Personalization;
import com.sendgrid.helpers.mail.objects.Content;
import com.sendgrid.helpers.mail.objects.Attachments;
// ⭐ SendGrid의 Email import 제거 - 엔티티 Email과 충돌 방지

/**
 * 이메일 발송, 답신, 수신 등 SendGrid 연동 서비스 
 * */
@Slf4j
@Service
@RequiredArgsConstructor
public class EmailServiceImpl implements EmailService {

	@Value("${sendgrid.api.key:}")
	private String sendGridApiKey;
	
	
	private final EmailRepository emailRepository;
	private final EmailFileRepository emailFileRepository;
	private final EmailRecipientRepository emailRecipientRepository;
	private final UserRepository userRepository;
	private final S3Service s3Service;
	private final MailUserVisibilityRepository visibilityRepository;
	private final MailRepository mailRepository;
	// SendGridEmailSender bean 주입 (생성자 주입 위해 final)
	private final SendGridEmailSender sendGridEmailSender;
	private final NotificationService notificationService;
	private final MailUserVisibilityRepository mailUserVisibilityRepository; // 추가
	
	private String normalizeSearchType(String searchType) {
	    if (!StringUtils.hasText(searchType)) {
	        return "TITLE_CONTENT";
	    }
	    String upper = searchType.trim().toUpperCase();
	    if (!upper.equals("TITLE") && !upper.equals("CONTENT") && !upper.equals("TITLE_CONTENT")) {
	        return "TITLE_CONTENT";
	    }
	    return upper;
	}

	private String normalizeKeyword(String keyword) {
	    if (!StringUtils.hasText(keyword)) {
	        return null;
	    }
	    return keyword.trim();
	}

	private Long getCurrentUserId() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof CustomUserDetails) {
            return ((CustomUserDetails) principal).getId().longValue();
        }
        return null;
    }
	
	@Autowired(required = false)
	private RedisTemplate<String, Object> redisTemplate; // 레디스 빈 주입, 구성 필요
	
	@Value("${sendgrid.api.key}")
	private String senGridApiKey; 

	/**이메일 상세조회*/
	@Override
	public EmailResponseDTO getEmailDetail(Integer emailId, String viewerEmail) {
	    // 1. 이메일 엔티티 조회
	    com.goodee.coreconnect.email.entity.Email email = emailRepository.findById(emailId)
	            .orElseThrow(() -> new IllegalArgumentException("메일이 존재하지 않습니다." + emailId));
	    // 전체 수신자 목록
	    List<EmailRecipient> recipients = emailRecipientRepository.findByEmail(email);

	    // --- 읽음 처리 [빌더 패턴]
	    Optional<EmailRecipient> myRecipientOpt = recipients.stream()
	        .filter(r -> viewerEmail.equals(r.getEmailRecipientAddress()))
	        .findFirst();
	    // emailReadYn이 false이거나 null인 경우 모두 처리
	    if (myRecipientOpt.isPresent()) {
	        EmailRecipient recipient = myRecipientOpt.get();
	        Integer recipientId = recipient.getEmailRecipientId();
	        Boolean currentReadYn = recipient.getEmailReadYn();
	        // 안읽은 메일인 경우 (false 또는 null)
	        if (currentReadYn == null || Boolean.FALSE.equals(currentReadYn)) {
	            LocalDateTime now = LocalDateTime.now();
	            // 엔티티를 직접 수정하여 DB에 확실히 반영
	            recipient.setEmailReadYn(true);
	            recipient.setEmailReadAt(now);
	            emailRecipientRepository.save(recipient);
	            // 즉시 DB에 반영되도록 flush
	            emailRecipientRepository.flush();
	            log.info("getEmailDetail: EmailRecipient updated - emailId={}, viewerEmail={}, recipientId={}, emailReadYn={} -> true, emailReadAt={}", 
	                    emailId, viewerEmail, recipientId, currentReadYn, now);
	            
	            // DB에 실제로 반영되었는지 확인 (디버그 로그)
	            emailRecipientRepository.findById(recipientId).ifPresent(savedRecipient -> {
	                Boolean savedReadYn = savedRecipient.getEmailReadYn();
	                log.info("getEmailDetail: DB 확인 - recipientId={}, 실제 DB의 emailReadYn={}", 
	                        recipientId, savedReadYn);
	                if (!Boolean.TRUE.equals(savedReadYn)) {
	                    log.error("getEmailDetail: ⚠️ 경고 - DB에 emailReadYn이 true로 저장되지 않았습니다! recipientId={}, emailId={}, viewerEmail={}", 
	                            recipientId, emailId, viewerEmail);
	                }
	            });
	            
	            // Email 엔티티의 emailReadAt도 업데이트
	            email.setEmailReadAt(now);
	            emailRepository.save(email);
	            emailRepository.flush();
	            log.info("getEmailDetail: Email updated - emailId={}, emailReadAt={}", emailId, now);
	        } else {
	            log.info("getEmailDetail: Email already read - emailId={}, viewerEmail={}, emailReadYn={}", 
	                    emailId, viewerEmail, currentReadYn);
	        }
	    }

	    // 2. 관련 수신자, 첨부파일 조회 (엔티티 직접 분리)
	    List<EmailRecipient> toRecipients = recipients.stream()
	        .filter(r -> "TO".equalsIgnoreCase(r.getEmailRecipientType()))
	        .collect(Collectors.toList());
	    List<EmailRecipient> ccRecipients = recipients.stream()
	        .filter(r -> "CC".equalsIgnoreCase(r.getEmailRecipientType()))
	        .collect(Collectors.toList());
	    List<EmailRecipient> bccRecipients = recipients.stream()
	        .filter(r -> "BCC".equalsIgnoreCase(r.getEmailRecipientType()))
	        .filter(r -> r.getEmailRecipientAddress().equals(viewerEmail)) // 본인만!
	        .collect(Collectors.toList());

	    // 이메일 주소 리스트(구형 프론트 병행 호환)
	    List<String> toAddresses = toRecipients.stream()
	        .map(EmailRecipient::getEmailRecipientAddress)
	        .collect(Collectors.toList());
	    List<String> ccAddresses = ccRecipients.stream()
	        .map(EmailRecipient::getEmailRecipientAddress)
	        .collect(Collectors.toList());
	    List<String> bccAddresses = bccRecipients.stream()
	        .map(EmailRecipient::getEmailRecipientAddress)
	        .collect(Collectors.toList());

	    // 첨부파일 조회
	    List<EmailFile> files = emailFileRepository.findByEmail(email);
	    List<Integer> fileIds = files.stream()
	            .map(EmailFile::getEmailFileId)
	            .collect(Collectors.toList());

	    // 3. 엔티티를 DTO로 변환 후 반환
	    EmailResponseDTO response = new EmailResponseDTO();
	    response.setEmailId(email.getEmailId());
	    response.setEmailTitle(email.getEmailTitle());
	    response.setEmailContent(email.getEmailContent());
	    response.setSenderId(email.getSenderId());
	    response.setSenderEmail(email.getSenderEmail()); // [이 부분이 빠져 있었음! 꼭 추가]
	    response.setSentTime(email.getEmailSentTime());
	    response.setEmailStatus(email.getEmailStatus().name());
	    response.setSenderName(""); // 필요에 따라 UserRepository로 이름 조회
	    response.setSenderDept(""); // 필요에 따라 UserRepository로 부서명 조회
	    response.setRecipientAddresses(toAddresses);
	    response.setCcAddresses(ccAddresses);
	    response.setBccAddresses(bccAddresses);
	    response.setFileIds(fileIds);
	    response.setReplyToEmailId(email.getReplyToEmailId());
	    // [신규] 엔티티도 세팅
	    response.setToRecipients(toRecipients);
	    response.setCcRecipients(ccRecipients);
	    response.setBccRecipients(bccRecipients);
	    
	    // 중요 메일 표시 여부 설정 (null이면 false로 처리)
	    Boolean favoriteStatus = email.getFavoriteStatus();
	    response.setFavoriteStatus(favoriteStatus != null && favoriteStatus);

	    // 첨부파일 조회 및 세팅
	    files = emailFileRepository.findByEmail(email);
	    List<EmailResponseDTO.AttachmentDTO> attachments = files.stream()
	        .map(f -> new EmailResponseDTO.AttachmentDTO(
	            f.getEmailFileId(),
	            f.getEmailFileName(),
	            f.getEmailFileSize()
	        ))
	        .collect(Collectors.toList());
	    response.setAttachments(attachments);
	    
	    
	    
	    return response;
	}

	/**
	 * [받은 메일함 조회] 
	 * - 사용자가 TO 또는 CC로 수신한 메일 목록을 페이징해서 반환합니다.
	 * - filter 옵션으로 '전체', '오늘', '안읽은' 메일만 반환 가능
	 *   filter: null/기타 → 전체
	 *   filter: "today"   → 오늘 온 메일만
	 *   filter: "unread"  → 읽지 않은 메일만
	 *
	 * @param userEmail 조회(로그인)자 이메일 주소
	 * @param page      페이징 번호 (0부터 시작)
	 * @param size      한 페이지에 표시할 메일 개수
	 * @param filter    today/unread/전체(null) 등 조회 옵션
	 * @return Page<EmailResponseDTO>
	 */
	@Override
	public Page<EmailResponseDTO> getInbox(String userEmail, int page, int size, String filter, String searchType, String keyword) {
	    log.info("[getInbox] 호출 - userEmail: {}, page: {}, size: {}, filter: {}", userEmail, page, size, filter);
	    
	    // 페이징 객체 생성 (page: 0-base)
	    Pageable pageable = PageRequest.of(page, size);
	    // TO/CC/BCC 모두 해당(받은메일함이기 때문)
	    List<String> types = List.of("TO", "CC", "BCC");

	    Page<EmailRecipient> recipientPage; // 실제 받은메일 레코드
	    String normalizedSearchType = normalizeSearchType(searchType);
	    String normalizedKeyword = normalizeKeyword(keyword);

	    // 필터별 분기 처리
	    if ("unread".equalsIgnoreCase(filter)) {
	        // 안읽은 + 휴지통 제외
	        log.info("[getInbox] 안읽은 메일 조회");
	        recipientPage = emailRecipientRepository.findUnreadInboxExcludingTrash(userEmail, types, pageable, normalizedSearchType, normalizedKeyword);
	    } else if ("today".equalsIgnoreCase(filter)) {
	        // 오늘 받은 메일(날짜 구간 + 상태 제외)
	        LocalDate today = LocalDate.now();
	        LocalDateTime startOfDay = today.atStartOfDay();
	        LocalDateTime endOfDay = today.plusDays(1).atStartOfDay().minusNanos(1);
	        log.info("[getInbox] 오늘의 메일 조회");
	        recipientPage = emailRecipientRepository.findTodayInboxExcludingTrash(userEmail, types, startOfDay, endOfDay, pageable, normalizedSearchType, normalizedKeyword);
	    } else {
	        // 전체 메일(휴지통/삭제 제외)
	        log.info("[getInbox] 전체 메일 조회");
	        recipientPage = emailRecipientRepository.findInboxExcludingTrash(userEmail, types, pageable, normalizedSearchType, normalizedKeyword);
	    }

	    log.info("[getInbox] 조회 결과 - totalElements: {}, content size: {}", recipientPage.getTotalElements(), recipientPage.getContent().size());

	    // EmailRecipient를 직접 DTO로 변환 (각 사용자별 읽음 상태 포함)
	    List<EmailResponseDTO> dtoList = recipientPage.stream().map(recipient -> {
	        com.goodee.coreconnect.email.entity.Email email = recipient.getEmail();
	        EmailResponseDTO dto = new EmailResponseDTO();
	        
	        // Email 엔티티의 기본 필드
	        dto.setEmailId(email.getEmailId());
	        dto.setEmailTitle(email.getEmailTitle());
	        dto.setEmailContent(email.getEmailContent());
	        dto.setSenderId(email.getSenderId());
	        dto.setSenderEmail(email.getSenderEmail());
	        dto.setSentTime(email.getEmailSentTime());
	        dto.setEmailStatus(email.getEmailStatus() != null ? email.getEmailStatus().name() : null);
	        dto.setReplyToEmailId(email.getReplyToEmailId());
	        
	        // EmailRecipient의 읽음 상태
	        dto.setEmailReadYn(recipient.getEmailReadYn());
	        
	        // 발신자 정보 조회
	        Integer senderId = email.getSenderId();
	        if (senderId != null) {
	            userRepository.findById(senderId).ifPresent(user -> {
	                dto.setSenderName(user.getName());
	                dto.setSenderDept(user.getDepartment() != null ? user.getDepartment().getDeptName() : null);
	            });
	        }
	        
	        return dto;
	    }).collect(Collectors.toList());

	    log.info("[getInbox] DTO 변환 완료 - dtoList size: {}", dtoList.size());
	    
	    // Page 반환(dto)
	    return new PageImpl<>(dtoList, pageable, recipientPage.getTotalElements());
	}
	@Override
	public Page<EmailResponseDTO> getSentbox(String userEmail, int page, int size, String searchType, String keyword) {
		// [1] userEmail(문자열) → senderId(정수) 변환 과정 필요!
	    User sender = userRepository.findByEmail(userEmail) // 반드시 UserRepository 주입 필요!
	        .orElseThrow(() -> new IllegalArgumentException("User not found by email: " + userEmail));
	    Integer senderId = sender.getId(); // 또는 getId(), 실제 User 엔티티의 PK 필드명에 맞춤

	    // [2] 일자 내림차순으로 정렬
	    Sort sort = Sort.by(Sort.Direction.DESC, "emailSentTime"); // DB/엔티티 컬럼명이 "emailSentTime"임을 위에서 확인함
	    Pageable pageable = PageRequest.of(page, size, sort);

	    // [3] 정수 senderId 기준으로 보낸 메일 조회 (휴지통/삭제 상태 제외)
	    String normalizedSearchType = normalizeSearchType(searchType);
	    String normalizedKeyword = normalizeKeyword(keyword);

	    Page<com.goodee.coreconnect.email.entity.Email> emailPage =
	            emailRepository.findBySenderIdExcludingTrash(senderId, pageable, normalizedSearchType, normalizedKeyword);

	    // [4] DTO 변환
	    List<EmailResponseDTO> dtoList = emailPage.stream().map(email -> {
	        EmailResponseDTO dto = new EmailResponseDTO();

	        // email 엔티티의 기본 필드 세팅
	        dto.setEmailId(email.getEmailId());
	        dto.setEmailTitle(email.getEmailTitle());
	        dto.setEmailContent(email.getEmailContent());
	        dto.setSenderId(email.getSenderId());
	        dto.setSentTime(email.getEmailSentTime());
	        dto.setEmailStatus(email.getEmailStatus() != null ? email.getEmailStatus().name() : null);
	        dto.setReplyToEmailId(email.getReplyToEmailId());

	        // 수신자 정보
	        List<EmailRecipient> recipients = emailRecipientRepository.findByEmail(email);

	        // 수신자 정보 추가
	        List<String> toAddresses = recipients.stream()
	            .filter(r -> "TO".equalsIgnoreCase(r.getEmailRecipientType()))
	            .map(EmailRecipient::getEmailRecipientAddress)
	            .collect(Collectors.toList());
	        dto.setRecipientAddresses(toAddresses);

	        // 참조 정보 추가
	        List<String> ccAddresses = recipients.stream()
	            .filter(r -> "CC".equalsIgnoreCase(r.getEmailRecipientType()))
	            .map(EmailRecipient::getEmailRecipientAddress)
	            .collect(Collectors.toList());
	        dto.setCcAddresses(ccAddresses);

	        // 숨은 참조 정보 추가
	        List<String> bccAddresses = recipients.stream()
	            .filter(r -> "BCC".equalsIgnoreCase(r.getEmailRecipientType()))
	            .map(EmailRecipient::getEmailRecipientAddress)
	            .collect(Collectors.toList());
	        dto.setBccAddresses(bccAddresses);

	        // 첨부파일 정보 (예시, 필요시 주석해제)
	        // List<EmailFile> files = emailFileRepository.findByEmail(email);
	        // List<Integer> fileIds = files.stream()
	        //     .map(EmailFile::getEmailFileId)
	        //     .collect(Collectors.toList());
	        // dto.setFileIds(fileIds);

	        return dto;
	    }).collect(Collectors.toList());

	    return new PageImpl<>(dtoList, pageable, emailPage.getTotalElements());
	}

	
	/**
	 * 반송함(BounceBox): 내가 보낸 메일 중 반송(Bounce) 처리된 메일만 페이징 조회 반환
	 * 
	 * */
	@Override
	public Page<EmailResponseDTO> getBounceBox(Integer userId, int page, int size) {
		Pageable pageable = PageRequest.of(page, size);

        // 발신자(userId)이고 상태가 BOUNCE인 메일 페이징 조회
        Page<com.goodee.coreconnect.email.entity.Email> emailPage =
                emailRepository.findBySenderIdAndEmailStatus(userId, EmailStatusEnum.BOUNCE, pageable);

        List<EmailResponseDTO> dtoList = emailPage.stream().map(email -> {
            EmailResponseDTO dto = new EmailResponseDTO();
            dto.setEmailId(email.getEmailId());
            dto.setEmailTitle(email.getEmailTitle());
            dto.setEmailContent(email.getEmailContent());
            dto.setSenderId(email.getSenderId());
            dto.setSentTime(email.getEmailSentTime());
            dto.setEmailStatus(email.getEmailStatus().name());
            dto.setReplyToEmailId(email.getReplyToEmailId());
            return dto;
        }).collect(Collectors.toList());

        return new PageImpl<>(dtoList, pageable, emailPage.getTotalElements());
	}

	/**
     * 이메일을 SendGrid로 발송하고 DB에 저장합니다.
     * 임시저장 메일 발송 시, 임시메일의 상태만 SENT로 변경하고, 내용을 최신화하며, 신규 발송 메일은 새로 생성
	 * @throws IOException 
     */
	/**
	 * 이메일을 DB에 저장(즉시메일/예약메일)합니다.
	 * 임시저장 메일 발송 시, 임시메일의 상태만 SENT 또는 RESERVED로 변경.
	 * 신규 메일은 insert, 첨부/수신자 포함 저장. (SendGrid 등 외부 발송은 아님)
	 * @throws IOException
	 */

    /**
     * 이메일을 DB에 저장(즉시메일/예약메일)합니다.
     */
	@Override
    @Transactional
    public EmailResponseDTO sendEmail(EmailSendRequestDTO requestDTO, List<MultipartFile> attachments) throws IOException {
        log.info("[DEBUG] sendEmail: senderId={}, senderAddress={}, requestDTO.getEmailId={}, reservedAt={}",
                requestDTO.getSenderId(), requestDTO.getSenderAddress(), requestDTO.getEmailId(), requestDTO.getReservedAt());

        com.goodee.coreconnect.email.entity.Email savedEmail;

        // 임시저장 메일 발송 분기 (DRAFT → SENT or RESERVED)
        if (requestDTO.getEmailId() != null) {
            com.goodee.coreconnect.email.entity.Email draft = emailRepository
                    .findByEmailIdAndSenderEmailAndEmailStatus(
                            requestDTO.getEmailId(),
                            requestDTO.getSenderAddress(),
                            EmailStatusEnum.DRAFT)
                    .orElseThrow(() -> new IllegalArgumentException("임시보관 메일을 찾을 수 없습니다."));

            draft.setEmailTitle(requestDTO.getEmailTitle());
            draft.setEmailContent(requestDTO.getEmailContent());
            draft.setReservedAt(requestDTO.getReservedAt());
            if (requestDTO.getReservedAt() != null && requestDTO.getReservedAt().isAfter(LocalDateTime.now())) {
                draft.setEmailStatus(EmailStatusEnum.RESERVED);
                draft.setEmailSentTime(null);
                draft.setEmailFolder("RESERVED");
            } else {
                draft.setEmailStatus(EmailStatusEnum.SENT);
                draft.setEmailSentTime(LocalDateTime.now());
                draft.setEmailFolder("SENT");
            }
            savedEmail = emailRepository.save(draft);
        } else {
            // 신규 메일
            com.goodee.coreconnect.email.entity.Email entity = com.goodee.coreconnect.email.entity.Email.builder()
                    .emailTitle(requestDTO.getEmailTitle())
                    .emailContent(requestDTO.getEmailContent())
                    .emailStatus(requestDTO.getReservedAt() != null && requestDTO.getReservedAt().isAfter(LocalDateTime.now())
                            ? EmailStatusEnum.RESERVED : EmailStatusEnum.SENT)
                    .emailSentTime(requestDTO.getReservedAt() == null || !requestDTO.getReservedAt().isAfter(LocalDateTime.now())
                            ? LocalDateTime.now() : null)
                    .senderId(requestDTO.getSenderId())
                    .senderEmail(requestDTO.getSenderAddress())
                    .favoriteStatus(false)
                    .emailDeleteYn(false)
                    .emailSaveStatusYn(false)
                    .emailType(requestDTO.getEmailType())
                    .reservedAt(requestDTO.getReservedAt())
                    .emailFolder(requestDTO.getReservedAt() != null && requestDTO.getReservedAt().isAfter(LocalDateTime.now())
                            ? "RESERVED" : "SENT")
                    .replyToEmailId(requestDTO.getReplyToEmailId())
                    .build();
            savedEmail = emailRepository.save(entity);
        }

        // 첨부파일 저장 (S3 업로드)
        if (attachments != null && !attachments.isEmpty()) {
            for (MultipartFile file : attachments) {
                String s3key = s3Service.uploadApprovalFile(file);
                EmailFile emailFile = EmailFile.builder()
                        .emailFileName(file.getOriginalFilename())
                        .emailFileSize(file.getSize())
                        .emailFileS3ObjectKey(s3key)
                        .emailFielDeletedYn(false)
                        .email(savedEmail)
                        .build();
                emailFileRepository.save(emailFile);
            }
        }

        // 수신자 정보 저장 (TO/CC/BCC) — 저장된 수신자 목록 수집
        List<EmailRecipient> savedRecipients = new ArrayList<>();

        if (requestDTO.getRecipientAddress() != null) {
            for (String to : requestDTO.getRecipientAddress()) {
                Optional<User> userOptional = userRepository.findByEmail(to);
                Integer userId = userOptional.map(User::getId).orElse(null);
                EmailRecipient recipient = EmailRecipient.builder()
                        .emailRecipientType("TO")
                        .emailRecipientAddress(to)
                        .userId(userId)
                        .emailReadYn(false)
                        .emailIsAlarmSent(false)
                        .email(savedEmail)
                        .build();
                EmailRecipient saved = emailRecipientRepository.save(recipient);
                savedRecipients.add(saved);
            }
        }

        if (requestDTO.getCcAddresses() != null) {
            for (String cc : requestDTO.getCcAddresses()) {
                Optional<User> userOptional = userRepository.findByEmail(cc);
                Integer userId = userOptional.map(User::getId).orElse(null);
                EmailRecipient ccRecipient = EmailRecipient.builder()
                        .emailRecipientType("CC")
                        .emailRecipientAddress(cc)
                        .userId(userId)
                        .emailReadYn(false)
                        .emailIsAlarmSent(false)
                        .email(savedEmail)
                        .build();
                EmailRecipient saved = emailRecipientRepository.save(ccRecipient);
                savedRecipients.add(saved);
            }
        }

        if (requestDTO.getBccAddresses() != null) {
            for (String bcc : requestDTO.getBccAddresses()) {
                Optional<User> userOptional = userRepository.findByEmail(bcc);
                Integer userId = userOptional.map(User::getId).orElse(null);
                EmailRecipient bccRecipient = EmailRecipient.builder()
                        .emailRecipientType("BCC")
                        .emailRecipientAddress(bcc)
                        .userId(userId)
                        .emailReadYn(false)
                        .emailIsAlarmSent(false)
                        .email(savedEmail)
                        .build();
                EmailRecipient saved = emailRecipientRepository.save(bccRecipient);
                savedRecipients.add(saved);
            }
        }

        // 알림 발송 로직: 저장된 메일이 SENT 상태인 경우에만 알림 전송
        if (savedEmail.getEmailStatus() == EmailStatusEnum.SENT) {
            // 발신자 이름 조회
            String senderName = Optional.ofNullable(savedEmail.getSenderId())
                    .flatMap(id -> userRepository.findById(id))
                    .map(User::getName)
                    .orElse(savedEmail.getSenderEmail());

            // 수신자(사용자 레코드가 연결된 경우)에게 알림 발송
            for (EmailRecipient rec : savedRecipients) {
                if (rec.getUserId() != null) {
                    try {
                        String title = savedEmail.getEmailTitle() != null ? savedEmail.getEmailTitle() : "(제목 없음)";
                        // ⭐ 제목이 너무 길면 잘라내기 (알림 메시지 최대 길이: 255자)
                        // "[메일 도착] '" + title + "' 메일이 도착했습니다." 형식이므로 제목은 최대 200자로 제한
                        String truncatedTitle = title.length() > 200 ? title.substring(0, 200) + "..." : title;
                        String message = "[메일 도착] '" + truncatedTitle + "' 메일이 도착했습니다.";
                        // ⭐ 메시지 전체 길이도 255자로 제한
                        if (message.length() > 255) {
                            message = message.substring(0, 252) + "...";
                        }
                        notificationService.sendNotification(
                                rec.getUserId(),
                                NotificationType.EMAIL,
                                message,
                                null,
                                null,
                                savedEmail.getSenderId(),
                                senderName,
                                null
                        );

                        // mark emailIsAlarmSent true to avoid duplicate alarms
                        rec.setEmailIsAlarmSent(true);
                        emailRecipientRepository.save(rec);
                    } catch (Exception ex) {
                        log.warn("[sendEmail] notification failed for recipient={}, emailId={}, err={}", rec.getEmailRecipientAddress(), savedEmail.getEmailId(), ex.getMessage(), ex);
                        // continue sending to others
                    }
                } else {
                    // 수신자가 비회원(유저 id 없음)일 경우 알림은 스킵
                    log.debug("[sendEmail] recipient {} has no userId, skip notification", rec.getEmailRecipientAddress());
                }
            }

            // 발신자에게도 발송 완료 알림 (발신자가 회원인 경우)
            if (savedEmail.getSenderId() != null) {
                try {
                    String title = savedEmail.getEmailTitle() != null ? savedEmail.getEmailTitle() : "(제목 없음)";
                    // ⭐ 제목이 너무 길면 잘라내기 (알림 메시지 최대 길이: 255자)
                    // "[이메일 발송 완료] '" + title + "' 이메일이 발송되었습니다." 형식이므로 제목은 최대 200자로 제한
                    String truncatedTitle = title.length() > 200 ? title.substring(0, 200) + "..." : title;
                    String senderMsg = "[이메일 발송 완료] '" + truncatedTitle + "' 이메일이 발송되었습니다.";
                    // ⭐ 메시지 전체 길이도 255자로 제한
                    if (senderMsg.length() > 255) {
                        senderMsg = senderMsg.substring(0, 252) + "...";
                    }
                    notificationService.sendNotification(
                            savedEmail.getSenderId(),
                            NotificationType.EMAIL,
                            senderMsg,
                            null,
                            null,
                            savedEmail.getSenderId(),
                            senderName,
                            null
                    );
                } catch (Exception ex) {
                    log.warn("[sendEmail] failed to notify sender id={}, err={}", savedEmail.getSenderId(), ex.getMessage(), ex);
                }
            }
        } else {
            log.debug("[sendEmail] saved as RESERVED (no immediate notifications). emailId={}", savedEmail.getEmailId());
        }

        EmailResponseDTO resultDTO = new EmailResponseDTO();
        resultDTO.setEmailId(savedEmail.getEmailId());
        resultDTO.setEmailStatus(savedEmail.getEmailStatus() != null ? savedEmail.getEmailStatus().name() : null);
        resultDTO.setEmailTitle(savedEmail.getEmailTitle());
        resultDTO.setEmailContent(savedEmail.getEmailContent());
        return resultDTO;
    }
    

    /**
     * New: SendGrid를 사용하여 즉시 발송(외부 전송)하는 메서드.
     * - 방법: DB에 저장(신규 또는 DRAFT -> SENT), 그 후 SendGrid로 실제 전송.
     * - 기존 sendEmail() 로직을 재사용하여 DB 저장을 수행한 뒤 SendGrid API를 호출합니다.
     */
    /**
     * SendGrid 전송 메서드
     */
    @Override
    @Transactional
    public EmailResponseDTO sendEmailViaSendGrid(EmailSendRequestDTO requestDTO, List<MultipartFile> attachments) throws IOException {
        // 1) DB에 저장(reuse)
        EmailResponseDTO savedDto = sendEmail(requestDTO, attachments);

        // 2) SendGrid 외부 전송 (동기 호출)
        try {
            if (senGridApiKey == null || senGridApiKey.isBlank()) {
                log.warn("[sendEmailViaSendGrid] SendGrid API key not configured - skipping external send");
            } else {
                com.sendgrid.Response sgResp = sendGridEmailSender.send(requestDTO, attachments);
                log.info("[sendEmailViaSendGrid] sendgrid status={}, body={}", sgResp.getStatusCode(), sgResp.getBody());
            }
        } catch (Exception e) {
            log.error("[sendEmailViaSendGrid] SendGrid send failed", e);
            // 실패는 로깅 후 흘려보내기(요구사항에 따라 예외 처리/재시도 구현)
        }

        return savedDto;
    }

    
    
    
    
    

    /**
     * 예약 시간이 도래한 예약 메일 row를 SENT 상태로 변경하고 발송시각을 업데이트합니다.
     * (새로운 row를 생성하지 않고 예약 메일 row 상태/시각만 update)
     */
    @Override
    public void sendActualMail(com.goodee.coreconnect.email.entity.Email reservedEmail, List<MultipartFile> attachments) {
        // RESERVED 상태일 때만 SENT로 변경
        if (reservedEmail.getEmailStatus() == EmailStatusEnum.RESERVED) {
            reservedEmail.setEmailStatus(EmailStatusEnum.SENT); // 상태 변경
            reservedEmail.setEmailSentTime(LocalDateTime.now()); // 발송 시각 기록
            reservedEmail.setEmailFolder("SENT");
            emailRepository.save(reservedEmail);
            log.info("예약메일(row:{})이 SENT로 처리되고 email_sent_time이 업데이트 됨", reservedEmail.getEmailId());
        } else {
            log.warn("sendActualMail 호출시 이메일이 RESERVED 상태가 아님! (id={}, 현재상태={})", reservedEmail.getEmailId(), reservedEmail.getEmailStatus());
        }
        // 첨부/수신자 정보는 이미 저장되어 있으므로 추가 작업 없음
    }
	
	
	
	
	@Override
    @Transactional
    public boolean markMailAsRead(Integer emailId, String userEmail) {
        // 특정 이메일의 수신자(본인)에 대해 읽음처리 (이미 읽었으면 false)
        com.goodee.coreconnect.email.entity.Email email = emailRepository.findById(emailId)
                .orElseThrow(() -> new IllegalArgumentException("메일이 존재하지 않습니다." + emailId));

        List<EmailRecipient> recipients = emailRecipientRepository.findByEmail(email);

        Optional<EmailRecipient> myRecipientOpt = recipients.stream()
            .filter(r -> userEmail.equals(r.getEmailRecipientAddress()))
            .findFirst();

        // emailReadYn이 false이거나 null인 경우 모두 처리
        if (myRecipientOpt.isPresent()) {
            EmailRecipient recipient = myRecipientOpt.get();
            Integer recipientId = recipient.getEmailRecipientId();
            Boolean currentReadYn = recipient.getEmailReadYn();
            // 안읽은 메일인 경우 (false 또는 null)
            if (currentReadYn == null || Boolean.FALSE.equals(currentReadYn)) {
                LocalDateTime now = LocalDateTime.now();
                // 엔티티를 직접 수정하여 DB에 확실히 반영
                recipient.setEmailReadYn(true);
                recipient.setEmailReadAt(now);
                emailRecipientRepository.save(recipient);
                // 즉시 DB에 반영되도록 flush
                emailRecipientRepository.flush();
                log.info("markMailAsRead: EmailRecipient updated - emailId={}, userEmail={}, recipientId={}, emailReadYn={} -> true, emailReadAt={}", 
                        emailId, userEmail, recipientId, currentReadYn, now);
                
                // DB에 실제로 반영되었는지 확인 (디버그 로그)
                emailRecipientRepository.findById(recipientId).ifPresent(savedRecipient -> {
                    Boolean savedReadYn = savedRecipient.getEmailReadYn();
                    log.info("markMailAsRead: DB 확인 - recipientId={}, 실제 DB의 emailReadYn={}", 
                            recipientId, savedReadYn);
                    if (!Boolean.TRUE.equals(savedReadYn)) {
                        log.error("markMailAsRead: ⚠️ 경고 - DB에 emailReadYn이 true로 저장되지 않았습니다! recipientId={}, emailId={}, userEmail={}", 
                                recipientId, emailId, userEmail);
                    }
                });
                
                // Email 엔티티의 emailReadAt도 업데이트
                email.setEmailReadAt(now);
                emailRepository.save(email);
                emailRepository.flush();
                log.info("markMailAsRead: Email updated - emailId={}, emailReadAt={}", emailId, now);
                
                return true;
            } else {
                log.info("markMailAsRead: Email already read - emailId={}, userEmail={}, emailReadYn={}", 
                        emailId, userEmail, currentReadYn);
            }
        }
        // 이미 읽은 경우나 못찾은 경우
        return false;
    }

    @Override
    @Transactional
    public boolean toggleFavoriteStatus(Integer emailId, String userEmail) {
        // 메일을 조회하고, 발신자이거나 수신자인지 확인
        Email email = emailRepository.findById(emailId)
                .orElseThrow(() -> new IllegalArgumentException("메일이 존재하지 않습니다." + emailId));

        // 발신자인지 확인
        boolean isSender = email.getSenderEmail().equals(userEmail);
        
        // 수신자인지 확인
        boolean isRecipient = emailRecipientRepository.findByEmail(email).stream()
                .anyMatch(r -> userEmail.equals(r.getEmailRecipientAddress()));

        if (!isSender && !isRecipient) {
            throw new IllegalArgumentException("해당 메일의 발신자 또는 수신자가 아닙니다.");
        }

        // 중요 표시 토글
        boolean currentStatus = email.getFavoriteStatus() != null && email.getFavoriteStatus();
        email.setFavoriteStatus(!currentStatus);
        emailRepository.save(email);
        emailRepository.flush();

        log.info("toggleFavoriteStatus: Email favoriteStatus toggled - emailId={}, userEmail={}, favoriteStatus={} -> {}", 
                emailId, userEmail, currentStatus, !currentStatus);

        return !currentStatus;
    }

	@Override
	@Transactional
	public EmailResponseDTO saveDraft(EmailSendRequestDTO requestDTO, List<MultipartFile> attachments)
			throws IOException {
		Integer requestEmailId = requestDTO.getEmailId();
		// ★ 중요: emailId가 0이거나 유효하지 않으면 null로 처리
		if (requestEmailId != null && requestEmailId <= 0) {
			log.warn("[saveDraft] ⚠️ 유효하지 않은 emailId: {}, null로 처리", requestEmailId);
			requestEmailId = null;
		}
		
		log.info("[saveDraft] ========== 서비스 호출 ==========");
		log.info("[saveDraft] 받은 emailId: {}, senderEmail: {}, senderId: {}", 
				requestEmailId, requestDTO.getSenderAddress(), requestDTO.getSenderId());
		log.info("[saveDraft] emailId null 체크: {}, emailId > 0 체크: {}", 
				requestEmailId == null, (requestEmailId != null && requestEmailId > 0));
		log.info("[saveDraft] requestDTO 전체 내용: emailId={}, title={}, recipientCount={}", 
				requestDTO.getEmailId(), requestDTO.getEmailTitle(), 
				requestDTO.getRecipientAddress() != null ? requestDTO.getRecipientAddress().size() : 0);
		
		com.goodee.coreconnect.email.entity.Email savedDraftEmail;
		
		// emailId가 있으면 기존 임시저장 메일 업데이트, 없으면 새로 생성
		if (requestEmailId != null && requestEmailId > 0) {
			log.info("[saveDraft] ⚙️ 기존 임시저장 메일 업데이트 시도 - emailId: {}, senderEmail: {}", 
					requestEmailId, requestDTO.getSenderAddress());
			
			// 먼저 emailId로만 조회해서 존재하는지 확인
			Optional<com.goodee.coreconnect.email.entity.Email> emailByIdOpt = emailRepository.findById(requestEmailId);
			if (emailByIdOpt.isPresent()) {
				com.goodee.coreconnect.email.entity.Email emailById = emailByIdOpt.get();
				log.info("[saveDraft] 🔍 emailId로 조회 성공 - emailId: {}, 실제 senderEmail: '{}', 요청 senderEmail: '{}', 실제 emailStatus: '{}'", 
						requestEmailId, emailById.getSenderEmail(), requestDTO.getSenderAddress(), emailById.getEmailStatus());
				
				// senderEmail과 emailStatus가 일치하는지 확인
				boolean senderMatches = emailById.getSenderEmail() != null && 
						emailById.getSenderEmail().equalsIgnoreCase(requestDTO.getSenderAddress());
				boolean statusMatches = emailById.getEmailStatus() == EmailStatusEnum.DRAFT;
				
				log.info("[saveDraft] 🔍 조건 확인 - senderMatches: {}, statusMatches: {}", senderMatches, statusMatches);
				
				if (senderMatches && statusMatches) {
					// 조건이 일치하면 업데이트 진행
					log.info("[saveDraft] ✅ 기존 임시저장 메일 찾기 성공 - emailId: {}", emailById.getEmailId());
					
					// 기존 임시저장 메일 업데이트
					savedDraftEmail = emailById;
					savedDraftEmail.setEmailTitle(requestDTO.getEmailTitle());
					savedDraftEmail.setEmailContent(requestDTO.getEmailContent());
					savedDraftEmail.setEmailType(requestDTO.getEmailType());
					savedDraftEmail.setReplyToEmailId(requestDTO.getReplyToEmailId());
					savedDraftEmail.setReservedAt(requestDTO.getReservedAt());
					savedDraftEmail = emailRepository.save(savedDraftEmail);
					log.info("[saveDraft] ✅ 기존 임시저장 메일 업데이트 완료 - emailId: {}", savedDraftEmail.getEmailId());
					
					// 기존 수신자 삭제
					List<EmailRecipient> existingRecipients = emailRecipientRepository.findByEmail(savedDraftEmail);
					if (!existingRecipients.isEmpty()) {
						emailRecipientRepository.deleteAll(existingRecipients);
						log.info("[saveDraft] 기존 수신자 삭제 - count: {}", existingRecipients.size());
					}
					
					// 기존 첨부파일 중 existingAttachmentIds에 포함되지 않은 것만 삭제
					List<EmailFile> existingFiles = emailFileRepository.findByEmail(savedDraftEmail);
					List<Integer> existingAttachmentIds = requestDTO.getExistingAttachmentIds() != null 
							? requestDTO.getExistingAttachmentIds() : Collections.emptyList();
					
					for (EmailFile existingFile : existingFiles) {
						if (!existingAttachmentIds.contains(existingFile.getEmailFileId())) {
							emailFileRepository.delete(existingFile);
							log.info("[saveDraft] 기존 첨부파일 삭제 - fileId: {}, fileName: {}", 
									existingFile.getEmailFileId(), existingFile.getEmailFileName());
						}
					}
					
					// 수신자 정보 저장은 아래에서 처리하므로 여기서는 continue하지 않음
				} else {
					// 조건이 일치하지 않으면 예외 발생
					log.error("[saveDraft] ❌ 조건 불일치 - senderMatches: {}, statusMatches: {}. " +
							"실제 senderEmail: '{}', 요청 senderEmail: '{}', 실제 emailStatus: '{}'", 
							senderMatches, statusMatches, emailById.getSenderEmail(), requestDTO.getSenderAddress(), emailById.getEmailStatus());
					throw new IllegalArgumentException(
							"임시저장 메일을 찾을 수 없습니다. 메일이 삭제되었거나 다른 사용자의 메일일 수 있습니다.");
				}
			} else {
				// emailId로 조회 실패
				log.error("[saveDraft] ❌ emailId로 조회 실패 - emailId: {}가 DB에 존재하지 않음", requestEmailId);
				throw new IllegalArgumentException(
						"임시저장 메일을 찾을 수 없습니다. 메일이 삭제되었거나 다른 사용자의 메일일 수 있습니다.");
			}
		} else {
			// 새 임시저장 메일 생성
			log.info("[saveDraft] ✨ 새 임시저장 메일 생성 - emailId가 null이거나 0 이하: {}", requestEmailId);
			savedDraftEmail = createNewDraftEmail(requestDTO);
			log.info("[saveDraft] ✅ 새 임시저장 메일 생성 완료 - emailId: {}", savedDraftEmail.getEmailId());
		}

		// 수신자 정보 저장 (null/빈배열 허용)
		if (requestDTO.getRecipientAddress() != null && !requestDTO.getRecipientAddress().isEmpty()) {
			for (String to : requestDTO.getRecipientAddress()) {
				Optional<User> userOptional = userRepository.findByEmail(to);
				Integer userId = userOptional.isPresent() ? userOptional.get().getId() : null;
				EmailRecipient recipient = EmailRecipient.builder()
						.emailRecipientType("TO")
						.emailRecipientAddress(to)
						.userId(userId)
						.emailReadYn(false)
						.emailIsAlarmSent(false)
						.email(savedDraftEmail)
						.build();
				emailRecipientRepository.save(recipient);
			}
		}
		if (requestDTO.getCcAddresses() != null && !requestDTO.getCcAddresses().isEmpty()) {
			for (String cc : requestDTO.getCcAddresses()) {
				Optional<User> userOptional = userRepository.findByEmail(cc);
				Integer userId = userOptional.isPresent() ? userOptional.get().getId() : null;
				EmailRecipient ccRecipient = EmailRecipient.builder()
						.emailRecipientType("CC")
						.emailRecipientAddress(cc)
						.userId(userId)
						.emailReadYn(false)
						.emailIsAlarmSent(false)
						.email(savedDraftEmail)
						.build();
				emailRecipientRepository.save(ccRecipient);
			}
		}
		if (requestDTO.getBccAddresses() != null && !requestDTO.getBccAddresses().isEmpty()) {
			for (String bcc : requestDTO.getBccAddresses()) {
				Optional<User> userOptional = userRepository.findByEmail(bcc);
				Integer userId = userOptional.isPresent() ? userOptional.get().getId() : null;
				EmailRecipient bccRecipient = EmailRecipient.builder()
						.emailRecipientType("BCC")
						.emailRecipientAddress(bcc)
						.userId(userId)
						.emailReadYn(false)
						.emailIsAlarmSent(false)
						.email(savedDraftEmail)
						.build();
				emailRecipientRepository.save(bccRecipient);
			}
		}

		// 새 첨부파일 저장 (s3 업로드, EmailFile 테이블 저장)
		if (attachments != null && !attachments.isEmpty()) {
			for (MultipartFile file : attachments) {
				String fileName = file.getOriginalFilename();
				long fileSize = file.getSize();
				String mimeType = file.getContentType();
				String s3key = s3Service.uploadApprovalFile(file);
				EmailFile emailFile = EmailFile.builder()
						.emailFileName(fileName)
						.emailFileSize(fileSize)
						.emailFileS3ObjectKey(s3key)
						.emailFielDeletedYn(false)
						.email(savedDraftEmail)
						.build();
				emailFileRepository.save(emailFile);
				log.info("[saveDraft] 새 첨부파일 저장 - fileName: {}", fileName);
			}
		}

		// Redis 카운트(개수) 무효화 처리(삭제)
		removeDraftCountCache(savedDraftEmail.getSenderEmail());

		// 결과 DTO 반환
		EmailResponseDTO resultDTO = new EmailResponseDTO();
		resultDTO.setEmailId(savedDraftEmail.getEmailId());
		resultDTO.setEmailStatus("DRAFT");
		resultDTO.setEmailTitle(savedDraftEmail.getEmailTitle());
		resultDTO.setEmailContent(savedDraftEmail.getEmailContent());
		return resultDTO;
	}
	
	// 새 임시저장 메일 생성 헬퍼 메서드
	private com.goodee.coreconnect.email.entity.Email createNewDraftEmail(EmailSendRequestDTO requestDTO) {
		com.goodee.coreconnect.email.entity.Email entity = com.goodee.coreconnect.email.entity.Email.builder()
				.emailTitle(requestDTO.getEmailTitle())
				.emailContent(requestDTO.getEmailContent())
				.emailStatus(EmailStatusEnum.DRAFT)
				.emailSentTime(null) // 임시저장은 발송 시간 없음
				.senderId(requestDTO.getSenderId())
				.senderEmail(requestDTO.getSenderAddress())
				.favoriteStatus(false)
				.emailDeleteYn(false)
				.emailSaveStatusYn(true) // 임시저장
				.emailType(requestDTO.getEmailType())
				.emailFolder("DRAFT")
				.replyToEmailId(requestDTO.getReplyToEmailId())
				.reservedAt(requestDTO.getReservedAt())
				.build();
		return emailRepository.save(entity);
	}

	@Override
	public Page<EmailResponseDTO> getDraftbox(String userEmail, int page, int size) {
		log.info("[getDraftbox] 호출 - userEmail: {}, page: {}, size: {}", userEmail, page, size);
		Pageable pageable = PageRequest.of(page, size);
		// 1. 임시저장(DRAFT) 메일만, 본인이 '발신자'인 경우만! (emailId 내림차순 정렬 - 최신 저장순)
		Page<com.goodee.coreconnect.email.entity.Email> draftPage = emailRepository.findDraftboxBySenderEmailAndEmailStatus(
		        userEmail, EmailStatusEnum.DRAFT, pageable);
		log.info("[getDraftbox] 조회 결과 - totalElements: {}, content size: {}", draftPage.getTotalElements(), draftPage.getContent().size());

		    List<EmailResponseDTO> dtoList = draftPage.stream().map(email -> {
		        EmailResponseDTO dto = new EmailResponseDTO();
		        dto.setEmailId(email.getEmailId());
		        dto.setEmailTitle(email.getEmailTitle());
		        dto.setEmailContent(email.getEmailContent());
		        dto.setSenderId(email.getSenderId());
		        dto.setSenderEmail(email.getSenderEmail());
		        dto.setSentTime(email.getEmailSentTime());
		        dto.setEmailStatus(email.getEmailStatus().name()); // DRAFT
		        dto.setReplyToEmailId(email.getReplyToEmailId());

		        // 받는 사람 (TO/CC/BCC)
		        List<EmailRecipient> recipients = emailRecipientRepository.findByEmail(email);
		        List<String> toAddresses = recipients.stream()
		            .filter(r -> "TO".equalsIgnoreCase(r.getEmailRecipientType()))
		            .map(EmailRecipient::getEmailRecipientAddress)
		            .collect(Collectors.toList());
		        List<String> ccAddresses = recipients.stream()
		            .filter(r -> "CC".equalsIgnoreCase(r.getEmailRecipientType()))
		            .map(EmailRecipient::getEmailRecipientAddress)
		            .collect(Collectors.toList());
		        List<String> bccAddresses = recipients.stream()
		            .filter(r -> "BCC".equalsIgnoreCase(r.getEmailRecipientType()))
		            .map(EmailRecipient::getEmailRecipientAddress)
		            .collect(Collectors.toList());
		        dto.setRecipientAddresses(toAddresses);
		        dto.setCcAddresses(ccAddresses);
		        dto.setBccAddresses(bccAddresses);

		        // 첨부파일 정보
		        List<EmailFile> files = emailFileRepository.findByEmail(email);
		        List<Integer> fileIds = files.stream()
		                .map(EmailFile::getEmailFileId)
		                .collect(Collectors.toList());
		        dto.setFileIds(fileIds);

		        return dto;
		    }).collect(Collectors.toList());

		    // 반환
		    return new PageImpl<>(dtoList, pageable, draftPage.getTotalElements());
	}

	@Override
	public long getDraftCount(String userEmail) {
		log.info("[getDraftCount] 호출 - userEmail: {}", userEmail);
		long count = emailRepository.countBySenderEmailAndEmailStatus(userEmail, EmailStatusEnum.DRAFT);
		log.info("[getDraftCount] 조회 결과 - count: {}", count);
		return count;
	}

	@Override
	public EmailResponseDTO getDraftDetail(Integer draftId, String userEmail) {
		// TODO Auto-generated method stub
		return null;
	}

	@Override
	public boolean deleteDraft(Integer draftId) {
		// TODO Auto-generated method stub
		return false;
	}

	// 레디스 캐시 삭제 함수 (DRY)
    private void removeDraftCountCache(String userEmail) {
        if (redisTemplate != null) {
            try {
                redisTemplate.delete("draft_count:" + userEmail);
            } catch (Exception e) {
                log.warn("[Redis] draft_count:{} 삭제 실패: {}", userEmail, e.getMessage());
            }
        }
    }

    /**
     * 임시저장 메일 상세조회 구현
     * @param draftId 임시메일 ID
     * @param userEmail 메일 소유자(로그인 사용자)
     * @return 상세 DTO (제목/본문/수신참조/bcc/첨부 등 모두 포함)
     */
    @Override
    public EmailResponseDTO getDraftMailDetail(Integer draftId, String userEmail) {
        // 1. 임시메일 엔티티({draftId, userEmail, 상태: DRAFT}) 조건으로 조회
    	com.goodee.coreconnect.email.entity.Email draftOpt = emailRepository
    	        .findByEmailIdAndSenderEmailAndEmailStatus(
    	            draftId, userEmail, EmailStatusEnum.DRAFT
    	        )
    	        .orElseThrow(() -> new IllegalArgumentException("임시보관 메일을 찾을 수 없습니다."));

    	com.goodee.coreconnect.email.entity.Email draft = emailRepository
    	        .findByEmailIdAndSenderEmailAndEmailStatus(
    	            draftId, userEmail, EmailStatusEnum.DRAFT
    	        )
    	        .orElseThrow(() -> new IllegalArgumentException("임시보관 메일을 찾을 수 없습니다."));
    	
    	// 2. 기본 메일 정보 셋팅
        EmailResponseDTO dto = new EmailResponseDTO();
        dto.setEmailId(draft.getEmailId());
        dto.setEmailTitle(draft.getEmailTitle());
        dto.setEmailContent(draft.getEmailContent());
        dto.setSenderId(draft.getSenderId());
        dto.setSenderEmail(draft.getSenderEmail());
        dto.setSentTime(draft.getEmailSentTime());
        dto.setEmailStatus(draft.getEmailStatus().name());
       
        // 3. 수신/참조/숨은참조 정보
        List<EmailRecipient> recipients = emailRecipientRepository.findByEmail(draft);
        List<String> toAddresses = recipients.stream()
                .filter(r -> "TO".equalsIgnoreCase(r.getEmailRecipientType()))
                .map(EmailRecipient::getEmailRecipientAddress)
                .collect(Collectors.toList());
        List<String> ccAddresses = recipients.stream()
                .filter(r -> "CC".equalsIgnoreCase(r.getEmailRecipientType()))
                .map(EmailRecipient::getEmailRecipientAddress)
                .collect(Collectors.toList());
        List<String> bccAddresses = recipients.stream()
                .filter(r -> "BCC".equalsIgnoreCase(r.getEmailRecipientType()))
                .map(EmailRecipient::getEmailRecipientAddress)
                .collect(Collectors.toList());

        dto.setRecipientAddresses(toAddresses);
        dto.setCcAddresses(ccAddresses);
        dto.setBccAddresses(bccAddresses);

        // 4. 첨부파일 정보
        List<EmailFile> files = emailFileRepository.findByEmail(draft);
        List<EmailResponseDTO.AttachmentDTO> attachments = files.stream()
                .map(f -> new EmailResponseDTO.AttachmentDTO(
                        f.getEmailFileId(),
                        f.getEmailFileName(),
                        f.getEmailFileSize()
                )).collect(Collectors.toList());
        dto.setAttachments(attachments);
        dto.setFileIds(files.stream().map(EmailFile::getEmailFileId).collect(Collectors.toList()));
        
        // 5. 기타 필드 세팅
        dto.setReplyToEmailId(draft.getReplyToEmailId());
        
        return dto;
    }

    /**
     * 임시저장(DRAFT) 상태의 메일만 삭제
     */
    @Override
    @Transactional
    public void deleteDraftMail(Integer draftId) {
    	com.goodee.coreconnect.email.entity.Email draft = emailRepository.findById(draftId)
    	        .orElseThrow(() -> new IllegalArgumentException("임시저장 메일을 찾을 수 없습니다."));
    	    if (draft.getEmailStatus() != EmailStatusEnum.DRAFT) {
    	        throw new IllegalStateException("임시저장 상태(DRAFT) 메일만 삭제할 수 있습니다.");
    	    }
    	    // 실제 삭제(X), 상태값만 변경
    	    draft.setEmailStatus(EmailStatusEnum.DELETED);
    	    // 필요시 삭제 시각 등 기록
    	    draft.setEmailDeletedTime(LocalDateTime.now());
    	    log.info("삭제 draft: {}", draft);
    	    emailRepository.save(draft);
    }

    @Override
    @Transactional
    public void moveEmailsToTrash(List<Integer> emailIds, String userEmail) {
        log.info("moveEmailsToTrash: 시작 - emailIds={}, userEmail={}", emailIds, userEmail);
        
        if (CollectionUtils.isEmpty(emailIds) || userEmail == null) {
            log.warn("moveEmailsToTrash: emailIds or userEmail is empty/null");
            return;
        }
        
        // userEmail -> userId 변환
        Optional<User> userOpt = userRepository.findByEmail(userEmail);
        if (userOpt.isEmpty()) {
            log.error("moveEmailsToTrash: User not found for email {}", userEmail);
            return;
        }
        Integer userIntId = userOpt.get().getId();
        Long userId = userIntId.longValue();
        log.info("moveEmailsToTrash: userIntId={}, userId={}", userIntId, userId);
        
        LocalDateTime now = LocalDateTime.now();
        int emailStatusUpdated = 0;
        int visibilityUpdated = 0;
        
        for (Integer emailId : emailIds) {
            try {
                log.info("moveEmailsToTrash: 처리 중 - emailId={}", emailId);
                
                // 1. Email 엔티티 조회
                Optional<com.goodee.coreconnect.email.entity.Email> emailOpt = emailRepository.findById(emailId);
                if (emailOpt.isEmpty()) {
                    log.warn("moveEmailsToTrash: Email not found for emailId {}", emailId);
                    continue;
                }
                
                com.goodee.coreconnect.email.entity.Email email = emailOpt.get();
                log.info("moveEmailsToTrash: Email found - emailId={}, senderId={}, status={}", 
                        emailId, email.getSenderId(), email.getEmailStatus());
                
                // 2. 발신자인지 수신자인지 먼저 확인
                String role = "RECIPIENT";
                boolean isSender = false;
                boolean isRecipient = false;
                
                // 발신자 확인
                Integer emailSenderId = email.getSenderId();
                if (emailSenderId != null) {
                    log.info("moveEmailsToTrash: 발신자 확인 - emailSenderId={}, userIntId={}", emailSenderId, userIntId);
                    if (emailSenderId.equals(userIntId)) {
                        role = "SENDER";
                        isSender = true;
                        log.info("moveEmailsToTrash: 발신자 확인됨 - emailId={}", emailId);
                    }
                }
                
                // 수신자 확인 (EmailRecipient를 통해)
                EmailRecipient userRecipient = null;
                if (!isSender) {
                    List<EmailRecipient> recipients = emailRecipientRepository.findByEmail(email);
                    log.info("moveEmailsToTrash: 수신자 확인 - recipients count={}", recipients.size());
                    for (EmailRecipient recipient : recipients) {
                        String recipientAddress = recipient.getEmailRecipientAddress();
                        log.debug("moveEmailsToTrash: 수신자 비교 - recipientAddress={}, userEmail={}", recipientAddress, userEmail);
                        if (userEmail != null && userEmail.equals(recipientAddress)) {
                            isRecipient = true;
                            role = "RECIPIENT";
                            userRecipient = recipient;
                            log.info("moveEmailsToTrash: 수신자 확인됨 - emailId={}, recipientAddress={}", emailId, recipientAddress);
                            break;
                        }
                    }
                }
                
                // 3. 발신자/수신자에 따라 다른 처리
                if (isSender) {
                    // 보낸메일함: Email 엔티티의 상태를 TRASH로 변경
                    email.setEmailStatus(EmailStatusEnum.TRASH);
                    emailRepository.save(email);
                    emailRepository.flush();
                    emailStatusUpdated++;
                    log.info("moveEmailsToTrash: 보낸메일함 - Email status updated to TRASH - emailId={}", emailId);
                } else if (isRecipient && userRecipient != null) {
                    // 받은메일함: EmailRecipient의 deleted를 true로 설정 (Email.emailStatus는 변경하지 않음)
                    userRecipient.setDeleted(true);
                    userRecipient.setDeletedAt(now);
                    emailRecipientRepository.save(userRecipient);
                    emailRecipientRepository.flush();
                    log.info("moveEmailsToTrash: 받은메일함 - EmailRecipient deleted=true - emailId={}, recipientId={}", 
                            emailId, userRecipient.getEmailRecipientId());
                } else {
                    log.warn("moveEmailsToTrash: User {} is neither sender nor recipient of email {}", userEmail, emailId);
                    // 발신자도 수신자도 아니면 경고만 하고 계속 진행
                }
                
                // 4. mail_user_visibility 테이블에 기록 (휴지통 DB)
                // 발신자도 수신자도 아니면 mail_user_visibility에 저장하지 않음
                if (!isSender && !isRecipient) {
                    log.warn("moveEmailsToTrash: User {} is neither sender nor recipient of email {}, skipping mail_user_visibility", 
                            userEmail, emailId);
                    continue; // 다음 메일로
                }
                
                Long mailId = emailId.longValue();
                
                // mail_user_visibility에 기록 (무조건 저장 - 받은메일함/보낸메일함에서 삭제 요청이므로)
                // 기존 레코드가 있으면 업데이트, 없으면 생성
                Optional<MailUserVisibility> visibilityOpt = visibilityRepository.findByMailIdAndUserId(mailId, userId);
                log.info("moveEmailsToTrash: mail_user_visibility 조회 - mailId={}, userId={}, exists={}", 
                        mailId, userId, visibilityOpt.isPresent());
                
                MailUserVisibility visibility;
                boolean isNewRecord = false;
                
                if (visibilityOpt.isPresent()) {
                    // 기존 레코드 업데이트 (직접 수정)
                    visibility = visibilityOpt.get();
                    log.info("moveEmailsToTrash: 기존 레코드 업데이트 - id={}, deleted={}, role={}", 
                            visibility.getId(), visibility.isDeleted(), visibility.getRole());
                    visibility.setDeleted(true);
                    visibility.setDeletedAt(now);
                    if (visibility.getRole() == null || visibility.getRole().isEmpty()) {
                        visibility.setRole(role);
                    }
                    if (visibility.getCreatedAt() == null) {
                        visibility.setCreatedAt(now);
                    }
                } else {
                    // 새 레코드 생성
                    isNewRecord = true;
                    log.info("moveEmailsToTrash: 새 레코드 생성 - mailId={}, userId={}, role={}", mailId, userId, role);
                    visibility = MailUserVisibility.builder()
                            .mailId(mailId)
                            .userId(userId)
                            .role(role)
                            .deleted(true)
                            .deletedAt(now)
                            .createdAt(now)
                            .build();
                }
                
                // 저장 전 최종 확인
                log.info("moveEmailsToTrash: 저장 전 확인 - mailId={}, userId={}, role={}, deleted={}, isNew={}", 
                        visibility.getMailId(), visibility.getUserId(), visibility.getRole(), visibility.isDeleted(), isNewRecord);
                
                MailUserVisibility saved = visibilityRepository.save(visibility);
                visibilityRepository.flush(); // 즉시 반영
                
                // 저장 후 확인
                if (saved.getId() != null) {
                    visibilityUpdated++;
                    log.info("moveEmailsToTrash: ✅ 저장 성공 - id={}, mailId={}, userId={}, role={}, deleted={}, deletedAt={}", 
                            saved.getId(), saved.getMailId(), saved.getUserId(), saved.getRole(), saved.isDeleted(), saved.getDeletedAt());
                } else {
                    log.error("moveEmailsToTrash: ❌ 저장 실패 - id가 null입니다. mailId={}, userId={}", mailId, userId);
                }
                
            } catch (Exception e) {
                log.error("moveEmailsToTrash: Error processing emailId={}", emailId, e);
                // 개별 메일 처리 실패해도 계속 진행
            }
        }
        
        log.info("moveEmailsToTrash: 완료 - updated {} Email rows to TRASH, {} MailUserVisibility records for user {}", 
                emailStatusUpdated, visibilityUpdated, userEmail);
    }

    @Override
    @Transactional
    public void restoreEmailsFromTrash(List<Integer> emailIds, String userEmail) {
        log.info("restoreEmailsFromTrash: 시작 - emailIds={}, userEmail={}", emailIds, userEmail);
        
        if (CollectionUtils.isEmpty(emailIds) || userEmail == null) {
            log.warn("restoreEmailsFromTrash: emailIds or userEmail is empty/null");
            return;
        }
        
        // userEmail -> userId 변환
        Optional<User> userOpt = userRepository.findByEmail(userEmail);
        if (userOpt.isEmpty()) {
            log.error("restoreEmailsFromTrash: User not found for email {}", userEmail);
            return;
        }
        Integer userIntId = userOpt.get().getId();
        Long userId = userIntId.longValue();
        log.info("restoreEmailsFromTrash: userIntId={}, userId={}", userIntId, userId);
        
        int emailStatusRestored = 0;
        int recipientRestored = 0;
        int visibilityRestored = 0;
        
        for (Integer emailId : emailIds) {
            try {
                log.info("restoreEmailsFromTrash: 처리 중 - emailId={}", emailId);
                
                // 1. Email 엔티티 조회
                Optional<com.goodee.coreconnect.email.entity.Email> emailOpt = emailRepository.findById(emailId);
                if (emailOpt.isEmpty()) {
                    log.warn("restoreEmailsFromTrash: Email not found for emailId {}", emailId);
                    continue;
                }
                
                com.goodee.coreconnect.email.entity.Email email = emailOpt.get();
                log.info("restoreEmailsFromTrash: Email found - emailId={}, senderId={}, status={}, sentTime={}", 
                        emailId, email.getSenderId(), email.getEmailStatus(), email.getEmailSentTime());
                
                // 2. 발신자인지 수신자인지 확인
                String role = "RECIPIENT";
                boolean isSender = false;
                boolean isRecipient = false;
                
                // 발신자 확인
                Integer emailSenderId = email.getSenderId();
                if (emailSenderId != null && emailSenderId.equals(userIntId)) {
                    role = "SENDER";
                    isSender = true;
                    log.info("restoreEmailsFromTrash: 발신자 확인됨 - emailId={}", emailId);
                }
                
                // 수신자 확인
                EmailRecipient userRecipient = null;
                if (!isSender) {
                    List<EmailRecipient> recipients = emailRecipientRepository.findByEmail(email);
                    for (EmailRecipient recipient : recipients) {
                        if (userEmail.equals(recipient.getEmailRecipientAddress())) {
                            isRecipient = true;
                            role = "RECIPIENT";
                            userRecipient = recipient;
                            log.info("restoreEmailsFromTrash: 수신자 확인됨 - emailId={}, recipientAddress={}", 
                                    emailId, recipient.getEmailRecipientAddress());
                            break;
                        }
                    }
                }
                
                // 3. 발신자/수신자에 따라 다른 처리
                if (isSender) {
                    // 보낸메일함: Email 엔티티의 상태를 원래 상태로 복원
                    // emailSentTime이 있으면 SENT, 없으면 DRAFT로 복원
                    if (email.getEmailSentTime() != null) {
                        email.setEmailStatus(EmailStatusEnum.SENT);
                        email.setEmailFolder("SENT");
                        log.info("restoreEmailsFromTrash: 보낸메일함 - Email status restored to SENT - emailId={}", emailId);
                    } else {
                        email.setEmailStatus(EmailStatusEnum.DRAFT);
                        email.setEmailFolder("DRAFT");
                        log.info("restoreEmailsFromTrash: 보낸메일함 - Email status restored to DRAFT - emailId={}", emailId);
                    }
                    emailRepository.save(email);
                    emailRepository.flush();
                    emailStatusRestored++;
                } else if (isRecipient && userRecipient != null) {
                    // 받은메일함: EmailRecipient의 deleted를 false로 설정
                    userRecipient.setDeleted(false);
                    userRecipient.setDeletedAt(null);
                    emailRecipientRepository.save(userRecipient);
                    emailRecipientRepository.flush();
                    recipientRestored++;
                    log.info("restoreEmailsFromTrash: 받은메일함 - EmailRecipient deleted=false - emailId={}, recipientId={}", 
                            emailId, userRecipient.getEmailRecipientId());
                } else {
                    log.warn("restoreEmailsFromTrash: User {} is neither sender nor recipient of email {}", userEmail, emailId);
                    continue;
                }
                
                // 4. mail_user_visibility 테이블 업데이트 (deleted=false)
                Long mailId = emailId.longValue();
                Optional<MailUserVisibility> visibilityOpt = visibilityRepository.findByMailIdAndUserId(mailId, userId);
                
                if (visibilityOpt.isPresent()) {
                    MailUserVisibility visibility = visibilityOpt.get();
                    visibility.setDeleted(false);
                    visibility.setDeletedAt(null);
                    visibilityRepository.save(visibility);
                    visibilityRepository.flush();
                    visibilityRestored++;
                    log.info("restoreEmailsFromTrash: MailUserVisibility deleted=false - mailId={}, userId={}", mailId, userId);
                } else {
                    log.warn("restoreEmailsFromTrash: MailUserVisibility not found for mailId={}, userId={}", mailId, userId);
                }
                
            } catch (Exception e) {
                log.error("restoreEmailsFromTrash: Error processing emailId={}", emailId, e);
            }
        }
        
        log.info("restoreEmailsFromTrash: 완료 - restored {} Email rows, {} EmailRecipient rows, {} MailUserVisibility records for user {}", 
                emailStatusRestored, recipientRestored, visibilityRestored, userEmail);
    }

    @Override
    @Transactional
    public void deleteInboxMails(List<Integer> emailIds, String userEmail) {
        if (CollectionUtils.isEmpty(emailIds) || userEmail == null) {
            return;
        }
        
        LocalDateTime now = LocalDateTime.now();
        int deletedCount = 0;
        
        for (Integer emailId : emailIds) {
            // 해당 이메일의 수신자 중 현재 사용자에 해당하는 EmailRecipient 찾기
            com.goodee.coreconnect.email.entity.Email email = emailRepository.findById(emailId).orElse(null);
            if (email == null) continue;
            
            List<EmailRecipient> recipients = emailRecipientRepository.findByEmail(email);
            for (EmailRecipient recipient : recipients) {
                if (userEmail.equals(recipient.getEmailRecipientAddress()) && 
                    (recipient.getDeleted() == null || !recipient.getDeleted())) {
                    recipient.setDeleted(true);
                    recipient.setDeletedAt(now);
                    emailRecipientRepository.save(recipient);
                    deletedCount++;
                }
            }
        }
        
        log.info("deleteInboxMails: deleted {} EmailRecipient records for user {}", deletedCount, userEmail);
    }

    @Override
    @Transactional
    public void emptyTrash(String userEmail) {
        if (userEmail == null) return;
        // 1. userEmail → userId 변환 (반드시 Long 타입)
        Optional<User> userOpt = userRepository.findByEmail(userEmail);
        if (userOpt.isEmpty()) return;
        Long userId = userOpt.get().getId().longValue();

        // 2. mail_user_visibility 테이블에서 deleted=1행 전부 삭제(물리삭제) for 이 userId
        mailUserVisibilityRepository.deleteAllByUserIdAndDeletedIsTrue(userId);

        // 3. (option) 이메일 엔터티의 상태 UPDATE는 각 시스템 정책(공유메일 등) 따라 추가/생략(다수인 경우 삭제X)
        log.info("[emptyTrash] userId={} 본인 휴지통 레코드 완전삭제!", userId);
    }

    @Override
    @Transactional
    public DeleteMailsResponse deleteMailsForCurrentUser(DeleteMailsRequest req) {
    	 Long userId = getCurrentUserId();
    	    List<Long> success = new ArrayList<>();
    	    if (userId == null) {
    	        return new DeleteMailsResponse(success);
    	    }

    	    List<Long> toDelete = new ArrayList<>();
    	    for (Long mailId : req.getMailIds()) {
    	        // DB에서 mail의 sender_id 조회
    	        Long senderId = mailRepository.findSenderIdByMailId(mailId);

    	        String role = "RECIPIENT";
    	        if (senderId != null && senderId.equals(userId)) {
    	            role = "SENDER";
    	        }

    	        Optional<MailUserVisibility> opt = visibilityRepository.findByMailIdAndUserId(mailId, userId);

    	        MailUserVisibility toSave; // ← 반드시 선언!
    	        LocalDateTime now = LocalDateTime.now();

    	        if (opt.isPresent()) {
    	            MailUserVisibility existing = opt.get();
    	            toSave = MailUserVisibility.builder()
    	                    .id(existing.getId())
    	                    .mailId(existing.getMailId())
    	                    .userId(existing.getUserId())
    	                    .role(existing.getRole() != null ? existing.getRole() : role)
    	                    .deleted(true) // mark deleted
    	                    .deletedAt(now)
    	                    .createdAt(existing.getCreatedAt())
    	                    .build();
    	        } else {
    	            toSave = MailUserVisibility.builder()
    	                    .mailId(mailId)
    	                    .userId(userId)
    	                    .role(role)
    	                    .deleted(true)
    	                    .deletedAt(now)
    	                    .createdAt(now)
    	                    .build();
    	        }

    	        visibilityRepository.save(toSave); // 논리 삭제(여전히 남음)
    	        success.add(mailId);
    	        toDelete.add(mailId);
    	    }

    	    // ★ 실제 영구삭제(물리삭제) → mail_user_visibility에서 row 자체 제거
    	    if (!toDelete.isEmpty()) {
    	        visibilityRepository.deleteAllByMailIdInAndUserId(toDelete, userId);
    	    }

    	    return new DeleteMailsResponse(success);
    }


	/**
	 * 휴지통 목록 조회 (수신자 기준 -> 내부적으로 mail_user_visibility를 참조)
	 */

	@Override
	public Page<EmailResponseDTO> getTrashMails(String userEmail, int page, int size) {
	    // 1) userEmail -> userId 변환 (Long 타입으로)
	    Optional<User> userOpt = userRepository.findByEmail(userEmail);
	    if (userOpt.isEmpty()) {
	        Pageable emptyPageable = PageRequest.of(page, size);
	        log.warn("[getTrashMails] userId not found for email={}, return empty page", userEmail);
	        return Page.empty(emptyPageable).map(e -> (EmailResponseDTO) null);
	    }
	    
	    Integer userIntId = userOpt.get().getId();
	    Long userId = userIntId.longValue();
	    
	    log.info("[getTrashMails] 요청 userEmail={}, userId={}, page={}, size={}", userEmail, userId, page, size);

	    // 2) Pageable 설정
	    Pageable pageable = PageRequest.of(page, size);

	    // 3) repository에서 조회 (mail_user_visibility join 기반 nativeQuery를 사용)
	    // 주의: findTrashEmailsByUserId는 Integer를 받지만, 실제 DB는 Long이므로 변환 필요
	    Page<com.goodee.coreconnect.email.entity.Email> pageResult;
	    try {
	        pageResult = emailRepository.findTrashEmailsByUserId(userIntId, pageable);
	    } catch (Exception ex) {
	        log.error("[getTrashMails] repository 조회 중 예외 발생", ex);
	        Pageable emptyPageable = PageRequest.of(page, size);
	        return Page.empty(emptyPageable).map(e -> (EmailResponseDTO) null);
	    }

	    // 4) 상세 로그: total, 페이지 인덱스, 각 Email의 id/제목/발신자 등
	    log.info("[getTrashMails] 휴지통: totalElements={}, totalPages={}, currentPage={}",
	            pageResult.getTotalElements(), pageResult.getTotalPages(), pageResult.getNumber());

	    List<com.goodee.coreconnect.email.entity.Email> emailEntities = pageResult.getContent();
	    if (emailEntities == null || emailEntities.isEmpty()) {
	        log.info("[getTrashMails] 조회된 Email 엔티티가 없습니다. (page size={}, totalElements={})",
	                pageResult.getSize(), pageResult.getTotalElements());
	    } else {
	        // 상세 항목 로그
	        for (com.goodee.coreconnect.email.entity.Email e : emailEntities) {
	            try {
	                log.info("[getTrashMails] Email id={}, title='{}', senderId={}, senderEmail='{}', emailStatus={}, reservedAt={}",
	                        e.getEmailId(),
	                        e.getEmailTitle(),
	                        e.getSenderId(),
	                        e.getSenderEmail(),
	                        e.getEmailStatus(),
	                        e.getReservedAt());
	            } catch (Exception inner) {
	                log.warn("[getTrashMails] Email 엔티티 필드 접근 중 예외: {}", inner.getMessage());
	            }
	        }
	    }

	    // 5) DTO 변환 및 반환
	    Page<EmailResponseDTO> dtoPage = pageResult.map(this::toEmailResponseDTO);
	    // 6) DTO 상세 로그 (선택) - 최대 10개만
	    List<EmailResponseDTO> dtoSample = dtoPage.getContent().stream().limit(10).collect(Collectors.toList());
	    log.info("[getTrashMails] 반환할 DTO 샘플 (최대10): {}", dtoSample.stream()
	            .map(d -> String.format("id=%s,title=%s", d.getEmailId(), d.getEmailTitle()))
	            .collect(Collectors.joining("; ")));

	    return dtoPage;
	}
/**
 * 예약 메일 목록 조회 (수신자 기준, reservedAt이 미래인 항목)
 */

	// 예약 메일 조회 메서드에 debug 로그 추가 (getScheduledMails 이미 존재한다면 아래 로그를 추가)
	@Override
	public Page<EmailResponseDTO> getScheduledMails(String userEmail, int page, int size) {
	    Integer senderId = userRepository.findByEmail(userEmail).map(User::getId).orElse(null);
	    if (senderId == null) return Page.empty(PageRequest.of(page, size)).map(e -> (EmailResponseDTO) null);

	    Pageable pageable = PageRequest.of(page, size, Sort.by("reservedAt").descending());

	    Page<com.goodee.coreconnect.email.entity.Email> pageResult = emailRepository.findBySenderIdAndEmailStatusAndReservedAtAfter(
	            senderId,
	            EmailStatusEnum.RESERVED,
	            LocalDateTime.now(),
	            pageable
	    );

	    // Debug: 예약시간 존재 여부 확인
	    log.info("[getScheduledMails] senderId={}, totalElements={}, currentPage={}", senderId, pageResult.getTotalElements(), pageResult.getNumber());
	    for (com.goodee.coreconnect.email.entity.Email e : pageResult.getContent()) {
	        log.info("[getScheduledMails] mailId={}, title={}, reservedAt={}", e.getEmailId(), e.getEmailTitle(), e.getReservedAt());
	    }

	    return pageResult.map(this::toEmailResponseDTO);
	}

	@Override
	public Page<EmailResponseDTO> getFavoriteMails(String userEmail, int page, int size, String searchType, String keyword) {
	    // 페이징 객체 생성 (page: 0-base)
	    Pageable pageable = PageRequest.of(page, size);
	    List<String> types = List.of("TO", "CC", "BCC");
	    
	    String normalizedSearchType = normalizeSearchType(searchType);
	    String normalizedKeyword = normalizeKeyword(keyword);
	    
	    // 1. 수신한 중요 메일 조회
	    Page<EmailRecipient> recipientPage = emailRecipientRepository.findFavoriteInboxExcludingTrash(
	        userEmail, types, pageable, normalizedSearchType, normalizedKeyword
	    );
	    
	    // 2. 발신한 중요 메일 조회
	    User sender = userRepository.findByEmail(userEmail)
	        .orElseThrow(() -> new IllegalArgumentException("User not found by email: " + userEmail));
	    Integer senderId = sender.getId();
	    
	    Sort sort = Sort.by(Sort.Direction.DESC, "emailSentTime");
	    Pageable senderPageable = PageRequest.of(page, size, sort);
	    
	    // 발신한 중요 메일 조회
	    Page<Email> sentPage = emailRepository.findFavoriteSentMails(
	        senderId, senderPageable, normalizedSearchType, normalizedKeyword
	    );
	    
	    // 수신한 중요 메일을 Email 엔티티로 변환
	    List<Email> receivedEmails = recipientPage.stream()
	        .map(EmailRecipient::getEmail)
	        .distinct()
	        .collect(Collectors.toList());
	    
	    // 발신한 중요 메일 목록
	    List<Email> sentEmails = sentPage.getContent();
	    
	    // 두 목록을 합치고 중복 제거 (emailId 기준)
	    Map<Integer, Email> emailMap = new HashMap<>();
	    receivedEmails.forEach(email -> emailMap.put(email.getEmailId(), email));
	    sentEmails.forEach(email -> emailMap.put(email.getEmailId(), email));
	    
	    // 최신순으로 정렬
	    List<Email> allFavoriteEmails = emailMap.values().stream()
	        .sorted(Comparator.comparing(Email::getEmailSentTime, Comparator.nullsLast(Comparator.reverseOrder())))
	        .collect(Collectors.toList());
	    
	    // 페이징 처리
	    int start = (int) pageable.getOffset();
	    int end = Math.min((start + pageable.getPageSize()), allFavoriteEmails.size());
	    List<Email> pagedEmails = start < allFavoriteEmails.size() ? 
	        allFavoriteEmails.subList(start, end) : Collections.emptyList();
	    
	    // Email 엔티티를 DTO로 변환
	    List<EmailResponseDTO> dtoList = pagedEmails.stream()
	        .map(this::toEmailResponseDTO)
	        .collect(Collectors.toList());
	    
	    // 전체 개수는 수신 + 발신 (중복 제거 후)
	    long totalElements = emailMap.size();
	    
	    return new PageImpl<>(dtoList, pageable, totalElements);
	}

	/**
	 * Email 엔티티 → EmailResponseDTO 변환 헬퍼
	 */
	private EmailResponseDTO toEmailResponseDTO(com.goodee.coreconnect.email.entity.Email email) {
	    if (email == null) return null;
	
	    EmailResponseDTO response = new EmailResponseDTO();
	
	    response.setEmailId(email.getEmailId());
	    response.setEmailTitle(email.getEmailTitle());
	    response.setEmailContent(email.getEmailContent());
	    response.setSenderId(email.getSenderId());
	    response.setSenderEmail(email.getSenderEmail());
	    response.setSentTime(email.getEmailSentTime());
	    response.setEmailStatus(email.getEmailStatus() != null ? email.getEmailStatus().name() : null);
	    response.setReplyToEmailId(email.getReplyToEmailId());
	    // 고친 세터 이름: setReservedAt
	    response.setReservedAt(email.getReservedAt());
	
	    // 발신자 이름/부서 조회
	    if (email.getSenderId() != null) {
	        userRepository.findById(email.getSenderId())
	            .ifPresent(u -> {
	                response.setSenderName(u.getName());
	                response.setSenderDept(u.getDepartment() != null ? u.getDepartment().getDeptName() : null);
	            });
	    }
	
	    // 수신자 목록 조회
	    List<EmailRecipient> recipients = Collections.emptyList();
	    try {
	        recipients = emailRecipientRepository.findByEmail(email);
	    } catch (Exception ex) {
	        log.warn("[toEmailResponseDTO] recipients 조회 실패: {}", ex.getMessage());
	    }
	
	    List<EmailRecipient> toRecipients = recipients.stream()
	            .filter(r -> "TO".equalsIgnoreCase(r.getEmailRecipientType()))
	            .collect(Collectors.toList());
	    List<EmailRecipient> ccRecipients = recipients.stream()
	            .filter(r -> "CC".equalsIgnoreCase(r.getEmailRecipientType()))
	            .collect(Collectors.toList());
	    List<EmailRecipient> bccRecipients = recipients.stream()
	            .filter(r -> "BCC".equalsIgnoreCase(r.getEmailRecipientType()))
	            .collect(Collectors.toList());
	
	    response.setToRecipients(toRecipients);
	    response.setCcRecipients(ccRecipients);
	    response.setBccRecipients(bccRecipients);
	
	    response.setRecipientAddresses(
	            toRecipients.stream().map(EmailRecipient::getEmailRecipientAddress).filter(Objects::nonNull).collect(Collectors.toList())
	    );
	    response.setCcAddresses(
	            ccRecipients.stream().map(EmailRecipient::getEmailRecipientAddress).filter(Objects::nonNull).collect(Collectors.toList())
	    );
	    response.setBccAddresses(
	            bccRecipients.stream().map(EmailRecipient::getEmailRecipientAddress).filter(Objects::nonNull).collect(Collectors.toList())
	    );
	
	    // 첨부파일 조회
	    List<EmailFile> files = Collections.emptyList();
	    try {
	        files = emailFileRepository.findByEmail(email);
	    } catch (Exception ex) {
	        log.warn("[toEmailResponseDTO] attachments 조회 실패: {}", ex.getMessage());
	    }
	    List<AttachmentDTO> attachments = files.stream()
	            .map(f -> new AttachmentDTO(f.getEmailFileId(), f.getEmailFileName(), f.getEmailFileSize()))
	            .collect(Collectors.toList());
	    response.setAttachments(attachments);
	
	    response.setFileIds(files.stream().map(EmailFile::getEmailFileId).collect(Collectors.toList()));
	
	    return response;
	}
	
	
	
	
	
	
}
