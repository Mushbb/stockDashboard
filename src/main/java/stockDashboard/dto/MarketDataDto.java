package stockDashboard.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record MarketDataDto(
    String isuSrtCd,
    String nodeName,
    Long mktcap,
    Double fluc_rate,
    String sectorName,
    String marketType,
    LocalDate metricDate,
    LocalDateTime collectedAt
) { }