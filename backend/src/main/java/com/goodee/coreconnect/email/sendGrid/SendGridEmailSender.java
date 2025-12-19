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
import com.sendgrid.helpers.mail.objects.TrackingSettings;
import com.sendgrid.helpers.mail.objects.ClickTrackingSetting;
import com.sendgrid.helpers.mail.objects.OpenTrackingSetting;

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

        // Content (HTML + Plain Text for better deliverability)
        String htmlContent = requestDTO.getEmailContent() == null ? "" : requestDTO.getEmailContent();
        
        // ⭐ 스팸 방지를 위한 HTML 래핑 (DOCTYPE + 적절한 구조)
        String htmlWrapped = "<!DOCTYPE html>" +
                "<html lang='ko'>" +
                "<head>" +
                "<meta charset='UTF-8'>" +
                "<meta name='viewport' content='width=device-width, initial-scale=1.0'>" +
                "<title>" + (requestDTO.getEmailTitle() != null ? requestDTO.getEmailTitle() : "CoreConnect") + "</title>" +
                "</head>" +
                "<body style='font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;'>" +
                htmlContent +
                "</body>" +
                "</html>";
        
        // 회사 정보 푸터 추가 (스팸 필터 우회 + 신뢰도 향상 + CAN-SPAM 준수)
        String footer = "<hr style='border:none; border-top:1px solid #e0e0e0; margin:30px 0;'>" +
                "<div style='color:#666; font-size:12px; line-height:1.6;'>" +
                "<p><strong>CoreConnect</strong><br>" +
                "Enterprise Collaboration Platform<br>" +
                "📧 Email: admin@coreconnect.io.kr<br>" +
                "🌐 Website: <a href='http://coreconnect.io.kr' style='color:#0066cc; text-decoration:none;'>coreconnect.io.kr</a><br>" +
                "📍 Address: 서울특별시 구로구 디지털로34길 27, 대륭포스트타워 7차 401호</p>" +  // ⭐ 실제 주소로 변경 필요
                "<p style='font-size:11px; color:#999; margin-top:15px;'>" +
                "본 메일은 CoreConnect 시스템에서 발송되었습니다.<br>" +
                "수신을 원하지 않으시면 <a href='http://coreconnect.io.kr/unsubscribe' style='color:#0066cc;'>여기</a>를 클릭하거나 " +
                "시스템 설정에서 알림을 변경하실 수 있습니다.</p>" +
                "</div>";
        
        String htmlWithFooter = htmlWrapped.replace("</body>", footer + "</body>");
        
        // 1) Plain text version (스팸 필터 우회용)
        String plainText = htmlWithFooter
            .replaceAll("<[^>]*>", "")  // HTML 태그 제거
            .replaceAll("&nbsp;", " ")
            .replaceAll("&lt;", "<")
            .replaceAll("&gt;", ">")
            .replaceAll("&amp;", "&")
            .trim();
        Content textContent = new Content("text/plain", plainText);
        mail.addContent(textContent);
        
        // 2) HTML version (푸터 포함)
        Content htmlContentObj = new Content("text/html", htmlWithFooter);
        mail.addContent(htmlContentObj);

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

        // ⭐ 스팸 방지: 추적 및 카테고리 설정
        // Categories: SendGrid 통계 및 평판 관리용
        mail.addCategory("coreconnect-email");
        if (requestDTO.getReplyToEmailId() != null) {
            mail.addCategory("reply");
        } else {
            mail.addCategory("new-email");
        }
        
        // ⭐ 추적 설정 (열람/클릭 추적 - 스팸 필터에 긍정적)
        TrackingSettings trackingSettings = new TrackingSettings();
        ClickTrackingSetting clickTrackingSetting = new ClickTrackingSetting();
        clickTrackingSetting.setEnable(true);
        clickTrackingSetting.setEnableText(false);
        trackingSettings.setClickTrackingSetting(clickTrackingSetting);
        
        OpenTrackingSetting openTrackingSetting = new OpenTrackingSetting();
        openTrackingSetting.setEnable(true);
        trackingSettings.setOpenTrackingSetting(openTrackingSetting);
        mail.setTrackingSettings(trackingSettings);

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