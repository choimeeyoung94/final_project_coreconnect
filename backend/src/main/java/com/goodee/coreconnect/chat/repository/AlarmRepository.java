package com.goodee.coreconnect.chat.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.goodee.coreconnect.chat.entity.Alarm;

public interface AlarmRepository extends JpaRepository<Alarm, Integer> {
	
}
