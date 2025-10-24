package com.goodee.coreconnect.user.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
@Table(
    name = "users", 
    indexes = {
        @Index(name = "idx_user_email", columnList = "user_email"),
    },
    uniqueConstraints = {
        @UniqueConstraint(name = "uk_user_email", columnNames = "user_email")
    }
)
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "user_id")
    private Integer id;

    // BCrypt 저장 (보통 60자) — 스키마를 VARCHAR(60) 이상으로 맞추세요
    @Column(name = "user_password", length = 100, nullable = false)
    private String password;

    @Column(name = "user_name", length = 255, nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "user_role", length = 10, nullable = false)
    private Role role; // ADMIN / MANAGER / USER 등

    @Column(name = "user_email", length = 255, nullable = false)
    private String email;

    @Column(name = "user_phone", length = 15)
    private String phone;

    @Column(name = "user_join_date")
    private LocalDateTime joinDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "user_status", length = 20, nullable = false)
    private Status status; // ACTIVE, INACTIVE 등

    public enum Role { ADMIN, MANAGER, USER }
    public enum Status { ACTIVE, INACTIVE, SUSPENDED }
}
