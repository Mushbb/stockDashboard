package stockDashboard.service;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
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
     * 애플리케이션 시작 시 즉시 캐시를 초기화합니다.
     */
    @PostConstruct
    public void initCache() {
        updateMarketDataCache();
    }

    /**
     * 5분마다 실행되어 DB에서 최신 시장 데이터를 가져와 DTO로 가공 후 캐시에 저장합니다.
     */
    @Scheduled(fixedRate = 300000)
    public void updateMarketDataCache() {
        log.info("시장 데이터 캐시 업데이트를 시작합니다...");
        try {
            List<MarketDataDto> liveMarketData = krxRepository.getLiveMarketData();

            // 주식과 ETF 데이터 분리 (marketType의 null 여부로 구분)
            List<MarketDataDto> stockData = liveMarketData.stream()
                .filter(d -> d.marketType() != null)
                .toList();
            List<MarketDataDto> etfData = liveMarketData.stream()
                .filter(d -> d.marketType() == null)
                .toList();

            // 주식 데이터로 KOSPI, KOSDAQ, ALL 트리맵 생성
            TreemapDto kospiTreemap = transformToTreemapDto(stockData, "KOSPI");
            TreemapDto kosdaqTreemap = transformToTreemapDto(stockData, "KOSDAQ");
            TreemapDto allTreemap = transformToTreemapDto(stockData, "ALL");
            
            // ETF 데이터로 ETF 트리맵 생성
            TreemapDto etfTreemap = transformToTreemapDto(etfData, "ETF");

            // 가공된 최종 DTO를 캐시에 저장
            cache.put("treemap_KOSPI", kospiTreemap);
            cache.put("treemap_KOSDAQ", kosdaqTreemap);
            cache.put("treemap_ALL", allTreemap);
            cache.put("treemap_ETF", etfTreemap); // ETF 트리맵 추가

            // --- 랭킹 데이터 가공 및 캐싱 추가 ---
            // 주식 시장 순위
            cache.put("rank_KOSPI_MARKET_CAP_DESC", createRankData(stockData, "KOSPI", "MARKET_CAP", "DESC", 100));
            cache.put("rank_KOSDAQ_MARKET_CAP_DESC", createRankData(stockData, "KOSDAQ", "MARKET_CAP", "DESC", 100));
            
            // 전체 시장 순위 (주식 + ETF)
            cache.put("rank_ALL_CHANGE_RATE_DESC", createRankData(liveMarketData, "ALL", "CHANGE_RATE", "DESC", 100));
            cache.put("rank_ALL_CHANGE_RATE_ASC", createRankData(liveMarketData, "ALL", "CHANGE_RATE", "ASC", 100));
            cache.put("rank_ALL_VOLUME_DESC", createRankData(liveMarketData, "ALL", "VOLUME", "DESC", 100));
            cache.put("rank_ALL_TRADE_VALUE_DESC", createRankData(liveMarketData, "ALL", "TRADE_VALUE", "DESC", 100));
            
            List<RankItemDto> topAndBottom = createTopAndBottomRankData(liveMarketData, "ALL", 100);
            cache.put("rank_ALL_CHANGE_RATE_TOP_AND_BOTTOM", topAndBottom);

            log.info("시장 데이터 캐시 업데이트 완료.");
        } catch (Exception e) {
            log.error("시장 데이터 캐시 업데이트 중 오류 발생", e);
        }
    }

    /**
     * 캐시에서 지정된 시장의 트리맵 데이터를 조회합니다.
     */
    public TreemapDto getTreemapData(String marketType) {
        String cacheKey = "treemap_" + marketType.toUpperCase();
        log.info("캐시에서 {} 키로 트리맵 데이터를 조회합니다.", cacheKey);
        return (TreemapDto) cache.get(cacheKey);
    }

    /**
     * 캐시에서 각종 순위 데이터를 조회합니다.
     */
    @SuppressWarnings("unchecked")
    public List<RankItemDto> getRankData(String by, String market, String order, int limit) {
        String cacheKey = String.format("rank_%s_%s_%s", market.toUpperCase(), by.toUpperCase(), order.toUpperCase());
        log.info("캐시에서 {} 키로 랭킹 데이터를 조회합니다.", cacheKey);
        List<RankItemDto> cachedData = (List<RankItemDto>) cache.get(cacheKey);
        if (cachedData == null) {
            return List.of();
        }
        return cachedData.stream().limit(limit).toList();
    }
    
    /**
     * 캐시에서 등락률 상위/하위 혼합 데이터를 조회합니다.
     */
    @SuppressWarnings("unchecked")
    public List<RankItemDto> getTopAndBottomRankData(String market, int limit) {
        String cacheKey = String.format("rank_%s_CHANGE_RATE_TOP_AND_BOTTOM", market.toUpperCase());
        log.info("캐시에서 {} 키로 Top & Bottom 랭킹 데이터를 조회합니다.", cacheKey);
        List<RankItemDto> cachedData = (List<RankItemDto>) cache.get(cacheKey);
        if (cachedData == null) {
            return List.of();
        }
        
        int halfLimit = limit / 2;
        List<RankItemDto> top = cachedData.stream()
                                .filter(d -> d.changeRate() >= 0)
                                .limit(halfLimit).toList();
        List<RankItemDto> bottom = cachedData.stream()
                                 .filter(d -> d.changeRate() < 0)
                                 .sorted(java.util.Comparator.comparing(RankItemDto::changeRate))
                                 .limit(halfLimit)
                                 .sorted(java.util.Comparator.comparing(RankItemDto::changeRate).reversed())
                                 .toList();

        return java.util.stream.Stream.concat(top.stream(), bottom.stream()).toList();
    }

    /**
     * 원본 데이터를 기준으로 각종 순위 DTO 리스트를 생성합니다.
     */
    private List<RankItemDto> createRankData(List<MarketDataDto> flatData, String market, String by, String order, int limit) {
        List<MarketDataDto> filteredData = flatData.stream()
                .filter(d -> "ALL".equalsIgnoreCase(market) || market.equalsIgnoreCase(d.marketType()))
                .toList();

        java.util.Comparator<MarketDataDto> comparator = switch (by.toUpperCase()) {
            case "MARKET_CAP" -> java.util.Comparator.comparing(MarketDataDto::mktcap, java.util.Comparator.nullsLast(java.util.Comparator.reverseOrder()));
            case "VOLUME" -> java.util.Comparator.comparing(MarketDataDto::tradeVolume, java.util.Comparator.nullsLast(java.util.Comparator.reverseOrder()));
            case "TRADE_VALUE" -> java.util.Comparator.comparing(MarketDataDto::tradeValue, java.util.Comparator.nullsLast(java.util.Comparator.reverseOrder())); // 거래대금 정렬 추가
            case "CHANGE_RATE" -> "asc".equalsIgnoreCase(order)
                    ? java.util.Comparator.comparing(MarketDataDto::fluc_rate, java.util.Comparator.nullsFirst(java.util.Comparator.naturalOrder()))
                    : java.util.Comparator.comparing(MarketDataDto::fluc_rate, java.util.Comparator.nullsLast(java.util.Comparator.reverseOrder()));
            default -> java.util.Comparator.comparing(MarketDataDto::mktcap, java.util.Comparator.nullsLast(java.util.Comparator.reverseOrder()));
        };

        java.util.concurrent.atomic.AtomicInteger rank = new java.util.concurrent.atomic.AtomicInteger(1);
        return filteredData.stream()
                .sorted(comparator)
                .limit(limit)
                .map(d -> new RankItemDto(
                        rank.getAndIncrement(),
                        d.isuSrtCd(), // 종목코드 추가
                        d.nodeName(),
                        d.currentPrice() != null ? d.currentPrice() : 0L,
                        d.fluc_rate() != null ? d.fluc_rate() : 0.0,
                        d.tradeVolume() != null ? d.tradeVolume() : 0L,
                        d.tradeValue() != null ? d.tradeValue() : 0L, // 거래대금 추가
                        d.mktcap() != null ? d.mktcap() : 0L
                ))
                .toList();
    }

    private List<RankItemDto> createTopAndBottomRankData(List<MarketDataDto> flatData, String market, int limit) {
        List<RankItemDto> top = createRankData(flatData, market, "CHANGE_RATE", "DESC", limit);
        List<RankItemDto> bottom = createRankData(flatData, market, "CHANGE_RATE", "ASC", limit);
        return java.util.stream.Stream.concat(top.stream(), bottom.stream()).toList();
    }
    
    /**
     * 프론트엔드의 transformData 로직을 백엔드에서 그대로 수행합니다.
     * @param flatData DB에서 가져온 원본 데이터 리스트
     * @param marketName 가공할 시장 이름 ("KOSPI" 또는 "KOSDAQ")
     * @return D3.js가 사용하는 계층 구조와 동일한 TreemapDto
     */
    private TreemapDto transformToTreemapDto(List<MarketDataDto> flatData, String marketName) {
        // 1. 해당 시장 데이터만 필터링
        List<MarketDataDto> marketSpecificData;
        if ("ETF".equalsIgnoreCase(marketName) || "ALL".equalsIgnoreCase(marketName)) {
            // ETF 또는 ALL의 경우, 이미 필터링된 데이터(또는 전체)를 그대로 사용
            marketSpecificData = flatData;
        } else {
            // KOSPI, KOSDAQ의 경우 marketType으로 필터링
            marketSpecificData = flatData.stream()
                .filter(d -> marketName.equalsIgnoreCase(d.marketType()))
                .toList();
        }

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
                                    item.isuSrtCd(), // 종목코드 추가
                                    item.nodeName() != null ? item.nodeName() : "이름없음",
                                    item.mktcap() != null ? item.mktcap() : 0L,
                                    item.fluc_rate() != null ? item.fluc_rate() : 0.0,
                                    item.currentPrice() != null ? item.currentPrice() : 0L
                            )).toList();

                    return new TreemapSectorDto(sectorName, stockChildren);
                }).toList();

        // "ALL"일 경우 최상위 이름을 "통합 시장"으로 설정
        String rootName = "ALL".equalsIgnoreCase(marketName) ? "통합 시장" : marketName;
        return new TreemapDto(rootName, sectorChildren);
    }

    /**
     * 요청된 키 목록에 해당하는 캐시 데이터를 조회합니다.
     */
    public Map<String, Object> getDynamicData(List<String> dataKeys) {
        if (dataKeys == null || dataKeys.isEmpty()) {
            return Map.of();
        }
        return dataKeys.stream()
            .filter(cache::containsKey)
            .collect(Collectors.toMap(key -> key, cache::get));
    }
}
