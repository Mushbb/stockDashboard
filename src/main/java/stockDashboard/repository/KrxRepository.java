package stockDashboard.repository;

import stockDashboard.dto.MarketDataDto;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class KrxRepository {
	private final JdbcTemplate jdbcTemplate;

    public KrxRepository(@Qualifier("appJdbcTemplate") JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }
	
	/**
	 * 가장 최근 날짜의 장중 시장 데이터를 시가총액 순으로 조회합니다.
	 * @return 실시간 시장 데이터 DTO 리스트
	 */
	public List<MarketDataDto> getLiveMarketData() {
		String sql = """
				SELECT 
				    m.ISU_SRT_CD, n_hist.value AS node_name, s_hist.value AS sector_name, m_hist.value AS market_type,
				    m.metric_date, m.collected_at, m.MKTCAP, m.FLUC_RT, 
				    m.TDD_CLSPRC, m.TDD_OPNPRC, m.TDD_HGPRC, m.TDD_LWPRC, m.ACC_TRDVOL, m.ACC_TRDVAL
				FROM daily_metrics m 
					INNER JOIN stock_history n_hist ON m.ISU_SRT_CD = n_hist.stock_id AND n_hist.history_type = 'NAME'
					INNER JOIN stock_history s_hist ON m.ISU_SRT_CD = s_hist.stock_id AND s_hist.history_type = 'SECTOR'
					INNER JOIN stock_history m_hist ON m.ISU_SRT_CD = m_hist.stock_id AND m_hist.history_type = 'MARKET'
				WHERE m.collected_at = ( SELECT MAX(collected_at) FROM daily_metrics )
					AND n_hist.end_date IS NULL
					AND s_hist.end_date IS NULL
					AND m_hist.end_date IS NULL
				ORDER BY m.MKTCAP DESC
				""";

		List<Map<String, Object>> results = jdbcTemplate.queryForList(sql);
		return mapResultsToMarketDataDto(results);
	}

	/**
	 * 특정 날짜의 장 마감 후 시장 데이터를 시가총액 순으로 조회합니다.
	 */
	public List<MarketDataDto> getClosedMarketDataByDate(LocalDate date) {
		String sql = """
				WITH RankedMetrics AS (
					SELECT m.*, ROW_NUMBER() OVER(PARTITION BY m.ISU_SRT_CD ORDER BY m.collected_at DESC) as rn
					FROM daily_metrics m
					WHERE m.metric_date = ?
				)
				SELECT 
				    rm.ISU_SRT_CD, n_hist.value AS node_name, s_hist.value AS sector_name, m_hist.value AS market_type,
				    rm.metric_date, rm.collected_at, rm.MKTCAP, rm.FLUC_RT, 
				    rm.TDD_CLSPRC, rm.TDD_OPNPRC, rm.TDD_HGPRC, rm.TDD_LWPRC, rm.ACC_TRDVOL, rm.ACC_TRDVAL
				FROM RankedMetrics rm
					INNER JOIN stock_history n_hist ON rm.ISU_SRT_CD = n_hist.stock_id AND n_hist.history_type = 'NAME'
					INNER JOIN stock_history s_hist ON rm.ISU_SRT_CD = s_hist.stock_id AND s_hist.history_type = 'SECTOR'
					INNER JOIN stock_history m_hist ON rm.ISU_SRT_CD = m_hist.stock_id AND m_hist.history_type = 'MARKET'
				WHERE rm.rn = 1
					AND rm.metric_date BETWEEN n_hist.start_date AND ISNULL(n_hist.end_date, '9999-12-31')
					AND rm.metric_date BETWEEN s_hist.start_date AND ISNULL(s_hist.end_date, '9999-12-31')
					AND rm.metric_date BETWEEN m_hist.start_date AND ISNULL(m_hist.end_date, '9999-12-31')
				ORDER BY rm.MKTCAP DESC
				""";
		
		Object[] params = { date };
		List<Map<String, Object>> results = jdbcTemplate.queryForList(sql, params);

		return mapResultsToMarketDataDto(results);
	}

	private List<MarketDataDto> mapResultsToMarketDataDto(List<Map<String, Object>> results) {
		List<MarketDataDto> marketDataList = new ArrayList<>();

		for (Map<String, Object> row : results) {
			marketDataList.add(new MarketDataDto(
					(String) row.get("ISU_SRT_CD"),
					(String) row.get("node_name"),
					getLongValue(row, "MKTCAP"),
					getDoubleValue(row, "FLUC_RT"),
					getLongValue(row, "TDD_CLSPRC"),
                    getLongValue(row, "TDD_OPNPRC"),
                    getLongValue(row, "TDD_HGPRC"),
                    getLongValue(row, "TDD_LWPRC"),
                    getLongValue(row, "ACC_TRDVOL"),
                    getLongValue(row, "ACC_TRDVAL"),
					(String) row.get("sector_name"),
					(String) row.get("market_type"),
					getLocalDateValue(row, "metric_date"),
					getLocalDateTimeValue(row, "collected_at")
            ));
		}

		return marketDataList;
	}

    // --- Helper methods for safe type casting ---
    private Long getLongValue(Map<String, Object> row, String key) {
        Object value = row.get(key);
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }
        return null;
    }

    private Double getDoubleValue(Map<String, Object> row, String key) {
        Object value = row.get(key);
        if (value instanceof Number) {
            return ((Number) value).doubleValue();
        }
        return null;
    }

    private LocalDate getLocalDateValue(Map<String, Object> row, String key) {
        Object value = row.get(key);
        if (value instanceof Date) {
            return ((Date) value).toLocalDate();
        }
        return null;
    }

    private LocalDateTime getLocalDateTimeValue(Map<String, Object> row, String key) {
        Object value = row.get(key);
        if (value instanceof Timestamp) {
            return ((Timestamp) value).toLocalDateTime();
        }
        return null;
    }
}