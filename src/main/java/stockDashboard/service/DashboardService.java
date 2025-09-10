package stockDashboard.service;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import stockDashboard.dto.MarketDataDto;
import stockDashboard.dto.RankItemDto;
import stockDashboard.dto.TreemapDto;
import stockDashboard.dto.TreemapNodeDto;
import stockDashboard.dto.TreemapSectorDto;
import stockDashboard.repository.KrxRepository;

@Slf4j
@RequiredArgsConstructor
@Service
public class DashboardService {
	private final KrxRepository krxRepository;
	
	// 스레드 안전한 ConcurrentHashMap을 캐시 저장소로 사용
    private final Map<String, Object> cache = new ConcurrentHashMap<>();

    /**
     * 5분마다 실행되어 DB에서 최신 시장 데이터를 가져와 DTO로 가공 후 캐시에 저장합니다.
     */
    @Scheduled(fixedRate = 300000)
    public void updateMarketDataCache() {
        log.info("시장 데이터 캐시 업데이트를 시작합니다...");
        try {
            List<MarketDataDto> liveMarketData = krxRepository.getLiveMarketData();

            // KOSPI와 KOSDAQ 데이터를 트리맵 구조로 각각 가공
            TreemapDto kospiTreemap = transformToTreemapDto(liveMarketData, "KOSPI");
            TreemapDto kosdaqTreemap = transformToTreemapDto(liveMarketData, "KOSDAQ");

            // 가공된 최종 DTO를 캐시에 저장
            cache.put("treemap_KOSPI", kospiTreemap);
            cache.put("treemap_KOSDAQ", kosdaqTreemap);

            // --- 랭킹 데이터 가공 및 캐싱 추가 ---
            cache.put("rank_KOSPI_MARKET_CAP", createRankData(liveMarketData, "KOSPI", "MARKET_CAP", 100));
            cache.put("rank_KOSDAQ_MARKET_CAP", createRankData(liveMarketData, "KOSDAQ", "MARKET_CAP", 100));
            cache.put("rank_ALL_CHANGE_RATE", createRankData(liveMarketData, "ALL", "CHANGE_RATE", 100));
            cache.put("rank_ALL_VOLUME", createRankData(liveMarketData, "ALL", "VOLUME", 100));
            // -------------------------------------

            log.info("시장 데이터 캐시 업데이트 완료.");
        } catch (Exception e) {
            log.error("시장 데이터 캐시 업데이트 중 오류 발생", e);
        }
    }

    /**
     * 캐시에서 지정된 시장의 트리맵 데이터를 조회합니다.
     * @param marketType "KOSPI" 또는 "KOSDAQ"
     * @return 캐시된 TreemapDto
     */
    public TreemapDto getTreemapData(String marketType) {
        log.info("캐시에서 {} 트리맵 데이터를 조회합니다.", marketType.toUpperCase());
        return (TreemapDto) cache.get("treemap_" + marketType.toUpperCase());
    }

    /**
     * 캐시에서 각종 순위 데이터를 조회합니다.
     * @param by 정렬 기준 (MARKET_CAP, CHANGE_RATE, VOLUME)
     * @param market 시장 구분 (KOSPI, KOSDAQ, ALL)
     * @param limit 반환할 개수
     * @return RankItemDto 리스트
     */
    @SuppressWarnings("unchecked")
    public List<RankItemDto> getRankData(String by, String market, int limit) {
        String cacheKey = String.format("rank_%s_%s", market.toUpperCase(), by.toUpperCase());
        log.info("캐시에서 {} 키로 랭킹 데이터를 조회합니다.", cacheKey);
        List<RankItemDto> cachedData = (List<RankItemDto>) cache.get(cacheKey);
        if (cachedData == null) {
            return List.of();
        }
        // limit 만큼 잘라서 반환
        return cachedData.stream().limit(limit).toList();
    }
    
