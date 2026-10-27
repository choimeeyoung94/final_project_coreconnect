package com.goodee.coreconnect.support;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * 통합 테스트 공통 베이스 클래스
 *
 * - 테스트 실행 시 Docker로 실제 MySQL 8.0과 Redis를 띄움 (로컬 개발 DB를 건드리지 않음)
 * - 컨테이너는 static으로 한 번만 시작해서 이 클래스를 상속한 모든 테스트가 같이 씀
 * - DataSourceConfig의 Master/Slave 접속 정보를 컨테이너 주소로 바꿔 끼움
 * - 테스트용 application.properties는 환경변수가 없으면 값이 비므로, 기동에 필요한 값만 여기서 채움
 */
@SpringBootTest(properties = {
    "jwt.secret=integration-test-jwt-secret-key-must-be-at-least-256-bits-long",
    "cloud.aws.credentials.access-key=test",
    "cloud.aws.credentials.secret-key=test",
    "cloud.aws.region.static=ap-northeast-2",
    "cloud.aws.s3.bucket=test-bucket",
    "sendgrid.api.key=test",
    "sendgrid.from.email=test@coreconnect.test",
    "sendgrid.from.name=CoreConnect",
    "sendgrid.reply.to=test@coreconnect.test",
    "spring.mail.host=localhost",
    "spring.mail.username=test@coreconnect.test"
})
public abstract class AbstractIntegrationTest {

  static final MySQLContainer<?> MYSQL = new MySQLContainer<>(DockerImageName.parse("mysql:8.0"))
      .withDatabaseName("db_coreconnect")
      .withUsername("test")
      .withPassword("test");

  static final GenericContainer<?> REDIS = new GenericContainer<>(DockerImageName.parse("redis:7-alpine"))
      .withExposedPorts(6379);

  static {
    MYSQL.start();
    REDIS.start();
  }

  @DynamicPropertySource
  static void overrideProperties(DynamicPropertyRegistry registry) {
    // Master와 Slave 모두 같은 컨테이너를 바라보게 함 (테스트에서는 복제 구성이 필요 없음)
    for (String node : new String[] {"master", "slave"}) {
      String prefix = "spring.datasource." + node + ".hikari.";
      registry.add(prefix + "jdbc-url", MYSQL::getJdbcUrl);
      registry.add(prefix + "username", MYSQL::getUsername);
      registry.add(prefix + "password", MYSQL::getPassword);
      registry.add(prefix + "minimum-idle", () -> "2");
    }
    registry.add("spring.jpa.hibernate.ddl-auto", () -> "create-drop");

    registry.add("spring.data.redis.host", REDIS::getHost);
    registry.add("spring.data.redis.port", () -> REDIS.getMappedPort(6379));
    registry.add("spring.data.redis.password", () -> "");
  }
}
