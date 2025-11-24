package stockDashboard.service;

import lombok.RequiredArgsConstructor;
import stockDashboard.dto.StockSearchDto;
import stockDashboard.repository.KrxRepository;
import org.springframework.stereotype.Service;

import stockDashboard.dto.MarketDataDto;

import java.util.List;

/**
 * 종목 정보 관련 비즈니스 로직을 처리하는 서비스입니다.
 */
@Service
@RequiredArgsConstructor
public class StockService {

    private final KrxRepository krxRepository;

    /**
     * 종목명 또는 종목코드로 주식을 검색합니다.
     * @param query 검색어
     * @return 검색된 주식 정보 DTO 리스트
     */
    public List<StockSearchDto> searchStocks(String query) {
        return krxRepository.searchStocksByName(query);
    }

    /**
     * 여러 종목 코드에 해당하는 최신 시장 데이터를 조회합니다.
     * @param symbols 조회할 종목 코드 리스트
     * @return 최신 시장 데이터 DTO 리스트
     */
    public List<MarketDataDto> getLatestMarketDataForSymbols(List<String> symbols) {
        return krxRepository.findLatestMarketDataBySymbols(symbols);
    }
}
