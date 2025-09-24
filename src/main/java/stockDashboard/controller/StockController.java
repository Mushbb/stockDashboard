package stockDashboard.controller;

import lombok.RequiredArgsConstructor;
import stockDashboard.dto.StockSearchDto;
import stockDashboard.service.StockService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/stocks")
@RequiredArgsConstructor
public class StockController {

    private final StockService stockService;

    @GetMapping("/search")
    public ResponseEntity<List<StockSearchDto>> searchStocks(@RequestParam("query") String query) {
        if (query == null || query.length() < 2) {
            // 너무 짧은 검색어는 무시 (DB 부하 방지)
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(stockService.searchStocks(query));
    }
}
