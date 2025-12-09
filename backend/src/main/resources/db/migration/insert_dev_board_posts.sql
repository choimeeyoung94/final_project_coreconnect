-- 개발 부서 게시판에 더미 게시글 5개 추가
-- 실행 전 확인 사항:
-- 1. 개발 부서(부서명: '개발')가 존재하는지 확인
-- 2. 개발 부서에 속한 사용자가 최소 1명 이상 있는지 확인
-- 3. 개발 부서에 연결된 게시판 카테고리가 존재하는지 확인
-- 
-- 사용법: MySQL Workbench나 터미널에서 직접 실행하세요.
-- 날짜는 실행 시점의 오늘 날짜로 자동 설정됩니다.

-- 게시글 1: 2025년 상반기 개발 일정 공유
INSERT INTO board (
    board_title,
    board_content,
    board_notice_yn,
    board_pinned_yn,
    board_private_yn,
    board_view_count,
    board_created_at,
    board_updated_at,
    board_deleted_yn,
    user_id,
    category_id
) VALUES (
    '2025년 상반기 개발 일정 공유',
    '안녕하세요. 2025년 상반기 개발 일정을 공유드립니다.

주요 마일스톤:
- 1월: 사용자 인증 시스템 개선
- 2월: 실시간 알림 기능 추가
- 3월: 모바일 최적화 작업

각 팀별 세부 일정은 별도로 공유하겠습니다.

문의사항이 있으시면 언제든지 말씀해주세요.',
    0,
    0,
    0,
    0,
    CONCAT(DATE(NOW()), ' 09:00:00'),
    NULL,
    0,
    (SELECT u.user_id FROM users u INNER JOIN department d ON u.dept_id = d.dept_id WHERE d.dept_name = '개발' LIMIT 1),
    (SELECT d.board_category_id FROM department d WHERE d.dept_name = '개발' LIMIT 1)
);

-- 게시글 2: 코드 리뷰 가이드라인 업데이트 안내
INSERT INTO board (
    board_title,
    board_content,
    board_notice_yn,
    board_pinned_yn,
    board_private_yn,
    board_view_count,
    board_created_at,
    board_updated_at,
    board_deleted_yn,
    user_id,
    category_id
) VALUES (
    '코드 리뷰 가이드라인 업데이트 안내',
    '코드 리뷰 프로세스에 대한 가이드라인을 업데이트했습니다.

변경 사항:
1. PR 생성 시 체크리스트 필수 작성
2. 최소 2명 이상의 승인 필요
3. 자동화 테스트 통과 확인 필수

새로운 가이드라인은 위키 페이지에 업로드했습니다.
확인 부탁드리며, 의견이 있으시면 언제든지 알려주세요.',
    0,
    0,
    0,
    0,
    CONCAT(DATE(NOW()), ' 10:30:00'),
    NULL,
    0,
    (SELECT u.user_id FROM users u INNER JOIN department d ON u.dept_id = d.dept_id WHERE d.dept_name = '개발' LIMIT 1),
    (SELECT d.board_category_id FROM department d WHERE d.dept_name = '개발' LIMIT 1)
);

-- 게시글 3: 신규 개발 환경 구축 방법
INSERT INTO board (
    board_title,
    board_content,
    board_notice_yn,
    board_pinned_yn,
    board_private_yn,
    board_view_count,
    board_created_at,
    board_updated_at,
    board_deleted_yn,
    user_id,
    category_id
) VALUES (
    '신규 개발 환경 구축 방법',
    '신규 입사하신 분들을 위한 개발 환경 구축 가이드를 공유합니다.

필수 설치 프로그램:
- JDK 17 이상
- IntelliJ IDEA 또는 VSCode
- Docker Desktop
- MySQL 8.0

상세한 설치 가이드는 회사 위키를 참고해주세요.
환경 설정 중 문제가 발생하면 언제든지 연락 주세요.',
    0,
    0,
    0,
    0,
    CONCAT(DATE(NOW()), ' 11:15:00'),
    NULL,
    0,
    (SELECT u.user_id FROM users u INNER JOIN department d ON u.dept_id = d.dept_id WHERE d.dept_name = '개발' LIMIT 1),
    (SELECT d.board_category_id FROM department d WHERE d.dept_name = '개발' LIMIT 1)
);

-- 게시글 4: 배포 자동화 프로세스 개선 완료
INSERT INTO board (
    board_title,
    board_content,
    board_notice_yn,
    board_pinned_yn,
    board_private_yn,
    board_view_count,
    board_created_at,
    board_updated_at,
    board_deleted_yn,
    user_id,
    category_id
) VALUES (
    '배포 자동화 프로세스 개선 완료',
    'CI/CD 파이프라인을 개선하여 배포 프로세스를 자동화했습니다.

개선 사항:
- 자동 테스트 실행
- 스테이징 환경 자동 배포
- 프로덕션 배포 승인 프로세스 추가

이제 더 빠르고 안정적인 배포가 가능합니다.
배포 관련 문의사항은 DevOps 팀으로 연락 부탁드립니다.',
    0,
    0,
    0,
    0,
    CONCAT(DATE(NOW()), ' 14:20:00'),
    NULL,
    0,
    (SELECT u.user_id FROM users u INNER JOIN department d ON u.dept_id = d.dept_id WHERE d.dept_name = '개발' LIMIT 1),
    (SELECT d.board_category_id FROM department d WHERE d.dept_name = '개발' LIMIT 1)
);

-- 게시글 5: 주간 스프린트 회의 일정 변경 안내
INSERT INTO board (
    board_title,
    board_content,
    board_notice_yn,
    board_pinned_yn,
    board_private_yn,
    board_view_count,
    board_created_at,
    board_updated_at,
    board_deleted_yn,
    user_id,
    category_id
) VALUES (
    '주간 스프린트 회의 일정 변경 안내',
    '주간 스프린트 회의 일정이 변경되었습니다.

변경 전: 매주 월요일 오전 10시
변경 후: 매주 월요일 오전 9시

회의 진행 방식은 동일하며, 시간만 1시간 앞당겨졌습니다.
참석이 어려우신 분들은 미리 말씀해주시면 회의록을 공유하겠습니다.

이해 부탁드립니다.',
    0,
    0,
    0,
    0,
    CONCAT(DATE(NOW()), ' 15:45:00'),
    NULL,
    0,
    (SELECT u.user_id FROM users u INNER JOIN department d ON u.dept_id = d.dept_id WHERE d.dept_name = '개발' LIMIT 1),
    (SELECT d.board_category_id FROM department d WHERE d.dept_name = '개발' LIMIT 1)
);

-- 실행 결과 확인
SELECT 
    b.board_id,
    b.board_title,
    b.board_created_at,
    u.user_name as 작성자,
    d.dept_name as 부서명
FROM board b
INNER JOIN users u ON b.user_id = u.user_id
INNER JOIN department d ON u.dept_id = d.dept_id
WHERE d.dept_name = '개발'
  AND DATE(b.board_created_at) = CURDATE()
ORDER BY b.board_created_at DESC;

