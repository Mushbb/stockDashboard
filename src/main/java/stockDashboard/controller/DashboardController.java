package stockDashboard.controller;

import stockDashboard.service.DashboardService;
import stockDashboard.dto.MarketDataDto;

import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.format.annotation.DateTimeFormat;
import lombok.RequiredArgsConstructor;

import java.time.LocalDate;
import java.util.List;

@RequiredArgsConstructor
@RestController // JSON REST API
public class DashboardController {
	private final DashboardService serv;
	
	/**
     * d3.js treemap에서 사용할 시장 데이터를 반환하는 API 엔드포인트입니다.
     *
     * @param date 'YYYY-MM-DD' 형식의 날짜 쿼리 파라미터 (선택 사항)
     * @return JSON 형식의 MarketDataDto 리스트
     */
    @GetMapping("/api/market-data")
    public List<MarketDataDto> getMarketDataForTreemap(
            @RequestParam(value = "date", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        
        return serv.getMarketData(date);
    }
}