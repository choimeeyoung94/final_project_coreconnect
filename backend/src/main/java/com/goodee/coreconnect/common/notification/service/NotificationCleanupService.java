package com.goodee.coreconnect.common.notification.service;

import java.time.LocalDateTime;
import java.util.function.BiFunction;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import com.goodee.coreconnect.chat.repository.NotificationRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;

/**
 * 알림 정리
 * - 읽은 알림: 처음 읽은 시각(notification_read_at)부터 30일 지나면 지움. 다시 눌러도 읽은 시각은 바뀌지 않음(NotificationService.markAsRead)
 * - 안 읽은 알림: 온 시각(notification_sent_at)부터 90일 지나면 지움
 * - 한 번에 많이 지우면 잠금·로그가 커지므로 BATCH개씩 나눠 트랜잭션을 따로 커밋
 * - 서버 여러 대: ShedLock으로 한 대만 실행 (SchedulerLockConfig)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationCleanupService {

	public static final String LOCK_NAME = "notification-cleanup";
	static final int READ_RETENTION_DAYS = 30;
	static final int UNREAD_RETENTION_DAYS = 90;
	private static final int BATCH = 1000;

	private final NotificationRepository notificationRepository;
	private final TransactionTemplate transactionTemplate;

	/** 매일 새벽 3시 (서버 시간대) */
	@Scheduled(cron = "0 0 3 * * *")
	@SchedulerLock(name = LOCK_NAME, lockAtMostFor = "PT30M", lockAtLeastFor = "PT1M")
	public void scheduledCleanup() {
		int read = deleteInBatches(LocalDateTime.now().minusDays(READ_RETENTION_DAYS), notificationRepository::deleteReadBefore);
		int unread = deleteInBatches(LocalDateTime.now().minusDays(UNREAD_RETENTION_DAYS), notificationRepository::deleteUnreadSentBefore);
		log.info("[NotificationCleanup] 읽은 지 {}일 지난 알림 {}개, 온 지 {}일 지난 안 읽은 알림 {}개 삭제",
				READ_RETENTION_DAYS, read, UNREAD_RETENTION_DAYS, unread);
	}

	/** 기준 시각보다 오래된 알림을 BATCH개씩 지우고 지운 개수 반환 */
	private int deleteInBatches(LocalDateTime cutoff, BiFunction<LocalDateTime, Integer, Integer> deleteBatch) {
		int total = 0;
		while (true) {
			Integer n = transactionTemplate.execute(status -> deleteBatch.apply(cutoff, BATCH));
			int deleted = n == null ? 0 : n;
			total += deleted;
			if (deleted < BATCH) {
				return total;
			}
		}
	}
}
