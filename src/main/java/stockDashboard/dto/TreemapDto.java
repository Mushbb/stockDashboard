package stockDashboard.dto;

import java.util.List;

// D3.js 트리맵 계층의 최상위 루트 (시장)
public record TreemapDto(
    String name, // e.g., "KOSPI", "KOSDAQ"
    List<TreemapSectorDto> children
) {}
