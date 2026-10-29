package com.goodee.coreconnect.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;

import net.javacrumbs.shedlock.core.LockProvider;
import net.javacrumbs.shedlock.provider.redis.spring.RedisLockProvider;
import net.javacrumbs.shedlock.spring.annotation.EnableSchedulerLock;

/**
 * 스케줄 작업 잠금 (ShedLock, Redis)
 * - 서버(파드)가 여러 대면 @Scheduled 작업이 서버마다 동시에 돎 → @SchedulerLock을 붙인 작업은 잠금을 잡은 한 대만 실행
 * - 잠금은 이미 쓰는 Redis에 키로 둠(테이블이 필요 없어 운영 ddl-auto=validate에 영향 없음)
 * - defaultLockAtMostFor: 잠금을 잡은 서버가 죽어도 이 시간 뒤에는 풀림
 */
@Configuration
@EnableSchedulerLock(defaultLockAtMostFor = "PT30M")
public class SchedulerLockConfig {

	@Bean
	public LockProvider lockProvider(RedisConnectionFactory connectionFactory) {
		return new RedisLockProvider(connectionFactory, "coreconnect");
	}
}
