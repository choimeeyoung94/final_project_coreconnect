package com.goodee.coreconnect.approval.entity;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import org.hibernate.annotations.CreationTimestamp;

import com.goodee.coreconnect.approval.enums.DocumentStatus;
import com.goodee.coreconnect.user.entity.User;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.Getter;

@Entity
@Getter
@Table(name = "document")
public class Document {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  @Column(name = "doc_id")
  private Long id;

  @Column(name = "doc_title", nullable = false, length = 30)
  private String documentTitle;

  @Column(name = "doc_content", columnDefinition = "TEXT")
  private String documentContent;

  @Enumerated(EnumType.STRING)
  @Column(name = "doc_status", nullable = false, length = 20)
  private DocumentStatus documentStatus = DocumentStatus.DRAFT;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private LocalDateTime createdAt;

  @Column(name = "completed_at")
  private LocalDateTime completedAt;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "user_id", nullable = false)
  private User user;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "temp_id", nullable = false)
  private Template template;

  @OneToMany(mappedBy = "document", cascade = CascadeType.ALL, orphanRemoval = true)
  private List<ApprovalLine> approvalLines = new ArrayList<>();

  @OneToMany(mappedBy = "document", cascade = CascadeType.ALL, orphanRemoval = true)
  private List<File> files = new ArrayList<>();
  
  protected Document() {};

  // new Document()
  
  // public Document(Template template, User user, String documentTitle, String documentContent) {
  //   this.template = template;
  // }
  
  // Document.createDocument()
  
  public static Document createDocument(Template template, User user, String documentTitle, String documentContent) {
    Document d = new Document();
    d.template = template;
    d.user = user;
    d.documentTitle = documentTitle;
    d.documentContent = documentContent;
    return d;
  }
  
}
