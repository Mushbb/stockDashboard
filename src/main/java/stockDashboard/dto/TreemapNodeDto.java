package stockDashboard.dto;

/**
 * D3.js 트리맵 차트 계층의 가장 마지막 노드(leaf), 즉 개별 종목을 나타내는 DTO입니다.
 * @param symbol 종목코드
 * @param name 종목명
 * @param value 트리맵 사각형의 크기를 결정하는 값 (일반적으로 시가총액)
 * @param fluc_rate 등락률 (사각형의 색상을 결정하는 데 사용)
 * @param cur_price 현재가
 */
public record TreemapNodeDto(
    String symbol,
    String name,
    long value,
    double fluc_rate,
    long cur_price
) {}
