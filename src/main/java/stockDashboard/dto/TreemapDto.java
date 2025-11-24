package stockDashboard.dto;

import java.util.List;

/**
 * D3.js 트리맵 차트의 계층 구조에서 최상위 루트 노드를 나타내는 DTO입니다.
 * 하나의 시장(e.g., KOSPI) 전체에 해당합니다.
 * @param name 루트 노드의 이름 (e.g., "KOSPI", "KOSDAQ")
 * @param children 이 시장에 속한 섹터(업종) 노드들의 리스트
 */
public record TreemapDto(
    String name,
    List<TreemapSectorDto> children
) {}
