package com.goodee.coreconnect.user.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.goodee.coreconnect.user.entity.User;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
}