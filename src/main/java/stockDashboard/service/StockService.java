package stockDashboard.service;

import lombok.RequiredArgsConstructor;
import stockDashboard.dto.StockSearchDto;
import stockDashboard.repository.KrxRepository;
import org.springframework.stereotype.Service;

import stockDashboard.dto.MarketDataDto;

import java.util.List;

@Service
@RequiredArgsConstructor
public class StockService {

    private final KrxRepository krxRepository;

    public List<StockSearchDto> searchStocks(String query) {
        return krxRepository.searchStocksByName(query);
    }

    public List<MarketDataDto> getLatestMarketDataForSymbols(List<String> symbols) {
        return krxRepository.findLatestMarketDataBySymbols(symbols);
    }
}
