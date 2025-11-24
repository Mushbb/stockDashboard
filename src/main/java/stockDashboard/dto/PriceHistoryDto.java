package stockDashboard.dto;

/**
 * Lightweight Charts에 필요한 시세 이력 데이터를 전달하기 위한 DTO입니다.
 *
 * @param time        날짜 (yyyy-MM-dd 형식)
 * @param open        시가
 * @param high        고가
 * @param low         저가
 * @param close       종가
 * @param volume      거래량
 */
public record PriceHistoryDto(
    String time,
    long open,
    long high,
    long low,
    long close,
    long volume
) {}
