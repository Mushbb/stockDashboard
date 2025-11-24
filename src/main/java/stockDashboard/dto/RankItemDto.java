package stockDashboard.dto;

/**
 * 각종 순위 테이블의 개별 항목을 나타내는 데이터 전송 객체(DTO)입니다.
 * @param rank 순위
 * @param symbol 종목코드
 * @param name 종목명
 * @param currentPrice 현재가
 * @param changeRate 등락률
 * @param volume 거래량
 * @param tradeValue 거래대금
 * @param marketCap 시가총액
 */
public record RankItemDto(
    int rank,
    String symbol,
    String name,
    long currentPrice,
    double changeRate,
    long volume,
    long tradeValue,
    long marketCap
) {}
