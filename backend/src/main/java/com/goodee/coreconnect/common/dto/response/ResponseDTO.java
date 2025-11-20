package com.goodee.coreconnect.common.dto.response;

import java.util.List;

import com.goodee.coreconnect.chat.dto.response.ChatUserResponseDTO;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString
public class ResponseDTO<T> {

	private int status;
	private String message;
	private T data;
	
	

    public static <T> ResponseDTO<T> success(T data, String message) {
        return ResponseDTO.<T>builder()
                .status(200)
                .message(message)
                .data(data)
                .build();
    }

    public static <T> ResponseDTO<T> badRequest(String message) {
        return ResponseDTO.<T>builder()
                .status(400)
                .message(message)
                .data(null)
                .build();
    }

    public static <T> ResponseDTO<T> internalError(String message) {
        return ResponseDTO.<T>builder()
                .status(500)
                .message(message)
                .data(null)
                .build();
    }

    public static <T> ResponseDTO<T> unauthorized() {
        return ResponseDTO.<T>builder()
                .status(401)
                .message("로그인이 필요합니다.")
                .data(null)
                .build();
    }

    public static <T> ResponseDTO<T> created(T data) {
        return ResponseDTO.<T>builder()
                .status(201)
                .message("생성 성공")
                .data(data)
                .build();
    }

    public static <T> ResponseDTO<T> unsupportedMediaType(String message) {
        return ResponseDTO.<T>builder()
                .status(415)
                .message(message)
                .data(null)
                .build();
    }

    public static <T> ResponseDTO<T> payloadTooLarge(String message) {
        return ResponseDTO.<T>builder()
                .status(413)
                .message(message)
                .data(null)
                .build();
    }

    public static <T> ResponseDTO<T> forbidden(String message) {
        return ResponseDTO.<T>builder()
                .status(403)
                .message(message)
                .data(null)
                .build();
    }
}	
