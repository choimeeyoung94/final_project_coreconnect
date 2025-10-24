package com.goodee.coreconnect;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

public class PasswordEncoderTest {
    public static void main(String[] args) {
        String raw = "coreconnect@sss";
        String encoded = new BCryptPasswordEncoder().encode(raw);
        System.out.println("pw: " + encoded);
    }
}

