package stockDashboard.dto;

/**
 * 종목 검색 결과를 전달하기 위한 DTO입니다.
 */
public record StockSearchDto(
    String symbol,
    String name
) {}
