package stockDashboard.repository;

import stockDashboard.dto.MarketDataDto;

import java.math.BigDecimal;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Repository;
import lombok.RequiredArgsConstructor;

@RequiredArgsConstructor
@Repository
public class KrxRepository {
	private final JDBC_SQL jdbc_sql;
	
	/**
	 * 가장 최근 날짜의 장중 시장 데이터를 시가총액 순으로 조회합니다.
	 * @return 실시간 시장 데이터 DTO 리스트
	 */
	public List<MarketDataDto> getLiveMarketData() {
		String sql = """
				SELECT m.ISU_SRT_CD, n.node_name, m.MKTCAP, m.FLUC_RT, s.sector_name, h.market_type, m.metric_date, m.collected_at
				FROM daily_metrics m INNER JOIN nodes n ON m.ISU_SRT_CD = n.ISU_SRT_CD
					INNER JOIN sector_history s ON n.ISU_SRT_CD = s.stock_id
					INNER JOIN market_history h ON n.ISU_SRT_CD = h.stock_id
				WHERE m.metric_date = ( SELECT MAX(metric_date) FROM daily_metrics )
					AND s.end_date IS NULL
					AND h.end_date IS NULL
				ORDER BY m.MKTCAP DESC
				""";

		List<Map<String, Object>> results = jdbc_sql.executeSelect(sql, null);
		return mapResultsToMarketDataDto(results);
	}

	/**
	 * 특정 날짜의 장 마감 후 시장 데이터를 시가총액 순으로 조회합니다.
	 * 해당 날짜에 수집된 여러 데이터 중 가장 마지막에 수집된 데이터를 기준으로 합니다.
	 *
	 * @param date 조회할 날짜 (LocalDate)
	 * @return 해당 날짜의 시장 데이터 DTO 리스트
	 */
	public List<MarketDataDto> getClosedMarketDataByDate(LocalDate date) {
		String sql = """
				WITH RankedMetrics AS (
					SELECT m.*, ROW_NUMBER() OVER(PARTITION BY m.ISU_SRT_CD ORDER BY m.collected_at DESC) as rn
					FROM daily_metrics m
					WHERE m.metric_date = ?
				)
				SELECT rm.ISU_SRT_CD, n.node_name, rm.MKTCAP, rm.FLUC_RT, s.sector_name, h.market_type, rm.metric_date, rm.collected_at
				FROM RankedMetrics rm
					INNER JOIN nodes n ON rm.ISU_SRT_CD = n.ISU_SRT_CD
					INNER JOIN sector_history s ON rm.ISU_SRT_CD = s.stock_id
					INNER JOIN market_history h ON rm.ISU_SRT_CD = h.stock_id
				WHERE rm.rn = 1
					AND rm.metric_date BETWEEN s.start_date AND ISNULL(s.end_date, '9999-12-31')
					AND rm.metric_date BETWEEN h.start_date AND ISNULL(h.end_date, '9999-12-31')
				ORDER BY rm.MKTCAP DESC
				""";
		
		Object[] params = { date };
		List<Map<String, Object>> results = jdbc_sql.executeSelect(sql, params);

		return mapResultsToMarketDataDto(results);
	}

	/**
	 * DB 조회 결과(List<Map>)를 DTO(List<MarketDataDto>)로 변환하는 헬퍼 메소드
	 * @param results a list of maps, where each map represents a row
	 * @return a list of MarketDataDto objects
	 */
	private List<MarketDataDto> mapResultsToMarketDataDto(List<Map<String, Object>> results) {
		List<MarketDataDto> marketDataList = new ArrayList<>();

		for (Map<String, Object> row : results) {
			// 데이터베이스에서 반환된 Object를 DTO의 타입에 맞게 캐스팅하고 변환합니다.
			Long mktcap = null;
			Object mktcapObj = row.get("MKTCAP");
			if (mktcapObj instanceof BigDecimal) {
				mktcap = ((BigDecimal) mktcapObj).longValue();
			} else if (mktcapObj instanceof Number) {
				mktcap = ((Number) mktcapObj).longValue();
			}
			Object fluc_rateObj = row.get("FLUC_RT");
			Double fluc_rate = ((BigDecimal) fluc_rateObj).doubleValue();

			LocalDate metricDate = null;
			Object metricDateObj = row.get("metric_date");
			if (metricDateObj instanceof Date) {
				metricDate = ((Date) metricDateObj).toLocalDate();
			} else if (metricDateObj instanceof LocalDate) {
				metricDate = (LocalDate) metricDateObj;
			}

			LocalDateTime collectedAt = null;
			Object collectedAtObj = row.get("collected_at");
			if (collectedAtObj instanceof Timestamp) {
				collectedAt = ((Timestamp) collectedAtObj).toLocalDateTime();
			} else if (collectedAtObj instanceof LocalDateTime) {
				collectedAt = (LocalDateTime) collectedAtObj;
			}

			marketDataList.add(new MarketDataDto(
					(String) row.get("ISU_SRT_CD"),
					(String) row.get("node_name"),
					mktcap,
					fluc_rate,
					(String) row.get("sector_name"),
					(String) row.get("market_type"),
					metricDate,
					collectedAt));
		}

		return marketDataList;
	}
}
