package com.goodee.coreconnect.common.notification.controller;

import java.security.Principal;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.goodee.coreconnect.chat.dto.response.NotificationReadResponseDTO;
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
