package com.goodee.coreconnect.department.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.goodee.coreconnect.board.entity.BoardCategory;
import com.goodee.coreconnect.board.repository.BoardCategoryRepository;
import com.goodee.coreconnect.department.dto.response.DepartmentFlatDTO;
import com.goodee.coreconnect.department.dto.response.DepartmentTreeDTO;
import com.goodee.coreconnect.department.entity.Department;
import com.goodee.coreconnect.department.repository.DepartmentRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional
public class DepartmentServiceImpl implements DepartmentService {
  
  private final DepartmentRepository departmentRepository;
  private final BoardCategoryRepository boardCategoryRepository;

  /** 전체 조직도 트리 조회 */
  @Override
  @Transactional(readOnly = true)
  public List<DepartmentTreeDTO> getDepartmentTree() {
    List<Department> all = departmentRepository.findAllByOrderByParentIdAscDeptOrderNoAsc();
    
    // 엔티티 -> DTO 
    Map<Integer, DepartmentTreeDTO> map = new HashMap<>();
    for(Department d : all) {
      int count = (d.getUsers() == null) ? 0 : d.getUsers().size();
      map.put(d.getId(), DepartmentTreeDTO.createDepartmentTreeDTO(d.getId(), d.getDeptName(), d.getDeptOrderNo(), count));
    }
    
    // parent 기준으로 children 연결
    List<DepartmentTreeDTO> roots = new ArrayList<>();
    for(Department d : all) {
      DepartmentTreeDTO dto = map.get(d.getId());
      if(d.getParent() == null) {
        roots.add(dto);
      } else {
        DepartmentTreeDTO parentDTO = map.get(d.getParent().getId());
        parentDTO.getChildren().add(dto);
      }
    }
    
    // 각 레벨 children 정렬
    sortChildrenRecursively(roots);
    return roots;
  }
  
  /** 전체 부서를 평탄화(flat) 형태로 조회 */
  @Override
  @Transactional(readOnly = true)
  public List<DepartmentFlatDTO> getDepartmentListFlat() {
      List<Department> all = departmentRepository.findAllByOrderByParentIdAscDeptOrderNoAsc();

      List<DepartmentFlatDTO> result = new ArrayList<>();

      for (Department d : all) {
          Integer parentId = (d.getParent() != null) ? d.getParent().getId() : null;
          int userCount = (d.getUsers() == null) ? 0 : d.getUsers().size();

          result.add(DepartmentFlatDTO.createDepartmentFlatDTO(
              d.getId(),
              d.getDeptName(),
              parentId,
              d.getDeptOrderNo(),
              userCount
          ));
      }
      return result;
  }
  
  /** 조직도 트리 전체를 부서 정렬순서(orderNo) 기준으로 깔끔하게 정리해주는 재귀 정렬 메소드 */
  @Transactional(readOnly = true)
  private void sortChildrenRecursively(List<DepartmentTreeDTO> list) {
    list.sort(Comparator
                .comparing(DepartmentTreeDTO::getOrderNo)
                .thenComparing(DepartmentTreeDTO::getId));
    for(DepartmentTreeDTO child : list) {
      sortChildrenRecursively(child.getChildren());
    }
  }
  /** 부서 단건 조회 */
  @Override
  @Transactional(readOnly = true)
  public Department get(Integer id) {
    return departmentRepository.findById(id).orElseThrow(() -> new NoSuchElementException("부서를 찾을 수 없습니다. id=" + id));
  }

  /** 부서 생성 */
  @Override
  public Integer create(String name, Integer orderNo, Integer parentId) {
    
    Department parent = (parentId == null) ? null : get(parentId);
    
    // orderNo가 null이면 자동 계산: 같은 parentId를 가진 부서 중 최대값 + 10
    Integer finalOrderNo = orderNo;
    if (finalOrderNo == null) {
      finalOrderNo = calculateNextOrderNo(parentId);
    }
    
    Department dept = Department.createDepartment(name, finalOrderNo);
    if(parent != null) {
      dept.changeParent(parent);
    }
    return departmentRepository.save(dept).getId();
  }
  
