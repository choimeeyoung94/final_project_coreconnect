package com.goodee.coreconnect.chat.pubsub;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ChatPubSubMessage {
    private String topic;
    private Object payload;
}
