package stockDashboard.service;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

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
@Service
public class DashboardService {
	private final KrxRepository krxRepository;
	private final ObjectMapper objectMapper; // JSON 파싱을 위해 추가

    public DashboardService(KrxRepository krxRepository, ObjectMapper objectMapper) {
        this.krxRepository = krxRepository;
        this.objectMapper = objectMapper;
    }
	
	// 스레드 안전한 ConcurrentHashMap을 캐시 저장소로 사용
    private final Map<String, Object> cache = new ConcurrentHashMap<>();

    @PostConstruct
    public void initCache() {
        updateMarketDataCache();
    }

    @Scheduled(fixedRate = 300000) // 5분
    public void updateMarketDataCache() {
        log.info("시장 데이터 캐시 업데이트를 시작합니다...");
        try {
            // 1. 주식 및 ETF 데이터 조회 및 캐싱
            List<MarketDataDto> liveMarketData = krxRepository.getLiveMarketData();

            List<MarketDataDto> stockData = liveMarketData.stream().filter(d -> d.marketType() != null).toList();
            List<MarketDataDto> etfData = liveMarketData.stream().filter(d -> d.marketType() == null).toList();

            cache.put("treemap_KOSPI", transformToTreemapDto(stockData, "KOSPI"));
            cache.put("treemap_KOSDAQ", transformToTreemapDto(stockData, "KOSDAQ"));
            cache.put("treemap_ALL", transformToTreemapDto(stockData, "ALL"));
            cache.put("treemap_ETF", transformToTreemapDto(etfData, "ETF"));

            cache.put("rank_KOSPI_MARKET_CAP_DESC", createRankData(stockData, "KOSPI", "MARKET_CAP", "DESC", 100));
            cache.put("rank_KOSDAQ_MARKET_CAP_DESC", createRankData(stockData, "KOSDAQ", "MARKET_CAP", "DESC", 100));
            cache.put("rank_ALL_CHANGE_RATE_DESC", createRankData(liveMarketData, "ALL", "CHANGE_RATE", "DESC", 100));
            cache.put("rank_ALL_CHANGE_RATE_ASC", createRankData(liveMarketData, "ALL", "CHANGE_RATE", "ASC", 100));
            cache.put("rank_ALL_VOLUME_DESC", createRankData(liveMarketData, "ALL", "VOLUME", "DESC", 100));
            cache.put("rank_ALL_TRADE_VALUE_DESC", createRankData(liveMarketData, "ALL", "TRADE_VALUE", "DESC", 100));
            cache.put("rank_ALL_CHANGE_RATE_TOP_AND_BOTTOM", createTopAndBottomRankData(liveMarketData, "ALL", 100));

            // 2. 코스피/코스닥 지수 정보 조회 및 캐싱
            fetchIndexData("02").ifPresent(data -> cache.put("index_KOSPI", data));
            fetchIndexData("03").ifPresent(data -> cache.put("index_KOSDAQ", data));

            log.info("시장 데이터 캐시 업데이트 완료.");
        } catch (Exception e) {
            log.error("시장 데이터 캐시 업데이트 중 오류 발생", e);
        }
    }

    /**
     * KRX에서 코스피 또는 코스닥 지수 정보를 가져옵니다.
     * @param idxIndMidclssCd "02" for KOSPI, "03" for KOSDAQ
     * @return 지수 정보 Map (Optional)
     */
    private java.util.Optional<Map<String, String>> fetchIndexData(String idxIndMidclssCd) {
        try {
            HttpClient client = HttpClient.newHttpClient();
            String today = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));

