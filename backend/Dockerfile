# Multi-stage build for Spring Boot with Gradle
FROM gradle:8.5-jdk17 AS build

WORKDIR /app

# Copy Gradle files
COPY build.gradle settings.gradle ./
COPY gradle gradle/

# Download dependencies (cache layer)
RUN gradle dependencies --no-daemon || return 0

# Copy source code
COPY src ./src

# Build application
RUN gradle clean bootJar --no-daemon -x test

# Runtime stage
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S appuser && \
    adduser -S appuser -u 1001 -G appuser

# Copy jar from build stage
COPY --from=build /app/build/libs/*.jar app.jar

# Change ownership
RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/actuator/health || exit 1

# JVM options for container
ENV JAVA_OPTS="-Xms512m -Xmx1024m -XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -Dspring.profiles.active=prod -jar app.jar"]
