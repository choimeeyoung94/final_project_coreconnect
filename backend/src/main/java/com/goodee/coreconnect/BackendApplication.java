package com.goodee.coreconnect;

import java.util.TimeZone;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

import jakarta.annotation.PostConstruct;

@SpringBootApplication
@EnableScheduling
public class BackendApplication {

	@PostConstruct
	public void init() {
		// 애플리케이션 시작 시 기본 타임존을 한국 시간(Asia/Seoul)으로 설정
		TimeZone.setDefault(TimeZone.getTimeZone("Asia/Seoul"));
		System.setProperty("user.timezone", "Asia/Seoul");
	}

	public static void main(String[] args) {
		// JVM 기본 타임존 설정
		TimeZone.setDefault(TimeZone.getTimeZone("Asia/Seoul"));
		System.setProperty("user.timezone", "Asia/Seoul");
		
		SpringApplication.run(BackendApplication.class, args);
	}

}