    /**
     * 원본 데이터를 기준으로 각종 순위 DTO 리스트를 생성합니다.
     */
    private List<RankItemDto> createRankData(List<MarketDataDto> flatData, String market, String by, int limit) {
        // 1. 시장 필터링
        List<MarketDataDto> filteredData = flatData.stream()
                .filter(d -> "ALL".equalsIgnoreCase(market) || market.equalsIgnoreCase(d.marketType()))
                .toList();

        // 2. 정렬 기준(by)에 따라 Comparator 설정
        java.util.Comparator<MarketDataDto> comparator = switch (by.toUpperCase()) {
            case "MARKET_CAP" -> java.util.Comparator.comparing(MarketDataDto::mktcap, java.util.Comparator.nullsLast(java.util.Comparator.reverseOrder()));
            case "CHANGE_RATE" -> java.util.Comparator.comparing(MarketDataDto::fluc_rate, java.util.Comparator.nullsLast(java.util.Comparator.reverseOrder()));
            case "VOLUME" -> java.util.Comparator.comparing(MarketDataDto::tradeVolume, java.util.Comparator.nullsLast(java.util.Comparator.reverseOrder())); // 거래량 기준 정렬
            default -> java.util.Comparator.comparing(MarketDataDto::mktcap, java.util.Comparator.nullsLast(java.util.Comparator.reverseOrder()));
        };

        // 3. 정렬 및 limit, DTO 변환
        java.util.concurrent.atomic.AtomicInteger rank = new java.util.concurrent.atomic.AtomicInteger(1);
        return filteredData.stream()
                .sorted(comparator)
                .limit(limit)
                .map(d -> new RankItemDto(
                        rank.getAndIncrement(),
                        d.nodeName(),
                        d.currentPrice() != null ? d.currentPrice() : 0L,
                        d.fluc_rate() != null ? d.fluc_rate() : 0.0,
                        d.tradeVolume() != null ? d.tradeVolume() : 0L, // 수정된 부분
                        d.mktcap() != null ? d.mktcap() : 0L
                ))
                .toList();
    }
    
    /**
     * 프론트엔드의 transformData 로직을 백엔드에서 그대로 수행합니다.
     * @param flatData DB에서 가져온 원본 데이터 리스트
     * @param marketName 가공할 시장 이름 ("KOSPI" 또는 "KOSDAQ")
     * @return D3.js가 사용하는 계층 구조와 동일한 TreemapDto
     */
    private TreemapDto transformToTreemapDto(List<MarketDataDto> flatData, String marketName) {
        // 1. 해당 시장 데이터만 필터링
        List<MarketDataDto> marketSpecificData = flatData.stream()
                .filter(d -> marketName.equalsIgnoreCase(d.marketType()))
                .toList();

        if (marketSpecificData.isEmpty()) {
            return new TreemapDto(marketName, List.of());
        }

        // 2. 섹터별로 그룹화
        Map<String, List<MarketDataDto>> groupedBySector = marketSpecificData.stream()
                .collect(Collectors.groupingBy(d -> d.sectorName() != null ? d.sectorName() : "기타 섹터"));

        // 3. 각 섹터를 TreemapSectorDto로 변환
        List<TreemapSectorDto> sectorChildren = groupedBySector.entrySet().stream()
                .map(entry -> {
                    String sectorName = entry.getKey();
                    List<MarketDataDto> items = entry.getValue();

                    // 4. 섹터 내의 각 종목을 TreemapNodeDto로 변환
                    List<TreemapNodeDto> stockChildren = items.stream()
                            .map(item -> new TreemapNodeDto(
                                    item.nodeName() != null ? item.nodeName() : "이름없음",
                                    item.mktcap() != null ? item.mktcap() : 0L,
                                    item.fluc_rate() != null ? item.fluc_rate() : 0.0,
                                    item.currentPrice() != null ? item.currentPrice() : 0L
                            )).toList();

                    return new TreemapSectorDto(sectorName, stockChildren);
                }).toList();

        return new TreemapDto(marketName, sectorChildren);
    }
}
