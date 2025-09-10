package stockDashboard.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

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