package stockDashboard.controller;

import lombok.RequiredArgsConstructor;
import stockDashboard.dto.MarketDataDto;
import stockDashboard.dto.StockSearchDto;
import stockDashboard.service.StockService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 종목 정보 관련 API 요청을 처리하는 컨트롤러입니다.
 * 종목 검색 및 시세 조회를 담당합니다.
 */
@RestController
@RequestMapping("/api/stocks")
@RequiredArgsConstructor
public class StockController {

    private final StockService stockService;

    /**
     * 사용자의 검색어(query)를 기반으로 주식 종목을 검색합니다.
     * 검색어는 2자 이상이어야 합니다.
     *
     * @param query 종목명 또는 종목코드로 이루어진 검색어
     * @return 검색 결과에 해당하는 StockSearchDto 리스트를 포함하는 ResponseEntity
     */
    @GetMapping("/search")
    public ResponseEntity<List<StockSearchDto>> searchStocks(@RequestParam("query") String query) {
        if (query == null || query.length() < 2) {
            // 너무 짧은 검색어는 무시 (DB 부하 방지)
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(stockService.searchStocks(query));
    }

    /**
     * 주어진 종목 코드 리스트에 대한 최신 시세 정보를 조회합니다.
     *
     * @param symbols 시세 정보를 조회할 종목 코드의 리스트
     * @return 각 종목의 최신 시세 정보(MarketDataDto) 리스트를 포함하는 ResponseEntity
     */
    @GetMapping("/quotes")
    public ResponseEntity<List<MarketDataDto>> getQuotes(@RequestParam("symbols") List<String> symbols) {
        if (symbols == null || symbols.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(stockService.getLatestMarketDataForSymbols(symbols));
    }
}
