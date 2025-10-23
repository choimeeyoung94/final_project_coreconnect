package com.goodee.coreconnect.user.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RequestMapping("/api/hello")
@RestController
public class MainController {
  
  @GetMapping
  public String hello() {
    return "Hello from Spring Boot!";
  }

}
