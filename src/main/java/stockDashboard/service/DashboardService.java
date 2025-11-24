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
import lombok.extern.slf4j.Slf4j;
import stockDashboard.dto.MarketDataDto;
import stockDashboard.dto.RankItemDto;
import stockDashboard.dto.TreemapDto;
import stockDashboard.dto.TreemapNodeDto;
import stockDashboard.dto.TreemapSectorDto;
import stockDashboard.repository.KrxRepository;

/**
 * 대시보드에 필요한 각종 데이터를 조회, 가공 및 캐싱하는 서비스입니다.
 * 주기적으로 KRX 데이터를 가져와 실시간 순위, 트리맵 데이터 등을 생성하고 캐시에 저장하여
 * API 요청 시 빠른 응답을 가능하게 합니다.
 */
@Slf4j
@Service
public class DashboardService {
	private final KrxRepository krxRepository;
	private final ObjectMapper objectMapper; // JSON 파싱을 위해 추가

    public DashboardService(KrxRepository krxRepository, ObjectMapper objectMapper) {
        this.krxRepository = krxRepository;
        this.objectMapper = objectMapper;
    }
	
	/**
     * 대시보드 데이터를 저장하는 인메모리 캐시입니다.
     * 스레드에 안전한 ConcurrentHashMap을 사용하여 동시성 문제를 방지합니다.
     * 키(String)는 데이터의 종류를 나타내고, 값(Object)은 실제 데이터입니다.
     */
    private final Map<String, Object> cache = new ConcurrentHashMap<>();

    /**
     * 애플리케이션 시작 시 캐시를 초기화합니다.
     */
    @PostConstruct
    public void initCache() {
        updateMarketDataCache();
    }

    /**
     * 5분마다 실행되어 시장 데이터 캐시를 주기적으로 업데이트합니다.
     * 주식/ETF 데이터, 순위 데이터, 코스피/코스닥 지수 정보를 조회하여 캐시에 저장합니다.
     */
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
     * KRX 정보데이터 시스템에서 코스피 또는 코스닥 지수 정보를 HTTP 요청으로 가져옵니다.
     * @param idxIndMidclssCd 지수 구분 코드 ("02" for KOSPI, "03" for KOSDAQ)
     * @return 조회된 지수 정보를 담은 Map 객체 (Optional)
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

    /**
     * 캐시에서 트리맵 데이터를 조회합니다.
     * @param marketType 조회할 시장 타입 (e.g., "KOSPI", "KOSDAQ")
     * @return 캐시된 TreemapDto 객체
     */
    public TreemapDto getTreemapData(String marketType) {
        String cacheKey = "treemap_" + marketType.toUpperCase();
        log.info("캐시에서 {} 키로 트리맵 데이터를 조회합니다.", cacheKey);
        return (TreemapDto) cache.get(cacheKey);
    }

    /**
     * 캐시에서 순위 데이터를 조회합니다.
     * @param by 정렬 기준 (e.g., "MARKET_CAP")
     * @param market 시장 구분 (e.g., "KOSPI")
     * @param order 정렬 순서 (e.g., "DESC")
     * @param limit 반환할 최대 개수
     * @return 캐시된 RankItemDto 리스트
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
     * 캐시에서 등락률 상위/하위 순위 데이터를 조회합니다.
     * @param market 시장 구분 (e.g., "ALL")
     * @param limit 반환할 최대 개수
     * @return 등락률 상위/하위 RankItemDto 리스트
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
     * 실시간 시장 데이터 리스트를 기반으로 정렬된 순위 데이터를 생성합니다.
     * @param flatData 필터링 및 정렬할 전체 시장 데이터
     * @param market 시장 구분
     * @param by 정렬 기준
     * @param order 정렬 순서
     * @param limit 생성할 최대 개수
     * @return 정렬된 RankItemDto 리스트
     */
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

    /**
     * 등락률 상위/하위 데이터를 생성하여 하나의 리스트로 결합합니다.
     * @param flatData 전체 시장 데이터
     * @param market 시장 구분
     * @param limit 생성할 최대 개수
     * @return 등락률 상위/하위 데이터가 결합된 리스트
     */
    private List<RankItemDto> createTopAndBottomRankData(List<MarketDataDto> flatData, String market, int limit) {
        List<RankItemDto> top = createRankData(flatData, market, "CHANGE_RATE", "DESC", limit);
        List<RankItemDto> bottom = createRankData(flatData, market, "CHANGE_RATE", "ASC", limit);
        return java.util.stream.Stream.concat(top.stream(), bottom.stream()).toList();
    }
    
    /**
     * 평탄화된 시장 데이터를 트리맵 구조로 변환합니다.
     * 데이터를 섹터별로 그룹화하고, 각 섹터 아래에 개별 종목 노드를 추가합니다.
     * @param flatData 변환할 전체 시장 데이터
     * @param marketName 시장 이름 (e.g., "KOSPI")
     * @return 트리맵 구조를 나타내는 TreemapDto 객체
     */
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

    /**
     * 프론트엔드에서 요청한 여러 데이터 키에 해당하는 데이터들을 캐시에서 조회하여 반환합니다.
     * @param dataKeys 조회할 데이터의 키 리스트
     * @return 데이터 키와 실제 데이터 객체로 구성된 Map
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