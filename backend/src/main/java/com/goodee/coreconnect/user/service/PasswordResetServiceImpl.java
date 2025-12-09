package com.goodee.coreconnect.user.service;

import java.security.SecureRandom;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.goodee.coreconnect.admin.dto.request.PasswordResetRequestDTO;
import com.goodee.coreconnect.admin.dto.request.RejectLeaveRequestDTO;
import com.goodee.coreconnect.admin.service.MailService;
import com.goodee.coreconnect.user.dto.response.PasswordResetResponseDTO;
import com.goodee.coreconnect.user.entity.PasswordResetRequest;
import com.goodee.coreconnect.user.entity.User;
import com.goodee.coreconnect.user.enums.ResetStatus;
import com.goodee.coreconnect.user.repository.PasswordResetRequestRepository;
import com.goodee.coreconnect.user.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class PasswordResetServiceImpl implements PasswordResetService {
  
  private final UserRepository userRepository;
  private final PasswordResetRequestRepository passwordResetRequestRepository;
  private final PasswordEncoder passwordEncoder;
  private final MailService mailService;

  /** 비밀번호 변경 요청을 생성하는 메소드 */
  @Override
  public void createRequest(PasswordResetRequestDTO dto) {
    User user = userRepository.findByEmail(dto.email())
        .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 이메일입니다."));

    if (!user.getName().equals(dto.name())) {
        throw new IllegalArgumentException("이름이 일치하지 않습니다.");
    }

    // 이미 대기 중인 요청이 있는지 확인
    List<PasswordResetRequest> pendingRequests = passwordResetRequestRepository.findByUserAndStatus(user, ResetStatus.PENDING);
    if (!pendingRequests.isEmpty()) {
        throw new IllegalStateException("이미 대기 중인 비밀번호 초기화 요청이 있습니다. 관리자의 승인을 기다려주세요.");
    }

    PasswordResetRequest req = dto.toEntity(user);
    passwordResetRequestRepository.save(req);
    
  }

  /** 비밀번호 변경 요청 목록을 조회하는 메소드 (관리자용) */
  @Override
  @Transactional(readOnly = true)
  public List<PasswordResetResponseDTO> getRequests(String status) {
    List<PasswordResetRequest> requests;
    
    if(status == null || status.isBlank()) {
      requests = passwordResetRequestRepository.findAllByOrderByCreatedAtDesc();
    } else {
      ResetStatus resetStatus = ResetStatus.valueOf(status.toUpperCase());
      requests = passwordResetRequestRepository.findByStatusOrderByCreatedAtDesc(resetStatus);
    }
    
    return requests.stream()
                   .map(PasswordResetResponseDTO::fromEntity)
                   .collect(Collectors.toList());
  }

  /** 승인 처리 - 랜덤 비밀번호 생성 후 외부 이메일 주소 반환 */
  @Override
  public String approve(Long requestId, User admin) {
    PasswordResetRequest req = passwordResetRequestRepository.findById(requestId)
                                                             .orElseThrow(() -> new IllegalArgumentException("요청을 찾을 수 없습니다."));
    if(req.getStatus() != ResetStatus.PENDING) {
      throw new IllegalStateException("이미 처리된 요청입니다.");
    }
    User user = req.getUser();
    
    // 외부 이메일 확인
    String externalEmail = null;
    if (user.getUserDetailProfile() != null) {
      externalEmail = user.getUserDetailProfile().getExternalEmail();
    }
    
    if (externalEmail == null || externalEmail.isBlank()) {
      throw new IllegalStateException("연결된 외부 이메일이 없습니다. 사용자 프로필에 외부 이메일을 등록해주세요.");
    }
    
    // 랜덤 임시 비밀번호 생성
    String tempPassword = generateTempPassword(5); // 비밀번호 길이: 5자리
    
    // 유저 비밀번호 변경
    user.changePassword(passwordEncoder.encode(tempPassword));
    
    // 요청 엔티티 상태 변경
    req.approve(admin);
    
    // 외부 이메일로 발송
    mailService.sendTempPassword(externalEmail, tempPassword);
    
    // 외부 이메일 주소 반환
    return externalEmail;
  }
  
  /** 거절 처리 */
  @Override
  public void reject(Long requestId, User admin, RejectLeaveRequestDTO rejectReason) {
    PasswordResetRequest req = passwordResetRequestRepository.findById(requestId)
        .orElseThrow(() -> new IllegalArgumentException("요청을 찾을 수 없습니다."));
    if(req.getStatus() != ResetStatus.PENDING) {
      throw new IllegalStateException("이미 처리된 요청입니다.");
    }
    
    // 요청 엔티티 상태 변경
    req.reject(admin, rejectReason);
  }
  
  /** 랜덤 비밀번호 생성 유틸 */
  private String generateTempPassword(int length) {
      String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
      SecureRandom random = new SecureRandom();
      StringBuilder sb = new StringBuilder();

      for (int i = 0; i < length; i++) {
          int idx = random.nextInt(chars.length());
          sb.append(chars.charAt(idx));
      }

      return sb.toString();
  }
  
  

}
