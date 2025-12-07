package com.goodee.coreconnect.email.sendGrid;

import java.io.IOException;
import java.util.Base64;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.goodee.coreconnect.email.dto.request.EmailSendRequestDTO;
import com.sendgrid.Method;
import com.sendgrid.Request;
import com.sendgrid.Response;
import com.sendgrid.SendGrid;
import com.sendgrid.helpers.mail.Mail;
import com.sendgrid.helpers.mail.objects.Attachments;
import com.sendgrid.helpers.mail.objects.Content;
import com.sendgrid.helpers.mail.objects.Email;
import com.sendgrid.helpers.mail.objects.Personalization;

/**
 * SendGridEmailSender
 * - Spring Bean으로 주입하여 EmailServiceImpl에서 호출 가능합니다.
 * - EmailSendRequestDTO 의 구조(필드명)를 기준으로 본문/수신자/제목을 채웁니다.
 */
@Component
public class SendGridEmailSender {

    @Value("${sendgrid.api.key}")
    private String sendgridApiKey;

    @Value("${sendgrid.from.email}")
    private String defaultFromEmail;

    @Value("${sendgrid.from.name}")
    private String defaultFromName;

    @Value("${sendgrid.reply.to}")
    private String defaultReplyTo;

    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Send email via SendGrid
     * @param requestDTO EmailSendRequestDTO (recipientAddress, ccAddresses, bccAddresses, emailTitle, emailContent, reservedAt 등)
     * @param attachments MultipartFile 첨부파일 리스트 (nullable)
     * @return SendGrid Response (status code, body) - 필요시 반환값 처리
     * @throws IOException on send error
     */
    public Response send(EmailSendRequestDTO requestDTO, List<MultipartFile> attachments) throws IOException {
        // Build Mail
        // FROM: 시스템 발신 주소 (SendGrid 인증된 주소)
        Email from = new Email(defaultFromEmail, defaultFromName);
        
        String subject = requestDTO.getEmailTitle() != null ? requestDTO.getEmailTitle() : "(No subject)";
        Mail mail = new Mail();
        mail.setFrom(from);
        mail.setSubject(subject);

        // Content (use HTML if you prefer)
        String htmlContent = requestDTO.getEmailContent() == null ? "" : requestDTO.getEmailContent();
        // If you want plain text also, you can add another Content
        Content content = new Content("text/html", htmlContent);
        mail.addContent(content);

        // Personalization (TO/CC/BCC)
        Personalization personalization = new Personalization();
        if (requestDTO.getRecipientAddress() != null) {
            for (String toAddr : requestDTO.getRecipientAddress()) {
                if (toAddr != null && !toAddr.isBlank()) {
                    personalization.addTo(new Email(toAddr));
                }
            }
        }
        if (requestDTO.getCcAddresses() != null) {
            for (String cc : requestDTO.getCcAddresses()) {
                if (cc != null && !cc.isBlank()) personalization.addCc(new Email(cc));
            }
        }
        if (requestDTO.getBccAddresses() != null) {
            for (String bcc : requestDTO.getBccAddresses()) {
                if (bcc != null && !bcc.isBlank()) personalization.addBcc(new Email(bcc));
            }
        }
        mail.addPersonalization(personalization);

        // Attachments
        if (attachments != null && !attachments.isEmpty()) {
            for (MultipartFile file : attachments) {
                if (file == null || file.isEmpty()) continue;
                Attachments sendGridAtt = new Attachments();
                sendGridAtt.setFilename(file.getOriginalFilename());
                String encoded = Base64.getEncoder().encodeToString(file.getBytes());
                sendGridAtt.setContent(encoded);
                sendGridAtt.setType(file.getContentType() != null ? file.getContentType() : "application/octet-stream");
                sendGridAtt.setDisposition("attachment");
                mail.addAttachments(sendGridAtt);
            }
        }

        // Optional: Add custom headers or reply-to
        // Reply-To 주소 동적 설정
        String replyToAddress = defaultReplyTo;
        
        // 1순위: 실제 발신자 이메일 (senderAddress) 사용
        if (requestDTO.getSenderAddress() != null && !requestDTO.getSenderAddress().isBlank()) {
            replyToAddress = requestDTO.getSenderAddress();
        }
        // 2순위: 답장 원본 이메일 (replyToEmailId)이 있으면 사용
        else if (requestDTO.getReplyToEmailId() != null && !requestDTO.getReplyToEmailId().isBlank()) {
            // replyToEmailId가 이메일 주소 형식이면 그대로 사용
            replyToAddress = requestDTO.getReplyToEmailId();
        }
        
        mail.setReplyTo(new Email(replyToAddress));

        // Send using SendGrid client
        SendGrid sg = new SendGrid(sendgridApiKey);
        Request request = new Request();
        request.setMethod(Method.POST);
        request.setEndpoint("mail/send");

        // use Mail.build() to create JSON
        request.setBody(mail.build());
        Response response = sg.api(request);

        // Optionally log response
        // log.info("[SendGrid] statusCode={}, body={}", response.getStatusCode(), response.getBody());
        return response;
    }
}