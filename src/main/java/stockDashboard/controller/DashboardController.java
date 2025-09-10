package stockDashboard.controller;

import stockDashboard.service.DashboardService;
import stockDashboard.dto.RankItemDto;
import stockDashboard.dto.TreemapDto;

import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import java.util.List;

import lombok.RequiredArgsConstructor;

@RequiredArgsConstructor
@RestController // JSON REST API
public class DashboardController {
	private final DashboardService serv;
	
	/**
     * d3.js treemap에서 사용할 시장 데이터를 반환하는 API 엔드포인트입니다.
     *
     * @param marketType "kospi" 또는 "kosdaq"
     * @return JSON 형식의 TreemapDto
     */
    @GetMapping("/api/charts/treemap/{marketType}")
    public TreemapDto getMarketDataForTreemap(@PathVariable("marketType") String marketType) {
        return serv.getTreemapData(marketType);
    }

    /**
     * 각종 순위 데이터를 반환하는 API 엔드포인트입니다.
     * @param by 정렬 기준 (market_cap, change_rate, volume)
     * @param market 시장 구분 (kospi, kosdaq, all)
     * @param limit 반환할 개수 (기본값 10)
     * @return JSON 형식의 RankItemDto 리스트
     */
    @GetMapping("/api/market/rank")
    public List<RankItemDto> getRankData(
            @RequestParam("by") String by,
            @RequestParam(value = "market", defaultValue = "ALL") String market,
            @RequestParam(value = "limit", defaultValue = "10") int limit) {
        return serv.getRankData(by, market, limit);
    }
}
