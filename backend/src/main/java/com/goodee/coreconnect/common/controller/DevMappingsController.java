package com.goodee.coreconnect.common.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;
import org.springframework.web.method.HandlerMethod;

import java.util.Map;
import java.util.stream.Collectors;

/**
 * 개발 환경에서만 사용하는 매핑 확인용 컨트롤러
 * 운영 환경에서는 사용하지 않도록 @Profile("dev") 또는 @Profile("secure") 추가 권장
 */
@Slf4j
@RestController
@Profile("secure") // secure 프로필에서만 활성화 (개발 환경)
public class DevMappingsController {

    @Autowired
    private RequestMappingHandlerMapping requestMappingHandlerMapping;

    @GetMapping("/dev/mappings")
    public Map<String, Object> getMappings() {
        Map<RequestMappingInfo, HandlerMethod> handlerMethods = 
            requestMappingHandlerMapping.getHandlerMethods();
        
        log.info("========== 등록된 매핑 목록 ==========");
        
        Map<String, Object> result = handlerMethods.entrySet().stream()
            .collect(Collectors.toMap(
                entry -> {
                    RequestMappingInfo info = entry.getKey();
                    String path = info.getPatternsCondition().getPatterns().toString();
                    String methods = info.getMethodsCondition().getMethods().toString();
                    return path + " -> " + methods;
                },
                entry -> {
                    HandlerMethod method = entry.getValue();
                    return method.getMethod().getDeclaringClass().getSimpleName() + 
                           "." + method.getMethod().getName();
                }
            ));
        
        // 로그로도 출력
        handlerMethods.forEach((info, method) -> {
            String paths = info.getPatternsCondition().getPatterns().toString();
            String methods = info.getMethodsCondition().getMethods().toString();
            String className = method.getMethod().getDeclaringClass().getSimpleName();
            String methodName = method.getMethod().getName();
            log.info("Mapped: {} {} -> {}.{}", methods, paths, className, methodName);
        });
        
        log.info("========== 매핑 목록 끝 (총 {}개) ==========", handlerMethods.size());
        
        return result;
    }
    
    /**
     * 특정 경로의 매핑 정보만 확인
     */
    @GetMapping("/dev/mappings/restore")
    public Map<String, Object> getRestoreMappings() {
        Map<RequestMappingInfo, HandlerMethod> handlerMethods = 
            requestMappingHandlerMapping.getHandlerMethods();
        
        Map<String, Object> result = handlerMethods.entrySet().stream()
            .filter(entry -> {
                RequestMappingInfo info = entry.getKey();
                return info.getPatternsCondition().getPatterns().stream()
                    .anyMatch(pattern -> pattern.contains("restore"));
            })
            .collect(Collectors.toMap(
                entry -> {
                    RequestMappingInfo info = entry.getKey();
                    String path = info.getPatternsCondition().getPatterns().toString();
                    String methods = info.getMethodsCondition().getMethods().toString();
                    return path + " -> " + methods;
                },
                entry -> {
                    HandlerMethod method = entry.getValue();
                    return method.getMethod().getDeclaringClass().getSimpleName() + 
                           "." + method.getMethod().getName();
                }
            ));
        
        log.info("========== restore 관련 매핑 ==========");
        result.forEach((key, value) -> log.info("{} -> {}", key, value));
        log.info("=====================================");
        
        return result;
    }
}

