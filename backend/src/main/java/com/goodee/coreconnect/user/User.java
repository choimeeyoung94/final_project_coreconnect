package com.goodee.coreconnect.user;

import jakarta.persistence.*;
import lombok.*;

@Entity 
@Getter 
@Setter
@NoArgsConstructor 
@AllArgsConstructor 
@Builder
@Table(name="users")
public class User {
  
    @Id 
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique=true, nullable=false) 
    private String email;
    
    @Column(nullable=false) 
    private String password; // BCrypt 저장
    
    @Column(nullable=false) 
    private String name;
    
    @ManyToOne(fetch = FetchType.LAZY) 
    private Dept dept;
    
    @Enumerated(EnumType.STRING) 
    private Role role;

    public enum Role { ADMIN, MANAGER, USER }
}
