package com.goodee.coreconnect.user.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.goodee.coreconnect.user.entity.User;

public interface UserRepository extends JpaRepository<User, Long> {

}