  /** 같은 상위 부서 내에서 다음 정렬 순서 계산 (최대값 + 10) */
  @Transactional(readOnly = true)
  private Integer calculateNextOrderNo(Integer parentId) {
    List<Department> siblings;
    if (parentId == null) {
      // 최상위 부서인 경우
      siblings = departmentRepository.findByParentIsNullOrderByDeptOrderNoAsc();
    } else {
      // 특정 부모의 자식들
      siblings = departmentRepository.findByParentIdOrderByDeptOrderNoAsc(parentId);
    }
    
    if (siblings.isEmpty()) {
      // 첫 번째 부서인 경우 기본값 10
      return 10;
    }
    
    // 최대 orderNo 찾기
    Integer maxOrderNo = siblings.stream()
        .map(Department::getDeptOrderNo)
        .max(Integer::compareTo)
        .orElse(0);
    
    return maxOrderNo + 10;
  }
  
  /** 부서 기본정보 변경(이름/정렬) */
  @Override
  public void updateBasic(Integer id, String newName, Integer newOrderNo) {
    Department dept = get(id);
    if(newName != null) { dept.changeName(newName); }
    if(newOrderNo != null) { dept.changeOrder(newOrderNo); }
  }
  
  /** 부서 이동(상위부서 변경) */
  @Override
  public void move(Integer id, Integer newParentId) {
    Department dept = get(id);
    Department newParent = (newParentId == null) ? null : get(newParentId);
    
    // 자기 자신 or 자식으로 이동 금지(사이클 방지)
    if(newParent != null && createsCycle(dept, newParent)) {
      throw new IllegalArgumentException("하위 부서를 상위로 지정할 수 없습니다.");
    }
    dept.changeParent(newParent);
  }

  /** 부서 삭제(자식/사원 존재 시 금지) */
  @Override
  public void delete(Integer id) {
    Department dept = get(id);
    
    // 자식 존재 시 삭제 금지
    if(departmentRepository.existsByParentId(id)) {
      throw new IllegalStateException("하위 부서가 있어 삭제할 수 없습니다.");
    }
    
    // 소속 인원 존재 시 삭제 금지
    int userCount = (dept.getUsers() == null) ? 0 : dept.getUsers().size();
    if(userCount > 0) {
      throw new IllegalStateException("부서에 소속된 사원이 있어 삭제할 수 없습니다. ");
    }
    
    departmentRepository.delete(dept);
  }
  
  /** 부서 이동 시 순환 참조가 생기는걸 막는 보호 로직 */
  @Transactional(readOnly = true)
  private boolean createsCycle(Department current, Department newParent) {
    Department p = newParent;
    while (p != null) {
        if (p.getId().equals(current.getId())) { return true; }
        p = p.getParent();
    }
    return false;
  }
  
  /** 부서 전체 갯수를 조회하는 메소드 */
  @Override
  public Long getAllDepartmentCount() {
    return departmentRepository.count();
  }

  /** 부서 ID로 게시판 카테고리 ID 조회 */
  @Override
  public Integer getBoardCategoryIdByDeptId(Integer deptId) {
    return departmentRepository
        .findBoardCategoryIdByDeptId(deptId)
        .orElseThrow(() -> new IllegalArgumentException("해당 부서 ID에 해당하는 게시판 카테고리 ID를 조회할 수 없습니다."));
  }

  /** 부서와 게시판 카테고리 매핑 */
  @Override
  public void linkDeptWithCategory(Integer deptId, Integer categoryId) {
    Department dept = departmentRepository
        .findById(deptId)
        .orElseThrow(() -> new IllegalArgumentException("부서를 찾을 수 없습니다."));
    BoardCategory category = boardCategoryRepository
        .findById(categoryId)
        .orElseThrow(() -> new IllegalArgumentException("카테고리를 찾을 수 없습니다."));
    dept.linkBoardCategory(category);
  }
  
  


}
