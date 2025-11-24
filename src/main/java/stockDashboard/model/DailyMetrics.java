package stockDashboard.model;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 특정 종목의 일별 시세 및 지표를 나타내는 데이터 모델입니다.
 * 'daily_metrics' 테이블의 한 행에 해당합니다.
 * @param isuSrtCd 종목 코드 (PK)
 * @param metricDate 데이터 기준일 (PK)
 * @param tddClsprc 종가
 * @param flucTpCd 등락 구분 코드
 * @param cmpprevddPrc 전일 대비
 * @param flucRt 등락률
 * @param tddOpnprc 시가
 * @param tddHgprc 고가
 * @param tddLwprc 저가
 * @param accTrdvol 누적 거래량
 * @param accTrdval 누적 거래대금
 * @param mktcap 시가총액
 * @param listShrs 상장 주식 수
 * @param sectTpNm 상장 부문
 * @param collectedAt 데이터 수집 시각
 */
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
