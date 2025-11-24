package stockDashboard.dto;

import java.util.List;

/**
 * D3.js 트리맵 차트의 계층 구조에서 중간 그룹 노드, 즉 섹터(업종)를 나타내는 DTO입니다.
 * @param name 섹터명
 * @param children 이 섹터에 속한 개별 종목 노드들의 리스트
 */
public record TreemapSectorDto(
    String name,
    List<TreemapNodeDto> children
) {}
