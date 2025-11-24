package stockDashboard.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 단일 종목의 상세한 시장 데이터를 담는 데이터 전송 객체(DTO)입니다.
 * Ticker symbol, name, market cap, price, volume, sector, etc.
 * @param isuSrtCd 종목 코드 (e.g., "005930")
 * @param nodeName 종목명 (e.g., "삼성전자")
 * @param mktcap 시가총액
 * @param fluc_rate 등락률
 * @param currentPrice 현재가 (종가)
 * @param openPrice 시가
 * @param highPrice 고가
 * @param lowPrice 저가
 * @param tradeVolume 거래량
 * @param tradeValue 거래대금
 * @param sectorName 섹터(업종)명
 * @param marketType 시장 구분 (KOSPI, KOSDAQ)
 * @param metricDate 데이터 기준일
 * @param collectedAt 데이터 수집 시각
 */
public record MarketDataDto(
    String isuSrtCd,
    String nodeName,
    Long mktcap,
    Double fluc_rate,
    Long currentPrice, // TDD_CLSPRC
    Long openPrice,    // TDD_OPNPRC
    Long highPrice,    // TDD_HGPRC
    Long lowPrice,     // TDD_LWPRC
    Long tradeVolume,  // ACC_TRDVOL
    Long tradeValue,   // ACC_TRDVAL
    String sectorName,
    String marketType,
    LocalDate metricDate,
    LocalDateTime collectedAt
) { }