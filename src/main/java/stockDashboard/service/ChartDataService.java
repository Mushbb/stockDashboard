package stockDashboard.service;

import lombok.RequiredArgsConstructor;
import stockDashboard.dto.ChartDataDto;
import stockDashboard.dto.PriceHistoryDto;
import stockDashboard.repository.KrxRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ChartDataService {

    private final KrxRepository krxRepository;

    /**
     * 특정 종목의 시세 이력과 종목명을 조회합니다.
     * @param symbol 종목코드
     * @param days 조회할 기간 (일)
     * @return 차트 데이터 DTO (종목명 + 시세 이력)
     */
    public ChartDataDto getPriceHistory(String symbol, int days) {
        LocalDate startDate = LocalDate.now().minusDays(days);
        
        String stockName = krxRepository.getStockNameBySymbol(symbol);
        List<PriceHistoryDto> history = krxRepository.getPriceHistoryBySymbol(symbol, startDate);

        return new ChartDataDto(stockName, history);
    }
}
