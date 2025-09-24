package stockDashboard.controller;

import lombok.RequiredArgsConstructor;
import stockDashboard.dto.ChartDataDto;
import stockDashboard.dto.PriceHistoryDto;
import stockDashboard.service.ChartDataService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/charts")
@RequiredArgsConstructor
public class ChartDataController {

    private final ChartDataService chartDataService;

    /**
     * 특정 종목의 시세 이력과 종목명을 반환하는 API 엔드포인트입니다.
     * @param symbol 종목코드 (필수)
     * @param days 조회 기간(일) (기본값: 365일)
     * @return 차트 데이터 DTO (종목명 + 시세 이력)
     */
    @GetMapping("/krx/history")
    public ResponseEntity<ChartDataDto> getPriceHistory(
            @RequestParam("symbol") String symbol,
            @RequestParam(value = "days", defaultValue = "365") int days) {
        
        if (symbol == null || symbol.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        
        ChartDataDto chartData = chartDataService.getPriceHistory(symbol, days);
        
        if (chartData == null || chartData.history() == null || chartData.history().isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        
        return ResponseEntity.ok(chartData);
    }
}
