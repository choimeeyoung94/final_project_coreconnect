package com.goodee.coreconnect.common.exception;

/**
 * 파일 업로드 실패 시 발생하는 예외
 * (S3 업로드, 로컬 저장 등)
 */
public class FileUploadException extends RuntimeException {

    public FileUploadException(String message) {
        super(message);
    }

    public FileUploadException(String message, Throwable cause) {
        super(message, cause);
    }

    public FileUploadException(Throwable cause) {
        super("파일 업로드 중 오류가 발생했습니다.", cause);
    }
}
