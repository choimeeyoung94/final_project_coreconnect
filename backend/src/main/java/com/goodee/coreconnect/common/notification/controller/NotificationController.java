package com.goodee.coreconnect.common.notification.controller;

import java.security.Principal;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Slice;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.goodee.coreconnect.chat.dto.response.NotificationReadResponseDTO;
import com.goodee.coreconnect.chat.dto.response.UnreadNotificationListDTO;
import com.goodee.coreconnect.chat.repository.NotificationRepository;
import com.goodee.coreconnect.common.entity.Notification;
import com.goodee.coreconnect.common.dto.response.ResponseDTO;
import com.goodee.coreconnect.common.notification.dto.NotificationSendRequestDTO;
import com.goodee.coreconnect.common.notification.service.NotificationService;
import com.goodee.coreconnect.security.userdetails.CustomUserDetails;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.repository.UserRepository;

import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RequiredArgsConstructor
@RequestMapping("/api/v1/notification")
@RestController
public class NotificationController {
	private final NotificationService notificationService;
	private final UserRepository userRepository;
	private final NotificationRepository notificationRepository;

	/** 알림 읽음 처리 (채팅·결재·메일·일정 알림 공통, 예전 /api/v1/chat/notifications/{id}/read 를 합침) */
	@Operation(summary = "알림 읽음 처리", description = "본인 알림 1개를 읽음 처리합니다. 이미 읽은 알림은 그대로 둡니다.")
    @PutMapping("/{notificationId}/read")
	public ResponseEntity<ResponseDTO<NotificationReadResponseDTO>> markNotificationRead(
        @PathVariable("notificationId") Integer notificationId,
        @AuthenticationPrincipal CustomUserDetails loginUser
    ) {
        NotificationReadResponseDTO result = notificationService.markAsRead(notificationId, loginUser.getId());
        return ResponseEntity.ok(ResponseDTO.success(result, "알림 읽음 처리 성공"));
    }

	/**
	 * 내 알림 목록 한 페이지 (종 아이콘 "안 읽은 알림 / 전체 알림" 탭, 대시보드 카드)
	 * - status=unread: 안 읽은 것만, status=all: 읽은 것도 (항목마다 readYn으로 구분)
	 * - 최신순, size는 최대 50. 응답 data = {content, page, last}
	 */
	@Operation(summary = "내 알림 목록", description = "안 읽은 알림 또는 전체 알림을 최신순으로 한 페이지씩 조회합니다.")
	@GetMapping
	public ResponseEntity<ResponseDTO<Map<String, Object>>> myNotifications(
			@RequestParam(value = "status", defaultValue = "unread") String status,
			@RequestParam(value = "page", defaultValue = "0") int page,
			@RequestParam(value = "size", defaultValue = "20") int size,
			@AuthenticationPrincipal CustomUserDetails loginUser) {
		Slice<Notification> slice = notificationRepository.findPageForUser(loginUser.getId(), !"all".equals(status),
				PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 50)));
		Map<String, Object> data = new LinkedHashMap<>();
		data.put("content", slice.getContent().stream().map(UnreadNotificationListDTO::from).toList());
		data.put("page", slice.getNumber());
		data.put("last", slice.isLast());
		return ResponseEntity.ok(ResponseDTO.success(data, "알림 목록 조회 성공"));
	}

	@Operation(summary = "알림 수동 발송", description = "외부 시스템에서 알림을 수동 발송합니다.")
	@PostMapping("/send")
	public ResponseEntity<?> sendNotification(@RequestBody NotificationSendRequestDTO dto, Principal principal) {
	    if (principal == null) {
	         return ResponseEntity.status(401).build();
	    }
	    // senderEmail: principal.getName()이 email이라고 가정
	    String senderEmail = principal.getName();
	     
        // UserRepository를 통해 sender 정보 조회 (UserRepository를 주입받아야 함)
        User sender = userRepository.findByEmail(senderEmail)
         .orElseThrow(() -> new IllegalArgumentException("발신자 정보를 찾을 수 없습니다: " + senderEmail));
        Integer senderId = sender.getId();
        String senderName = sender.getName();

        notificationService.sendNotification(
	         dto.getRecipientId(),
	         dto.getType(),
	         dto.getMessage(),
	         dto.getChatId(),
	         dto.getRoomId(),
	         senderId,
	         senderName,
	         null
	    );
        return ResponseEntity.ok().build();
	 }
	
	
}