            String formData = new java.util.StringJoiner("&")
                    .add("bld=" + URLEncoder.encode("dbms/MDC/STAT/standard/MDCSTAT00101", StandardCharsets.UTF_8))
                    .add("locale=ko_KR")
                    .add("idxIndMidclssCd=" + URLEncoder.encode(idxIndMidclssCd, StandardCharsets.UTF_8))
                    .add("trdDd=" + URLEncoder.encode(today, StandardCharsets.UTF_8))
                    .add("share=2")
                    .add("money=3")
                    .add("csvxls_isNo=false")
                    .toString();

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd"))
                    .header("Accept", "application/json, text/javascript, */*; q=0.01")
                    .header("Accept-Language", "ko,en;q=0.9,en-US;q=0.8")
                    .header("Cache-Control", "no-cache")
                    .header("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")
                    .header("Cookie", "__smVisitorID=gJNV0xI1RRT; JSESSIONID=HayrObIvzAAyborAtb3LdkU2w8WHPHaFkXghDRc1UaHCMdMllBdvyZCgY7wufpOV.bWRjX2RvbWFpbi9tZGNvd2FwMi1tZGNhcHAwMQ==")
                    .header("Origin", "https://data.krx.co.kr")
                    .header("Pragma", "no-cache")
                    .header("Referer", "https://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd?menuId=MDC0201010105")
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0")
                    .header("X-Requested-With", "XMLHttpRequest")
                    .header("sec-ch-ua", "\"Microsoft Edge\";v=\"141\", \"Not?A_Brand\";v=\"8\", \"Chromium\";v=\"141\"")
                    .header("sec-ch-ua-mobile", "?0")
                    .header("sec-ch-ua-platform", "\"Windows\"")
                    .header("sec-fetch-dest", "empty")
                    .header("sec-fetch-mode", "cors")
                    .header("sec-fetch-site", "same-origin")
                    .POST(HttpRequest.BodyPublishers.ofString(formData))
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 200) {
                Map<String, Object> jsonResponse = objectMapper.readValue(response.body(), new TypeReference<>() {});
                List<Map<String, String>> output = (List<Map<String, String>>) jsonResponse.get("output");
                if (output != null && !output.isEmpty()) {
                    log.info("Successfully fetched index data for code: {}", idxIndMidclssCd);
                    return java.util.Optional.of(output.get(1));
                }
            } else {
                log.warn("Failed to fetch index data for code: {}. Status: {}", idxIndMidclssCd, response.statusCode());
            }
        } catch (IOException | InterruptedException e) {
            log.error("Error while fetching index data for code: {}", idxIndMidclssCd, e);
        }
        return java.util.Optional.empty();
    }
    public TreemapDto getTreemapData(String marketType) {
        String cacheKey = "treemap_" + marketType.toUpperCase();
        log.info("캐시에서 {} 키로 트리맵 데이터를 조회합니다.", cacheKey);
        return (TreemapDto) cache.get(cacheKey);
    }

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

    private List<RankItemDto> createRankData(List<MarketDataDto> flatData, String market, String by, String order, int limit) {
        List<MarketDataDto> filteredData = flatData.stream()
                .filter(d -> "ALL".equalsIgnoreCase(market) || market.equalsIgnoreCase(d.marketType()))
                .toList();

        java.util.Comparator<MarketDataDto> comparator = switch (by.toUpperCase()) {
            case "MARKET_CAP" -> java.util.Comparator.comparing(MarketDataDto::mktcap, java.util.Comparator.nullsLast(java.util.Comparator.reverseOrder()));
            case "VOLUME" -> java.util.Comparator.comparing(MarketDataDto::tradeVolume, java.util.Comparator.nullsLast(java.util.Comparator.reverseOrder()));
            case "TRADE_VALUE" -> java.util.Comparator.comparing(MarketDataDto::tradeValue, java.util.Comparator.nullsLast(java.util.Comparator.reverseOrder()));
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
                        d.isuSrtCd(),
                        d.nodeName(),
                        d.currentPrice() != null ? d.currentPrice() : 0L,
                        d.fluc_rate() != null ? d.fluc_rate() : 0.0,
                        d.tradeVolume() != null ? d.tradeVolume() : 0L,
                        d.tradeValue() != null ? d.tradeValue() : 0L,
                        d.mktcap() != null ? d.mktcap() : 0L
                ))
                .toList();
    }

    private List<RankItemDto> createTopAndBottomRankData(List<MarketDataDto> flatData, String market, int limit) {
        List<RankItemDto> top = createRankData(flatData, market, "CHANGE_RATE", "DESC", limit);
        List<RankItemDto> bottom = createRankData(flatData, market, "CHANGE_RATE", "ASC", limit);
        return java.util.stream.Stream.concat(top.stream(), bottom.stream()).toList();
    }
    
    private TreemapDto transformToTreemapDto(List<MarketDataDto> flatData, String marketName) {
        List<MarketDataDto> marketSpecificData;
        if ("ETF".equalsIgnoreCase(marketName) || "ALL".equalsIgnoreCase(marketName)) {
            marketSpecificData = flatData;
        } else {
            marketSpecificData = flatData.stream()
                .filter(d -> marketName.equalsIgnoreCase(d.marketType()))
                .toList();
        }

        if (marketSpecificData.isEmpty()) {
            return new TreemapDto(marketName, List.of());
        }

        Map<String, List<MarketDataDto>> groupedBySector = marketSpecificData.stream()
                .collect(Collectors.groupingBy(d -> d.sectorName() != null ? d.sectorName() : "기타 섹터"));

        List<TreemapSectorDto> sectorChildren = groupedBySector.entrySet().stream()
                .map(entry -> {
                    String sectorName = entry.getKey();
                    List<MarketDataDto> items = entry.getValue();

                    List<TreemapNodeDto> stockChildren = items.stream()
                            .map(item -> new TreemapNodeDto(
                                    item.isuSrtCd(),
                                    item.nodeName() != null ? item.nodeName() : "이름없음",
                                    item.mktcap() != null ? item.mktcap() : 0L,
                                    item.fluc_rate() != null ? item.fluc_rate() : 0.0,
                                    item.currentPrice() != null ? item.currentPrice() : 0L
                            )).toList();

                    return new TreemapSectorDto(sectorName, stockChildren);
                }).toList();

        String rootName = "ALL".equalsIgnoreCase(marketName) ? "통합 시장" : marketName;
        if ("ETF".equalsIgnoreCase(marketName)) {
            rootName = "ETF";
        }
        return new TreemapDto(rootName, sectorChildren);
    }

    public Map<String, Object> getDynamicData(List<String> dataKeys) {
        if (dataKeys == null || dataKeys.isEmpty()) {
            return Map.of();
        }
        return dataKeys.stream()
            .filter(cache::containsKey)
            .collect(Collectors.toMap(key -> key, cache::get));
    }
}