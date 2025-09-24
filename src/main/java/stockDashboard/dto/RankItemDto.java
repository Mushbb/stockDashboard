package stockDashboard.dto;

// 범용 랭킹 테이블의 각 항목을 나타내는 DTO
public record RankItemDto(
    int rank,          // 순위
    String symbol,     // 종목코드
    String name,       // 종목명
    long currentPrice, // 현재가
    double changeRate, // 등락률
    long volume,       // 거래량
    long tradeValue,   // 거래대금
    long marketCap     // 시가총액
) {}
