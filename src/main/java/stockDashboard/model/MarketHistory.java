package stockDashboard.model;

import java.time.LocalDate;

/**
 * 주식 시장(KOSPI, KOSDAQ)의 이력을 나타내는 데이터 모델입니다.
 * @param id 시장 ID
 * @param start_date 시작일
 * @param end_date 종료일 (null인 경우 현재 유효)
 * @param name 시장명
 */
public record MarketHistory(
		String id,
		LocalDate start_date,
		LocalDate end_date,
		String name
	) { }
