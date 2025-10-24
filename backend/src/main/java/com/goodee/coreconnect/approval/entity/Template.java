package com.goodee.coreconnect.approval.entity;

import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;

import com.goodee.coreconnect.user.entity.User;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Getter
@NoArgsConstructor
@Table(name = "template")
public class Template {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  @Column(name = "temp_id")
  private Long id;
  
  @Column(name = "temp_name", nullable = false, length = 100)
  private String templateName;
  
  @Column(name = "temp_content", columnDefinition = "TEXT")
  private String templateContent;
  
  @Column(name = "active_yn", nullable = false)
  private boolean activeYn = true;
  
  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private LocalDateTime createdAt;
  
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "user_id")
  private User user;
  
}
