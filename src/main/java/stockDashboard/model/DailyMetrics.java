package stockDashboard.model;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record DailyMetrics(
	    // PK 필드
	    String isuSrtCd,
	    LocalDate metricDate,
	    
	    // 데이터 필드
	    Long tddClsprc,
	    Long flucTpCd,
	    Long cmpprevddPrc,
	    BigDecimal flucRt,
	    Long tddOpnprc,
	    Long tddHgprc,
	    Long tddLwprc,
	    Long accTrdvol,
	    Long accTrdval,
	    Long mktcap,
	    Long listShrs,
	    String sectTpNm,
	    LocalDateTime collectedAt
	) { }
