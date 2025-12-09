package com.goodee.coreconnect.email.entity;

import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonBackReference;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Builder.Default;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "email_recipient")
@Getter
@Setter
@NoArgsConstructor(access = lombok.AccessLevel.PROTECTED) // 기본 생성자 protected
@AllArgsConstructor
@Builder
public class EmailRecipient {
	
	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Integer emailRecipientId;

	private String emailRecipientType; // TO/CC/BCC
	private String emailRecipientAddress; // 외부메일주소
	private Integer userId; // 내부직원 FK(user)
	
	@Builder.Default
	private Boolean emailReadYn = false;
	private LocalDateTime emailReadAt;
	
	@Builder.Default
	private Boolean deleted = false; // 받은메일함에서 삭제 여부
	private LocalDateTime deletedAt; // 삭제 시간
	
	@Builder.Default
	private Boolean emailIsAlarmSent = false;
	
	
	/**
	 * Jackson의 순환참조(Circular Reference)
		JPA 양방향 연관관계를 가진 엔티티 클래스(예: Email ←→ EmailRecipient)가 있다.
		Email  안에는 List<EmailRecipient> recipients가 있고,
		EmailRecipient 안에는 Email email이 있다.
		이 상태에서 어떤 객체(예: Email)를 응답(JSON)으로 직렬화(Serialize)할 때,
		Email.recipients[0].email을 또 출력하려고 타고 들어간다.
		그리고 그 안엔 다시 .recipients가 있고 또 다시 .email이 반복된다.
		결과적으로, Jackson은 무한루프에 빠짐
		BeanSerializerBase.serializeFields가 무한재귀로 돌다가 StackOverflowError or OutOfMemory 가 발생하거나,
		서버가 죽고, 브라우저에서는 JSON을 끝도 없이 받게 된다
	 * 
	 * 왜 @JsonBackReference/@JsonManagedReference를 쓰는가?
이런 재귀 순환을 막기 위해
특정 방향(스택)에서는 "더 이상 내려가지 마!"라고 Jackson에게 가르칠 필요가 있다.

@JsonManagedReference: "부모-자식 관계에서 부모 필드에 붙임"
예) Email의 recipients 필드(OneToMany, 즉 자식 리스트)
→ serialize 할 때 포함함.
@JsonBackReference: "자식에서 부모 참조"
예) EmailRecipient의 email 필드(ManyToOne)
→ serialize 시 무시함(깊게 안 들어감)
즉, Email → recipients → [EmailRecipient, EmailRecipient ...]
여기까지는 JSON으로 넘긴다
그런데 EmailRecipient.email(부모로 따라감)은 serialize에서 "무시"된다(BackReference니까)
그래서 자식에서 다시 부모로, 부모에서 또 자식으로… 이런 무한참조가 아예 차단된다!
논리적 이유 요약
엔티티 A → B → A → B... 식으로 JPA가 서로를 참조할 때 Jackson(혹은 Gson 등 직렬화 라이브러리)도 이 객체 구조를 그대로 따라감
똑같은 객체링크의 "순환 고리"가 생긴다
이 때 직렬화 중 한 방향을 @JsonBackReference로 **"여기까지 직렬화하고 더 들어가지마"**라고 미리 지정해줘야만,
데이터 직렬화도 멈추고, StackOverflow/메모리 폭증/서버 죽는 현상을 막을 수 있음
(REST API, RESTful 웹서비스에서 이런 순환문제는 굉장히 흔함)
	 * 
	 * 
	 * 
	 * 
	 * 
어떤 엔티티 간의 순환 참조였나?
1. Email 엔티티
@OneToMany(mappedBy = "email", ...) private List<EmailRecipient> recipients;
→ Email 객체는 자신이 가진 여러 EmailRecipient(수신자)들을 리스트로 참조함
2. EmailRecipient 엔티티
@ManyToOne @JoinColumn(name = "email_id") private Email email;
→ 각 EmailRecipient 객체는 자신이 소속된 Email 객체를 참조함
즉, 참조 구조는 다음과 같음:
Code
Email
 └── recipients (List<EmailRecipient>)
       └── email (Email)
             └── recipients (List<EmailRecipient>)
                   └── ... (반복)
Email → EmailRecipient(들) → 다시 → Email → ... (무한 반복)
JPA 입장에서는 이 구조가 아주 자연스러움(양방향 연관)
하지만 Jackson(JSON 직렬화)은
Email.recipient를 직렬화하다가
각 recipient의 email을 직렬화
그 안에 또 recipients…
라고 해서 무한 직렬화 루프에 빠집니다.
핵심:
Email ↔ EmailRecipient 사이의 양방향 참조가
직렬화(serialize)할 때 무한 순환을 유발
특히 EmailRecipient.email 필드가 다시 Email을 참조하는 게 원인
(그리고, 그 Email은 또 recipients 리스트를 가짐)
요약 (한 줄 정리)
Email 엔티티와 EmailRecipient 엔티티의

Email.recipients: List<EmailRecipient>
EmailRecipient.email: Email
이 ‘양방향 참조’ 관계가 순환 참조(직렬화 시 무한루프)의 원인이었습니다.

Jackson은 이 구조를 그대로 따라가며 JSON을 만들다가
parent → child → parent → child... 라는 무한직렬화에 빠집니다.

따라서,
하나의 방향(보통 자식에서 부모: EmailRecipient.email)에서
@JsonBackReference 또는 @JsonIgnore로 직렬화 제외가 필요했던 것입니다.
	 * */
	@ManyToOne
	@JoinColumn(name = "email_id", referencedColumnName = "emailId")
	@JsonBackReference
	private Email email; // 메일 본문
	
	@ManyToOne
	@JoinColumn(name = "email_id2", referencedColumnName = "emailId")
	private Email extendedEmail; // 확장용(참조, 답신)

	
	
	
	
	
	
}
