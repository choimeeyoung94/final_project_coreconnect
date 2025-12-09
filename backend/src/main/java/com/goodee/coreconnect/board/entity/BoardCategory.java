package com.goodee.coreconnect.board.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "board_category")
public class BoardCategory {

    // ─────────────── 기본 속성 ───────────────
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "board_category_id")
    private Integer id;

    @Column(name = "board_category_name", length = 20, nullable = false)
    private String name;

    @Column(name = "board_category_order_no", unique = true)
    private Integer orderNo = 0;

    @Column(name = "board_category_deleted_yn", nullable = false)
    private Boolean deletedYn = false;


    // ─────────────── 생성 메서드 ───────────────
    public static BoardCategory createCategory(String name, Integer orderNo) {
      if (name == null || name.isBlank()) {
          throw new IllegalArgumentException("카테고리명은 반드시 입력되어야 합니다.");
      }
      if (orderNo != null && orderNo < -1) {
        throw new IllegalArgumentException("순서번호는 -1 이상의 정수여야 합니다.");
      }

      BoardCategory category = new BoardCategory();
      category.name = name;
      category.orderNo = orderNo != null ? orderNo : 0;
      category.deletedYn = false;
      return category;
    }


    // ─────────────── 도메인 행위 ───────────────
    /** 카테고리 수정 */
    public void updateCategory(String name, Integer orderNo) {
      if (name == null || name.isBlank()) {
          throw new IllegalArgumentException("카테고리명은 비어 있을 수 없습니다.");
      }
      if (orderNo == null) {
          throw new IllegalArgumentException("순서 번호는 반드시 지정되어야 합니다.");
      }
      if (orderNo < -1) {
        throw new IllegalArgumentException("순서번호는 -1 이상의 정수여야 합니다.");
      }

      this.name = name;
      this.orderNo = orderNo;
    }

    /** Soft Delete */
    public void delete() {
        this.deletedYn = true;
        this.orderNo = null;
    }
}
