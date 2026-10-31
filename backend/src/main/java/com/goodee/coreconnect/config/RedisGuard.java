package com.goodee.coreconnect.config;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicLong;

import org.springframework.stereotype.Component;

/**
 * Redis 장애 때 요청마다 대기 시간만큼 멈추지 않도록, 실패하면 잠시 Redis 호출을 건너뛴다
 *
 * - 채팅 전송 한 번에 Redis 호출이 여러 번 있어, 건너뛰지 않으면 대기 시간이 호출 수만큼 쌓인다
 * - 건너뛰는 시간이 지나면 다시 시도한다. Redis가 복구되어 있으면 그때부터 정상으로 돌아간다
 */
@Component
public class RedisGuard {

  static final long SKIP_MILLIS = Duration.ofSeconds(10).toMillis();

  private final AtomicLong skipUntil = new AtomicLong();

  public boolean available() {
    return System.currentTimeMillis() >= skipUntil.get();
  }

  public void failed() {
    skipUntil.set(System.currentTimeMillis() + SKIP_MILLIS);
  }
}
