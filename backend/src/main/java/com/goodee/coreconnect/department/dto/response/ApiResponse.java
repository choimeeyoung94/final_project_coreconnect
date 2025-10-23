package com.goodee.coreconnect.department.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data 
@AllArgsConstructor
public class ApiResponse<T> {
  
  private String message;
  private T data;

  public static <T> ApiResponse<T> ok(T data){ return new ApiResponse<>("OK", data); }

}
