package stockDashboard.dto;

import java.util.List;

// D3.js 트리맵 계층의 중간 그룹 (섹터)
public record TreemapSectorDto(
    String name, // 섹터명
    List<TreemapNodeDto> children
) {}
