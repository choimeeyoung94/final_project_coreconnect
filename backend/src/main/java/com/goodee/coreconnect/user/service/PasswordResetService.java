package com.goodee.coreconnect.user.service;

import java.util.List;

import com.goodee.coreconnect.admin.dto.request.PasswordResetRequestDTO;
import com.goodee.coreconnect.admin.dto.request.RejectLeaveRequestDTO;
import com.goodee.coreconnect.user.dto.response.PasswordResetResponseDTO;
import com.goodee.coreconnect.user.entity.User;

public interface PasswordResetService {
  
  public void createRequest(PasswordResetRequestDTO dto);
  public List<PasswordResetResponseDTO> getRequests(String status);
  public String approve(Long requestId, User admin);
  public void reject(Long requestId, User admin, RejectLeaveRequestDTO rejectReason);
}
