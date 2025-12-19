package com.goodee.coreconnect.config;

import java.util.concurrent.Executor;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
@EnableAsync   // 비동기 기능 활성화
public class AsyncConfig {
  @Bean(name = "asyncTaskExecutor")
  public Executor asyncTaskExecutor() {
      ThreadPoolTaskExecutor exec = new ThreadPoolTaskExecutor();
      exec.setCorePoolSize(4);
      exec.setMaxPoolSize(8);
      exec.setQueueCapacity(100);
      exec.setThreadNamePrefix("async-");
      exec.initialize();
      return exec;
  }
}
