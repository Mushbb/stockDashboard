package stockDashboard.dto;

import java.util.List;

/**
 * 종목명과 시세 이력 리스트를 함께 담아 프론트엔드에 전달하는 DTO입니다.
 */
public record ChartDataDto(
    String stockName,
    List<PriceHistoryDto> history
) {}
