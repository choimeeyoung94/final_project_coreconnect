package com.goodee.coreconnect.notice;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity 
@Getter 
@Setter
@NoArgsConstructor 
@AllArgsConstructor 
@Builder
public class Notice {
  
    @Id 
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    private String category; // GENERAL, HR 등
    
    private String title;
    
    @Column(columnDefinition="TEXT") 
    private String content;
    
    private Long writerId;
    
    private LocalDateTime createdAt;
}
