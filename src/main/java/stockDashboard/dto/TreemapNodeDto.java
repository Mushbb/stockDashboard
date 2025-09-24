package stockDashboard.dto;

// D3.js 트리맵 계층의 가장 마지막 노드 (개별 종목)
// 프론트엔드 transformData 함수의 결과물과 동일한 구조
public record TreemapNodeDto(
    String symbol,     // 종목코드
    String name,       // 종목명 (nodeName)
    long value,        // 트리맵 크기 기준 (mktcap)
    double fluc_rate,  // 등락률 (색상 표현용)
    long cur_price     // 현재가 (currentPrice)
) {}
